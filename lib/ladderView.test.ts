import { describe, expect, it } from 'vitest';
import { ladderRows } from './ladderView';

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
