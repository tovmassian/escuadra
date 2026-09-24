import { describe, expect, it } from 'vitest';
import {
  focusedLevel,
  formatLastUpdated,
  ladderRows,
  playLabel,
  rungAccessibilityLabel,
} from './ladderView';

describe('ladderRows', () => {
  it('unlocks level 1 with no history at all', () => {
    expect(ladderRows('bar', {}, {})[0]?.status).toBe('unlocked');
  });

  it('locks levels 2 and 3 with no history at all', () => {
    const rows = ladderRows('bar', {}, {});
    expect(rows[1]?.status).toBe('locked');
    expect(rows[2]?.status).toBe('locked');
  });

  it('unlocks level 2 once level 1 is completed, even with a zero score', () => {
    // A legitimate 0/10 must still unlock — this is why `completedLevels`
    // exists separately from `bestScores`.
    expect(ladderRows('bar', { 'bar:1': 0 }, { 'bar:1': true })[1]?.status).toBe('unlocked');
  });

  it('reports a level with a recorded score as best, carrying the score', () => {
    const row = ladderRows('bar', { 'bar:1': 7 }, { 'bar:1': true })[0];
    expect(row?.status).toBe('best');
    expect(row?.best).toEqual({ correct: 7, total: 10 });
  });

  it('gives each locked level a hint naming the level that unlocks it', () => {
    const rows = ladderRows('bar', {}, {});
    expect(rows[1]?.unlockHint).toBe('Clear L1');
    expect(rows[2]?.unlockHint).toBe('Clear L2');
  });

  it('gives unlocked and best levels no unlock hint', () => {
    const rows = ladderRows('bar', { 'bar:1': 7 }, { 'bar:1': true });
    expect(rows[0]?.unlockHint).toBeUndefined();
    expect(rows[1]?.unlockHint).toBeUndefined();
  });

  it('does not leak progress between squads', () => {
    const rows = ladderRows('rma', { 'bar:1': 9 }, { 'bar:1': true });
    expect(rows[0]?.status).toBe('unlocked');
    expect(rows[1]?.status).toBe('locked');
  });

  it('returns exactly three rows in level order', () => {
    expect(ladderRows('bar', {}, {}).map((r) => r.level)).toEqual([1, 2, 3]);
  });
});

describe('formatLastUpdated', () => {
  it('formats an ISO date as day month year', () => {
    expect(formatLastUpdated('2026-08-21')).toBe('21 Aug 2026');
  });

  it('does not zero-pad the day', () => {
    expect(formatLastUpdated('2026-01-05')).toBe('5 Jan 2026');
  });
});

describe('focusedLevel', () => {
  it('focuses level 1 with no history at all', () => {
    expect(focusedLevel(ladderRows('bar', {}, {}))).toBe(1);
  });

  it('focuses the first level still to clear once earlier ones are played', () => {
    expect(focusedLevel(ladderRows('bar', { 'bar:1': 9 }, { 'bar:1': true }))).toBe(2);
  });

  it('focuses the last level, as a replay, once every level is played', () => {
    const rows = ladderRows(
      'bar',
      { 'bar:1': 9, 'bar:2': 7, 'bar:3': 8 },
      { 'bar:1': true, 'bar:2': true, 'bar:3': true },
    );
    expect(focusedLevel(rows)).toBe(3);
  });

  it('falls back to the highest played level when nothing is unlocked', () => {
    // A best score without its completion flag leaves the next level locked.
    const rows = ladderRows('bar', { 'bar:1': 9, 'bar:2': 7 }, { 'bar:1': true });
    expect(focusedLevel(rows)).toBe(2);
  });

  it('falls back to level 1 for an empty ladder', () => {
    expect(focusedLevel([])).toBe(1);
  });
});

describe('playLabel', () => {
  it('reads Play for a level not yet played', () => {
    expect(playLabel({ level: 1, status: 'unlocked' })).toBe('Play');
  });

  it('reads Play Again for a level with a best score', () => {
    expect(playLabel({ level: 1, status: 'best', best: { correct: 9, total: 10 } })).toBe(
      'Play Again',
    );
  });
});

describe('rungAccessibilityLabel', () => {
  it('announces a played rung with its best score', () => {
    const row = { level: 1, status: 'best', best: { correct: 9, total: 10 } } as const;
    expect(rungAccessibilityLabel(row, 'Name from Number')).toBe('Name from Number, best 9 of 10');
  });

  it('announces a locked rung with what unlocks it', () => {
    const row = { level: 3, status: 'locked', unlockHint: 'Clear L2' } as const;
    expect(rungAccessibilityLabel(row, 'Full Profile')).toBe('Full Profile, locked, Clear L2');
  });

  it('announces an unlocked rung by its title alone', () => {
    expect(rungAccessibilityLabel({ level: 2, status: 'unlocked' }, 'Name + Position')).toBe(
      'Name + Position',
    );
  });
});
