import { describe, expect, it } from 'vitest';
import { en } from '@/i18n/en';
import { continueMeta, continueSpoken, homeView, type HomeContinue } from '@/lib/homeView';
import type { SquadManifestEntry } from '@/types/squad';

const NOW = '2026-10-01';

function entry(id: string): SquadManifestEntry {
  return { id, kind: 'nation', name: id, lastUpdated: NOW } as SquadManifestEntry;
}

/** Best scores on the squad as of `date`: the current squad unless told. */
function scores(byKey: Record<string, number>, date = NOW) {
  return Object.fromEntries(
    Object.entries(byKey).map(([key, score]) => [key, { score, squadUpdated: date }]),
  );
}

const squads = [entry('esp'), entry('arm'), entry('rma')];
const base = { hydrated: true, lastPlayed: null, bestScores: {}, starred: [], squads };

/** Continue for Spain, last played at `level`, with these bests. */
function continueFor(byKey: Record<string, number>, level = 1, date = NOW): HomeContinue {
  const view = homeView({
    ...base,
    lastPlayed: { squadId: 'esp', level },
    bestScores: scores(byKey, date),
  });
  if (view.kind !== 'returning') throw new Error(`expected returning, got ${view.kind}`);
  return view.continue;
}

describe('homeView', () => {
  it('waits for the store to hydrate', () => {
    expect(homeView({ ...base, hydrated: false })).toEqual({ kind: 'loading' });
  });

  it('is first run with nothing played', () => {
    expect(homeView(base)).toEqual({ kind: 'firstRun', starred: [] });
  });

  it('is first run when the last team has left the data', () => {
    expect(homeView({ ...base, lastPlayed: { squadId: 'gone', level: 2 } }).kind).toBe('firstRun');
  });

  it('keeps the starred teams on first run', () => {
    const view = homeView({ ...base, starred: ['arm'] });
    expect(view.kind === 'firstRun' && view.starred.map((s) => s.id)).toEqual(['arm']);
  });

  it('continues the last team, keeping the starred teams that are still in the data', () => {
    const view = homeView({
      ...base,
      lastPlayed: { squadId: 'esp', level: 2 },
      starred: ['rma', 'gone', 'esp'],
    });
    expect(view.kind === 'returning' && view.continue.squad.id).toBe('esp');
    expect(view.kind === 'returning' && view.starred.map((s) => s.id)).toEqual(['rma', 'esp']);
  });
});

describe('Continue points at the nearest level still to clear', () => {
  it('is the next level after a cleared one, not the one last played', () => {
    expect(continueFor({ 'esp:1': 10 }, 1)).toMatchObject({ level: 2, best: undefined });
  });

  it('is a level played below the bar, with its best', () => {
    expect(continueFor({ 'esp:1': 9, 'esp:2': 6 }, 1)).toMatchObject({
      level: 2,
      best: { score: 6, outdated: false },
      escuadra: false,
    });
  });

  it('is the last level once every level is cleared', () => {
    expect(continueFor({ 'esp:1': 9, 'esp:2': 8, 'esp:3': 9 }, 1)).toMatchObject({
      level: 3,
      best: { score: 9, outdated: false },
      escuadra: false,
    });
  });

  it('is a la escuadra when the last level is a current 10/10', () => {
    expect(continueFor({ 'esp:1': 9, 'esp:2': 8, 'esp:3': 10 }).escuadra).toBe(true);
  });

  it('is not a la escuadra when that 10/10 is outdated', () => {
    const c = continueFor({ 'esp:1': 9, 'esp:2': 8, 'esp:3': 10 }, 3, '2026-01-01');
    expect(c).toMatchObject({ level: 3, best: { score: 10, outdated: true }, escuadra: false });
  });
});

describe('Continue’s text', () => {
  const squad = entry('esp');
  const played: HomeContinue = {
    squad,
    level: 2,
    best: { score: 7, outdated: false },
    escuadra: false,
  };
  const unplayed: HomeContinue = { squad, level: 2, best: undefined, escuadra: false };
  const done: HomeContinue = {
    squad,
    level: 3,
    best: { score: 10, outdated: false },
    escuadra: true,
  };

  it('shows the level and its best, or that it is not played yet', () => {
    expect(continueMeta(played, en)).toBe('LEVEL 2 · BEST 7/10');
    expect(continueMeta(unplayed, en)).toBe('LEVEL 2 · Not played yet');
  });

  it('shows a la escuadra once the squad is done', () => {
    expect(continueMeta(done, en)).toBe('a la escuadra');
  });

  it('is spoken as one button', () => {
    expect(continueSpoken('Spain', played, en)).toBe('Continue Spain, Level 2, best 7 of 10');
    expect(continueSpoken('Spain', { ...played, best: { score: 7, outdated: true } }, en)).toBe(
      'Continue Spain, Level 2, best 7 of 10, outdated',
    );
    expect(continueSpoken('Spain', unplayed, en)).toBe('Continue Spain, Level 2, Not played yet');
    expect(continueSpoken('Spain', done, en)).toBe('Continue Spain, a la escuadra');
  });
});
