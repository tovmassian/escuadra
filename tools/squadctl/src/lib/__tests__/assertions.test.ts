import { describe, expect, it } from 'vitest';
import { ROUND_LENGTH } from '../../../../../lib/scoring.ts';
import { PLAYABLE_NUMBERED, assess, conflictCommand, describeConflict } from '../assertions.ts';
import type { TeamPlan } from '../reconcile.ts';

const squad = (kind: 'club' | 'nation', memberCount: number): TeamPlan['squad'] => ({
  id: 'x',
  kind,
  name: 'X',
  season: kind === 'club' ? '2026/27' : '2026',
  primaryColor: '#FFFFFF',
  secondaryColor: '#E20001',
  verified: true,
  marker: { bands: ['#FFFFFF'], orientation: 'vertical' },
  lastUpdated: '2026-01-01',
  source: 'https://en.wikipedia.org/wiki/X',
  members: Array.from({ length: memberCount }, (_, i) => ({ playerId: `p${i}`, no: i + 1 })),
});

const plan = (over: Partial<TeamPlan> = {}): TeamPlan => ({
  teamId: 'x',
  squad: squad('club', 25),
  newPlayers: [],
  updatedPlayers: [],
  departed: [],
  ambiguous: [],
  possibleRenames: [],
  omitted: [],
  nameVariants: [],
  titleMismatches: [],
  loanedOut: [],
  excluded: [],
  generatedIds: [],
  namesakes: [],
  clubless: [],
  markup: [],
  parsedCount: 25,
  matchedCount: 25,
  addedCount: 0,
  noBirthCount: 0,
  numberlessCount: 0,
  captainCount: 1,
  unknownTemplates: [],
  callUpsOnly: false,
  blastRadius: 0,
  hadStoredSquad: true,
  ...over,
});

describe('assess — verified is the output of the pass', () => {
  it('verifies a clean team', () => {
    const result = assess(plan());
    expect(result.verified).toBe(true);
    expect(result.conflicts).toEqual([]);
    expect(result.failures).toEqual([]);
  });

  it('leaves verified true for warnings alone', () => {
    const result = assess(
      plan({ departed: [{ id: 'a', name: 'A Leaver' }], generatedIds: ['b-new'] }),
    );
    expect(result.verified).toBe(true);
    expect(result.warnings).toHaveLength(2);
  });

  it('drops verified to false on any conflict', () => {
    const result = assess(plan({ ambiguous: [{ name: 'Ederson', candidateIds: ['a', 'b'] }] }));
    expect(result.verified).toBe(false);
    expect(result.conflicts[0]?.kind).toBe('ambiguous-name');
  });
});

describe('assess — hard failures', () => {
  it('fails a club squad below the minimum member count', () => {
    expect(assess(plan({ squad: squad('club', 12) })).failures.join()).toContain('minimum 14');
  });

  it('fails on more than one captain', () => {
    expect(assess(plan({ captainCount: 2 })).failures.join()).toContain('2 captains');
  });

  it('fails rather than inventing a colour when identity is missing', () => {
    const bare = { ...squad('club', 25), primaryColor: '' };
    expect(assess(plan({ squad: bare })).failures.join()).toContain(
      'never given an invented colour',
    );
  });
});

describe('assess — an unplayable squad is held', () => {
  // Brazil's article lists its current call-up with no shirt numbers at all.
  // Written, it would be a squad `buildRound` throws on the moment it is
  // picked, and a sweep would replace the numbered squad Brazil already has.
  const numbering = (kind: 'club' | 'nation', count: number, numbered: number) => {
    const base = squad(kind, count);
    return {
      ...base,
      members: base.members.map((m, i) => (i < numbered ? m : { ...m, no: null })),
    };
  };

  it('asks exactly the numbered members one round of the app asks', () => {
    expect(PLAYABLE_NUMBERED).toBe(ROUND_LENGTH);
  });

  it('holds a squad with fewer numbered members than one round asks', () => {
    const result = assess(plan({ squad: numbering('nation', 26, 9), numberlessCount: 17 }));
    expect(result.holds).toEqual(['9 of 26 members numbered; a round asks 10']);
  });

  it('holds a squad with no numbers at all', () => {
    const result = assess(plan({ squad: numbering('nation', 26, 0), numberlessCount: 26 }));
    expect(result.holds).toEqual(['0 of 26 members numbered; a round asks 10']);
  });

  it('does not hold a squad with exactly one round of numbered members', () => {
    const result = assess(plan({ squad: numbering('nation', 26, 10), numberlessCount: 16 }));
    expect(result.holds).toEqual([]);
  });

  it('holds a club squad by the same rule', () => {
    const result = assess(plan({ squad: numbering('club', 25, 4), numberlessCount: 21 }));
    expect(result.holds).toHaveLength(1);
  });

  // A player with no club is `club: null` and level 3 skips them (#230), so a
  // free agent no longer keeps a squad out. What a round needs is ten numbered
  // players who can be asked a club.
  it('does not hold a nation squad for a member with no club, while a round is still full', () => {
    const result = assess(
      plan({ squad: squad('nation', 23), clubless: ['p0', 'p1', 'p2', 'p3', 'p4'] }),
    );
    expect(result.holds).toEqual([]);
  });

  it('holds a nation squad whose clubless members leave fewer than a round to ask', () => {
    // 23 numbered, 14 of them with no club: 9 left to ask.
    const clubless = Array.from({ length: 14 }, (_, i) => `p${i}`);
    const result = assess(plan({ squad: squad('nation', 23), clubless }));
    expect(result.holds).toEqual([
      '9 of 23 members numbered with a club; level 3 asks a nation squad 10',
    ]);
  });

  it('subtracts a clubless member once, whether or not they are numbered', () => {
    const numbered = numbering('nation', 26, 12);
    const result = assess(plan({ squad: numbered, numberlessCount: 14, clubless: ['p0', 'p20'] }));
    expect(result.holds).toEqual([]);
  });

  it('does not hold a club squad on clubs, which it gives every member itself', () => {
    expect(assess(plan({ clubless: ['x'] })).holds).toEqual([]);
  });

  it('is not a conflict: a held team is never written, so has no verified to lower', () => {
    const result = assess(plan({ squad: numbering('nation', 26, 0), numberlessCount: 26 }));
    expect(result.conflicts).toEqual([]);
    expect(result.failures).toEqual([]);
  });
});

describe('assess — conflicts', () => {
  it('raises a possible rename', () => {
    const result = assess(
      plan({
        possibleRenames: [
          {
            departedId: 'grimaldo',
            departedName: 'Alejandro Grimaldo',
            arrivedName: 'Álex Grimaldo',
            arrivedId: 'alex-grimaldo',
          },
        ],
      }),
    );
    expect(result.verified).toBe(false);
    const conflict = result.conflicts[0]!;
    // Says which name is the stored one, and names its id.
    expect(describeConflict(conflict)).toBe(
      'possible rename — stored "Alejandro Grimaldo" (grimaldo) left the squad, source lists "Álex Grimaldo"',
    );
    // Both answers are offered, and both are pasteable: there is no global
    // `squadctl` binary, so each is the `npm run` form.
    const command = conflictCommand(conflict) ?? '';
    expect(command).toContain('npm run squadctl -- rename grimaldo "Álex Grimaldo"');
    expect(command).toContain('npm run squadctl -- alias grimaldo "Álex Grimaldo"');
    expect(command).toContain('npm run squadctl -- split x grimaldo "Álex Grimaldo"');
  });

  it('raises a blast radius above the threshold', () => {
    expect(assess(plan({ blastRadius: 0.6 })).conflicts[0]?.kind).toBe('blast-radius');
  });

  // Every new team would otherwise trip the check at 100%.
  it('skips the blast radius entirely when there is no stored squad', () => {
    const result = assess(plan({ blastRadius: null, hadStoredSquad: false }));
    expect(result.conflicts).toEqual([]);
    expect(result.verified).toBe(true);
  });

  it('raises a call-ups-only section', () => {
    expect(assess(plan({ callUpsOnly: true })).conflicts[0]?.kind).toBe('call-ups-only');
  });
});

describe('assess — a null shirt number is a warning, not a conflict', () => {
  // A modelled, unambiguous state. Treating it as a conflict would leave any
  // club with one unnumbered new signing permanently unverified.
  it('warns and keeps verified true', () => {
    const result = assess(plan({ numberlessCount: 1 }));
    expect(result.verified).toBe(true);
    expect(result.warnings.join()).toContain('no shirt number');
  });
});

describe('assess — a namesake recorded as a new player', () => {
  // Proven a different person from data both sides carry, so there is
  // nothing to decide — but a new record is still worth seeing.
  it('warns, names both records and the proof, and keeps verified true', () => {
    const result = assess(
      plan({
        namesakes: [
          { id: 'emiliano-martinez', of: ['e-martinez'], proof: 'born 1999-08-17, not 1992-09-02' },
        ],
      }),
    );
    expect(result.verified).toBe(true);
    expect(result.warnings).toEqual([
      '1 namesake(s) recorded as a new player: emiliano-martinez (not e-martinez: born 1999-08-17, not 1992-09-02)',
    ]);
  });
});

describe('assess — a spelling disagreement between sources', () => {
  // Ødegaard vs Odegaard: the match holds, but which spelling is right is a
  // human call rather than one the matcher should make silently.
  it('raises a conflict naming both forms', () => {
    const result = assess(
      plan({
        nameVariants: [
          { playerId: 'odegaard', storedName: 'Martin Ødegaard', sourceName: 'Martin Odegaard' },
        ],
      }),
    );
    expect(result.verified).toBe(false);
    const conflict = result.conflicts[0]!;
    expect(describeConflict(conflict)).toContain('spelling disagreement');
    expect(conflictCommand(conflict)).toBe('npm run squadctl -- rename odegaard "Martin Odegaard"');
  });
});

// #230: 25 records stored raw wikitext, and the pass that sets `verified` never
// looked, so every squad holding one verified clean.
describe('assess — markup left in a stored value', () => {
  const left = { playerId: 'juan-rengifo', field: 'name' as const, value: '{{ill|Juan|es}}' };

  it('is a conflict, so the team is written but not verified', () => {
    const result = assess(plan({ markup: [left] }));
    expect(result.verified).toBe(false);
    expect(result.failures).toEqual([]);
    expect(result.conflicts).toContainEqual({ kind: 'markup', ...left });
  });

  it('names the player, the field and the value', () => {
    expect(describeConflict({ kind: 'markup', ...left })).toBe(
      'Wikipedia markup left in the name of juan-rengifo — "{{ill|Juan|es}}"',
    );
  });

  // The fix is the parser or, for a stored value, a rename: no single command.
  it('has no single command, because a person has to look first', () => {
    expect(conflictCommand({ kind: 'markup', ...left })).toBeNull();
  });
});

describe('assess — informational', () => {
  // Club wikitext structurally never carries a birth date.
  it('counts new players with no birth date without affecting verified', () => {
    const result = assess(plan({ noBirthCount: 4 }));
    expect(result.verified).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(result.informational.join()).toContain('4 new player(s) with no birth date');
  });
});

describe('title-mismatch', () => {
  const mismatch = {
    playerId: 'otavio',
    storedTitle: 'Otávio (footballer, born 2002)',
    sourceTitle: 'Otávio (footballer, born November 2005)',
    rowName: 'Otávio',
  };

  it('is a conflict, so the team is written but not verified', () => {
    const result = assess(plan({ titleMismatches: [mismatch] }));
    expect(result.verified).toBe(false);
    expect(result.failures).toEqual([]);
    expect(result.conflicts).toContainEqual({ kind: 'title-mismatch', ...mismatch });
  });

  it('names both titles, since the reader has to judge which is which', () => {
    expect(describeConflict({ kind: 'title-mismatch', ...mismatch })).toBe(
      'identity conflict on otavio — stored "Otávio (footballer, born 2002)", source lists "Otávio (footballer, born November 2005)"',
    );
  });

  it('offers all three answers, because none is expressible as another', () => {
    const command = conflictCommand({ kind: 'title-mismatch', ...mismatch });
    expect(command).toContain('retitle otavio "Otávio (footballer, born November 2005)"');
    expect(command).toContain('alias otavio --title "Otávio (footballer, born November 2005)"');
    expect(command).toContain('fork otavio "Otávio (footballer, born November 2005)"');
  });
});

describe('conflictCommand', () => {
  // A command is only offered where one command actually settles it. The rest
  // need a person to look first, and a wrong suggestion is worse than none.
  it('offers nothing for conflicts a command cannot resolve', () => {
    expect(conflictCommand({ kind: 'call-ups-only', sectionTitle: 'Recent call-ups' })).toBeNull();
    expect(conflictCommand({ kind: 'blast-radius', ratio: 0.7 })).toBeNull();
    expect(
      conflictCommand({ kind: 'ambiguous-name', name: 'Ederson', candidateIds: ['a', 'b'] }),
    ).toBeNull();
  });
});
