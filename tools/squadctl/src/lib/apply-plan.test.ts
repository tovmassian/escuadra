import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { RosterEnvelope } from '../../../../scripts/roster-envelope.ts';
import type { Player, Squad } from '../../../../types/squad.ts';
import {
  hasPlayerChanges,
  hasWritableChanges,
  isFileUnchanged,
  mergePlayers,
  squadPath,
  teamStatus,
  worstExit,
} from './apply-plan.ts';
import type { Conflict } from './assertions.ts';

// Exercises the pure functions imported below from ./apply-plan.ts. Each
// one's own doc comment there records a past regression in apply.ts's
// run(), the call site it was extracted from:
//   1. lastUpdated stability — a player's position correction elsewhere once
//      rewrote the lastUpdated of every unrelated squad that happened to
//      contain them. Covered below by `isFileUnchanged`.
//   2. write gating on `squadWrites.length` rather than a separate
//      players-dirty flag once silently discarded every change. Covered
//      below by `hasPlayerChanges` (the per-team flag) and
//      `hasWritableChanges` (the run-level gate).
//   3. the written/unchanged/conflicted status once reported teams as
//      written whose file would not change at all. Covered below by
//      `teamStatus`.
//
// None of this pins the regressions themselves. All three bugs lived at the
// call site in apply.ts, not inside these extracted expressions: reverting
// the write gate there to `if (!dryRun && squadWrites.length > 0)`, say,
// would reintroduce regression 2 while every test below stays green, since
// `hasWritableChanges(0, true)` is still `true` in isolation. Pinning the
// call-site regressions is what ../commands/apply.integration.test.ts is
// for — it drives the real command end to end against a fixture repo.

const marker = { bands: ['#FFFFFF', '#E20001'], orientation: 'vertical' as const };

function squad(over: Partial<Squad> = {}): Squad {
  return {
    id: 'sev',
    kind: 'club',
    name: 'Sevilla',
    season: '2026/27',
    primaryColor: '#FFFFFF',
    secondaryColor: '#E20001',
    verified: true,
    marker,
    lastUpdated: '2026-01-01',
    source: 'https://en.wikipedia.org/wiki/Sevilla_FC',
    members: [{ playerId: 'raya', no: 1 }],
    ...over,
  };
}

function player(over: Partial<Player> & { id: string; name: string }): Player {
  return {
    fullName: over.name,
    birth: '1995-01-01',
    position: 'MF',
    nationality: 'Spain',
    club: 'Sevilla',
    photo: null,
    ...over,
  };
}

function team(
  over: Partial<RosterEnvelope['team']> & Pick<RosterEnvelope['team'], 'id' | 'kind'>,
): RosterEnvelope['team'] {
  return {
    name: 'X',
    season: '2026/27',
    source: 'https://en.wikipedia.org/wiki/X',
    sectionTitle: 'Current squad',
    asOf: null,
    ...over,
  };
}

describe('isFileUnchanged', () => {
  it('reports changed when there is no stored squad', () => {
    expect(isFileUnchanged(squad(), null)).toBe(false);
  });

  it('reports unchanged when the only difference is lastUpdated', () => {
    const stored = squad({ lastUpdated: '2026-01-01' });
    const candidate = squad({ lastUpdated: '2026-09-08' });
    expect(isFileUnchanged(candidate, stored)).toBe(true);
  });

  it('reports changed on a real member change', () => {
    const stored = squad({ members: [{ playerId: 'raya', no: 1 }] });
    const candidate = squad({ members: [{ playerId: 'raya', no: 13 }] });
    expect(isFileUnchanged(candidate, stored)).toBe(false);
  });

  it('reports changed on a change to verified alone', () => {
    const stored = squad({ verified: true });
    const candidate = squad({ verified: false });
    expect(isFileUnchanged(candidate, stored)).toBe(false);
  });
});

describe('hasPlayerChanges', () => {
  it('is false when neither newPlayers nor updatedPlayers has anything', () => {
    expect(hasPlayerChanges([], [])).toBe(false);
  });

  it('is true when a player was newly created', () => {
    const newPlayers = [player({ id: 'new', name: 'New Signing' })];
    expect(hasPlayerChanges(newPlayers, [])).toBe(true);
  });

  it('is true when an existing player was updated', () => {
    const updatedPlayers = [player({ id: 'raya', name: 'David Raya' })];
    expect(hasPlayerChanges([], updatedPlayers)).toBe(true);
  });
});

describe('hasWritableChanges', () => {
  it('gates open on a player-only change with zero squad writes', () => {
    // Reproduces the exact scenario apply.ts's comment describes: a run that
    // only corrected a player field, touching no squad file at all. Keying
    // the write step on squadWrites.length alone once silently discarded
    // changes like this one.
    const updatedPlayers = [player({ id: 'raya', name: 'David Raya' })];
    const playersDirty = hasPlayerChanges([], updatedPlayers);
    expect(hasWritableChanges(0, playersDirty)).toBe(true);
  });

  it('gates open on a squad-file-only change with no player changes', () => {
    const playersDirty = hasPlayerChanges([], []);
    expect(hasWritableChanges(1, playersDirty)).toBe(true);
  });

  it('gates closed when there are neither squad writes nor player changes', () => {
    expect(hasWritableChanges(0, false)).toBe(false);
  });
});

describe('teamStatus', () => {
  const noConflicts: Conflict[] = [];
  const oneConflict: Conflict[] = [
    { kind: 'ambiguous-name', name: 'Ederson', candidateIds: ['a', 'b'] },
  ];

  it('reports written when the file changed and there are no conflicts', () => {
    expect(teamStatus({ conflicts: noConflicts, fileUnchanged: false })).toBe('written');
  });

  it('reports unchanged when the file matches and there are no conflicts', () => {
    expect(teamStatus({ conflicts: noConflicts, fileUnchanged: true })).toBe('unchanged');
  });

  it('reports conflicted, not unchanged, when the file matches but a conflict remains', () => {
    expect(teamStatus({ conflicts: oneConflict, fileUnchanged: true })).toBe('conflicted');
  });

  it('reports conflicted when the file changed too — conflicts outrank quietness either way', () => {
    expect(teamStatus({ conflicts: oneConflict, fileUnchanged: false })).toBe('conflicted');
  });
});

describe('mergePlayers', () => {
  it('an updated record replaces the stored one', () => {
    const stored = [player({ id: 'raya', name: 'David Raya', position: 'GK' })];
    const updated = [player({ id: 'raya', name: 'David Raya', position: 'DF' })];

    expect(mergePlayers(stored, [], updated)).toEqual([
      player({ id: 'raya', name: 'David Raya', position: 'DF' }),
    ]);
  });

  it('an added record wins over an updated one with the same id', () => {
    const updated = [player({ id: 'x', name: 'Updated Version' })];
    const added = [player({ id: 'x', name: 'Added Version' })];

    expect(mergePlayers([], added, updated)).toEqual([player({ id: 'x', name: 'Added Version' })]);
  });

  it('does not mutate its input arrays', () => {
    const stored = [player({ id: 'a', name: 'A' })];
    const added = [player({ id: 'b', name: 'B' })];
    const updated = [player({ id: 'a', name: 'A2' })];
    const storedBefore = structuredClone(stored);
    const addedBefore = structuredClone(added);
    const updatedBefore = structuredClone(updated);

    mergePlayers(stored, added, updated);

    expect(stored).toEqual(storedBefore);
    expect(added).toEqual(addedBefore);
    expect(updated).toEqual(updatedBefore);
  });
});

describe('squadPath', () => {
  it('resolves a nation squad under data/squads/nation/<id>.json', () => {
    expect(squadPath('/repo/data', team({ id: 'esp', kind: 'nation' }))).toBe(
      path.join('/repo/data', 'squads', 'nation', 'esp.json'),
    );
  });

  it('resolves a club squad under data/squads/club/<league>/<id>.json', () => {
    expect(squadPath('/repo/data', team({ id: 'sev', kind: 'club', league: 'la-liga' }))).toBe(
      path.join('/repo/data', 'squads', 'club', 'la-liga', 'sev.json'),
    );
  });
});

describe('worstExit', () => {
  it('escalates to the higher of the two candidates', () => {
    expect(worstExit(0, 5)).toBe(5);
    expect(worstExit(3, 4)).toBe(4);
  });

  it('never de-escalates: a lower candidate leaves a higher current value alone', () => {
    expect(worstExit(5, 0)).toBe(5);
    expect(worstExit(4, 3)).toBe(4);
  });

  it('holds steady when the candidate equals the current value', () => {
    expect(worstExit(4, 4)).toBe(4);
  });
});
