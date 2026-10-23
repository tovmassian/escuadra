import { describe, expect, it } from 'vitest';
import { en } from '@/i18n/en';
import { continueMeta, continueSpoken, homeView, type HomeContinue } from '@/lib/homeView';
import type { SquadManifestEntry } from '@/types/squad';

function entry(id: string, lastUpdated = '2026-10-01'): SquadManifestEntry {
  return { id, kind: 'nation', name: id, lastUpdated } as SquadManifestEntry;
}

const squads = [entry('esp'), entry('arm'), entry('rma')];
const base = { hydrated: true, lastPlayed: null, bestScores: {}, starred: [], squads };

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

  it('continues the last team at its level, with that level’s best', () => {
    const view = homeView({
      ...base,
      lastPlayed: { squadId: 'esp', level: 2 },
      bestScores: { 'esp:2': { score: 7, squadUpdated: '2026-10-01' } },
      starred: ['rma', 'gone', 'esp'],
    });
    expect(view.kind).toBe('returning');
    if (view.kind !== 'returning') return;
    expect(view.continue.squad.id).toBe('esp');
    expect(view.continue.level).toBe(2);
    expect(view.continue.best).toEqual({ score: 7, outdated: false });
    expect(view.starred.map((s) => s.id)).toEqual(['rma', 'esp']);
  });

  it('marks the best outdated when the squad has been updated since', () => {
    const view = homeView({
      ...base,
      lastPlayed: { squadId: 'esp', level: 1 },
      bestScores: { 'esp:1': { score: 9, squadUpdated: '2026-01-01' } },
    });
    expect(view.kind === 'returning' && view.continue.best).toEqual({ score: 9, outdated: true });
  });

  it('has no best for a level started but never finished', () => {
    const view = homeView({ ...base, lastPlayed: { squadId: 'esp', level: 3 } });
    expect(view.kind === 'returning' && view.continue.best).toBeUndefined();
  });
});

describe('Continue’s text', () => {
  const squad = entry('esp');
  const played: HomeContinue = { squad, level: 2, best: { score: 7, outdated: false } };

  it('shows the level and best in the meta line', () => {
    expect(continueMeta(played, en)).toBe('LEVEL 2 · BEST 7/10');
    expect(continueMeta({ squad, level: 3, best: undefined }, en)).toBe('LEVEL 3');
  });

  it('is spoken as the picker reads a row', () => {
    expect(continueSpoken('Spain', played, en)).toBe('Continue Spain, Level 2, best 7 of 10');
    expect(continueSpoken('Spain', { ...played, best: { score: 7, outdated: true } }, en)).toBe(
      'Continue Spain, Level 2, best 7 of 10, outdated',
    );
    expect(continueSpoken('Spain', { squad, level: 1, best: undefined }, en)).toBe(
      'Continue Spain, Level 1',
    );
  });
});
