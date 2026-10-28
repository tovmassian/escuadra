import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FLAG_BY_NATIONALITY } from '../flags';
import { buildRound, isQuestionCorrect } from '../questionEngine';
import type { Player, RosterEntry, Squad } from '@/types/squad';

function player(overrides: Partial<Player> & Pick<Player, 'id' | 'name' | 'position'>): Player {
  return {
    fullName: overrides.name,
    birth: '2000-01-01',
    nationality: 'England',
    club: null,
    photo: null,
    wikiTitle: null,
    ...overrides,
  };
}

function member(player: Player, no: number): RosterEntry {
  return { member: { playerId: player.id, no }, player };
}

function squad(overrides: Partial<Squad> = {}): Squad {
  return {
    id: 'test',
    kind: 'club',
    name: 'Test FC',
    season: '2025/26',
    primaryColor: '#EF0107',
    secondaryColor: '#FFFFFF',
    verified: false,
    marker: { bands: ['#EF0107'], orientation: 'vertical' },
    lastUpdated: '2026-08-21',
    source: 'https://en.wikipedia.org/wiki/Test_FC',
    members: [],
    ...overrides,
  };
}

// A club squad with a thin goalkeeper pool (2) and healthy outfield pools
// (5 each), so tier-1 same-position selection is exercised for outfielders
// and the tier-2 fallback is forced for goalkeepers.
function buildClubRoster(): RosterEntry[] {
  const gks = ['gk1', 'gk2'].map((id, i) => player({ id, name: `GK ${i}`, position: 'GK' }));
  const dfs = Array.from({ length: 5 }, (_, i) =>
    player({ id: `df${i}`, name: `DF ${i}`, position: 'DF' }),
  );
  const mfs = Array.from({ length: 5 }, (_, i) =>
    player({ id: `mf${i}`, name: `MF ${i}`, position: 'MF' }),
  );
  const fws = Array.from({ length: 5 }, (_, i) =>
    player({ id: `fw${i}`, name: `FW ${i}`, position: 'FW' }),
  );
  const all = [...gks, ...dfs, ...mfs, ...fws];
  return all.map((p, i) => member(p, i + 1));
}

function buildNationRoster(): RosterEntry[] {
  return buildClubRoster().map((r) => ({
    ...r,
    player: { ...r.player, nationality: 'Brazil', club: `${r.player.name} FC` },
  }));
}

describe('buildRound', () => {
  it('is deterministic for a given seed', () => {
    const roster = buildClubRoster();
    const s = squad();
    const a = buildRound({ squad: s, roster, level: 1, seed: 42, now: new Date('2026-01-01') });
    const b = buildRound({ squad: s, roster, level: 1, seed: 42, now: new Date('2026-01-01') });
    expect(a).toEqual(b);
  });

  it('produces different rounds for different seeds', () => {
    const roster = buildClubRoster();
    const s = squad();
    const a = buildRound({ squad: s, roster, level: 1, seed: 1 });
    const b = buildRound({ squad: s, roster, level: 1, seed: 2 });
    expect(a).not.toEqual(b);
  });

  it('level 1 asks only a name part, with 4 options', () => {
    const roster = buildClubRoster();
    const [q] = buildRound({ squad: squad(), roster, level: 1, seed: 7, size: 1 });
    expect(q?.parts).toHaveLength(1);
    expect(q?.parts[0]?.options).toHaveLength(4);
  });

  it('level 2 adds a position part with the fixed GK/DF/MF/FW order', () => {
    const roster = buildClubRoster();
    const [q] = buildRound({ squad: squad(), roster, level: 2, seed: 7, size: 1 });
    expect(q?.parts).toHaveLength(2);
    expect(q?.parts[1]).toMatchObject({ kind: 'position', options: ['GK', 'DF', 'MF', 'FW'] });
  });

  it('level 3 asks 6 name options and a third part', () => {
    const roster = buildClubRoster();
    const [q] = buildRound({ squad: squad(), roster, level: 3, seed: 7, size: 1 });
    expect(q?.parts).toHaveLength(3);
    expect(q?.parts[0]?.options).toHaveLength(6);
  });

  it('level 3 on a club squad asks nationality', () => {
    const roster = buildClubRoster();
    const [q] = buildRound({ squad: squad({ kind: 'club' }), roster, level: 3, seed: 7, size: 1 });
    expect(q?.parts[2]?.kind).toBe('nationality');
  });

  it('level 3 on a nation squad asks club', () => {
    const roster = buildNationRoster();
    const [q] = buildRound({
      squad: squad({ kind: 'nation' }),
      roster,
      level: 3,
      seed: 7,
      size: 1,
    });
    expect(q?.parts[2]?.kind).toBe('club');
  });

  it('prefers same-position distractors for the name part', () => {
    const roster = buildClubRoster();
    const rounds = buildRound({ squad: squad(), roster, level: 1, seed: 3, size: 10 });
    for (const q of rounds) {
      const namePart = q.parts[0];
      if (namePart?.kind !== 'name') continue;
      const subjectEntry = roster.find((r) => r.player.id === q.playerId);
      if (!subjectEntry) continue;
      const subjectPosition = subjectEntry.player.position;
      const samePositionInRoster =
        roster.filter((r) => r.player.position === subjectPosition).length - 1;
      // With 5-strong tiers and 3 needed distractors, tier 1 alone always
      // covers it — every option should share the subject's position.
      if (samePositionInRoster >= 3) {
        const optionOwners = namePart.options.map(
          (name) => roster.find((r) => r.player.name === name)?.player.position,
        );
        expect(optionOwners.every((pos) => pos === subjectPosition)).toBe(true);
      }
    }
  });

  it('falls back to same-squad distractors when a position tier is too thin', () => {
    const roster = buildClubRoster(); // only 2 GKs total
    const gkEntry = roster.find((r) => r.player.position === 'GK');
    expect(gkEntry).toBeDefined();
    const [q] = buildRound({ squad: squad(), roster, level: 3, seed: 11, size: 1 });
    // Force a GK subject by retrying seeds until one lands on a GK, since the
    // subject is chosen by shuffle — assert on structure instead: whichever
    // subject was picked, if their position pool is short, some options must
    // come from other positions.
    const subject = roster.find((r) => r.player.id === q?.playerId);
    if (!subject) throw new Error('subject not found');
    const namePart = q?.parts[0];
    if (namePart?.kind !== 'name') throw new Error('expected name part');
    const poolSize = roster.filter((r) => r.player.position === subject.player.position).length - 1;
    if (poolSize < 5) {
      const optionOwners = namePart.options.map(
        (name) => roster.find((r) => r.player.name === name)?.player.position,
      );
      expect(optionOwners.some((pos) => pos !== subject.player.position)).toBe(true);
    }
  });

  it('throws when the roster is too small for the requested level', () => {
    const tinyRoster = buildClubRoster().slice(0, 3);
    expect(() => buildRound({ squad: squad(), roster: tinyRoster, level: 1, seed: 1 })).toThrow();
    const midRoster = buildClubRoster().slice(0, 5);
    expect(() => buildRound({ squad: squad(), roster: midRoster, level: 3, seed: 1 })).toThrow();
  });

  // A player with no club is `club: null` (a free agent, #230). A club question
  // about one has no answer, so level 3 on a nation squad never asks it; they
  // still make a name distractor, and levels 1 and 2 ask them as any player.
  describe('a nation player with no club', () => {
    const clubless = new Set(['gk1', 'df0', 'mf0', 'fw0']);
    const roster = buildNationRoster().map((r) =>
      clubless.has(r.player.id) ? { ...r, player: { ...r.player, club: null } } : r,
    );
    const nation = squad({ kind: 'nation' });
    const subjects = (level: 1 | 2 | 3) =>
      [1, 2, 3, 4, 5, 6, 7, 8].flatMap((seed) =>
        buildRound({ squad: nation, roster, level, seed, size: 10 }).map((q) => q.playerId),
      );

    it('is never the subject of a level-3 club question', () => {
      expect(subjects(3).filter((id) => clubless.has(id))).toEqual([]);
    });

    it('still fills a round of ten from the others', () => {
      expect(buildRound({ squad: nation, roster, level: 3, seed: 1, size: 10 })).toHaveLength(10);
    });

    it('stays a name option on level 3', () => {
      const names = new Set(
        [1, 2, 3, 4, 5, 6, 7, 8].flatMap((seed) =>
          buildRound({ squad: nation, roster, level: 3, seed, size: 10 }).flatMap(
            (q) => q.parts[0]?.options ?? [],
          ),
        ),
      );
      expect(names.has('GK 0')).toBe(true);
    });

    it('is asked on levels 1 and 2 like any player', () => {
      for (const level of [1, 2] as const) {
        expect(subjects(level).some((id) => clubless.has(id))).toBe(true);
      }
    });

    it('never puts a missing club among the options', () => {
      const rounds = buildRound({ squad: nation, roster, level: 3, seed: 2, size: 10 });
      for (const q of rounds) {
        expect(q.parts[2]?.options.every((o) => o !== null && o !== '')).toBe(true);
      }
    });

    it('throws when too few numbered players have a club to ask', () => {
      const few = roster.map((r, i) => (i < 4 ? r : { ...r, player: { ...r.player, club: null } }));
      expect(() => buildRound({ squad: nation, roster: few, level: 3, seed: 1 })).toThrow(
        /with a club/,
      );
    });
  });
});

describe('isQuestionCorrect', () => {
  it('requires every part to match, no partial credit', () => {
    const roster = buildClubRoster();
    const [q] = buildRound({ squad: squad(), roster, level: 2, seed: 5, size: 1 });
    if (!q) throw new Error('no question built');
    const rightIndexes = q.parts.map((p) => p.correctIndex);
    expect(isQuestionCorrect(q, rightIndexes)).toBe(true);

    const wrongIndexes = [...rightIndexes];
    wrongIndexes[wrongIndexes.length - 1] = -1;
    expect(isQuestionCorrect(q, wrongIndexes)).toBe(false);
  });
});

describe('the engine is language-free (#144)', () => {
  it('imports nothing from i18n', () => {
    const source = readFileSync(path.resolve(import.meta.dirname, '../questionEngine.ts'), 'utf-8');
    expect(source).not.toMatch(/from ['"]@\/i18n|from ['"]\.\.?\/i18n/);
  });

  it('asks nationalities by the English key the flag table is keyed by', () => {
    const round = buildRound({
      squad: squad(),
      roster: buildClubRoster(),
      level: 3,
      seed: 7,
      now: new Date('2026-01-01'),
    });
    const options = round.flatMap((q) =>
      q.parts.flatMap((part) => (part.kind === 'nationality' ? part.options : [])),
    );
    expect(options.length).toBeGreaterThan(0);
    for (const option of options) {
      expect(FLAG_BY_NATIONALITY[option]).toBeDefined();
    }
  });
});
