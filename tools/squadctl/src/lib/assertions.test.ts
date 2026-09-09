import { describe, expect, it } from 'vitest';
import { assess, conflictCommand, describeConflict } from './assertions.ts';
import type { TeamPlan } from './reconcile.ts';

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
  generatedIds: [],
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

describe('assess — informational', () => {
  // Club wikitext structurally never carries a birth date.
  it('counts new players with no birth date without affecting verified', () => {
    const result = assess(plan({ noBirthCount: 4 }));
    expect(result.verified).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(result.informational.join()).toContain('4 new player(s) with no birth date');
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
