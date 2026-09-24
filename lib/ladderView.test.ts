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
    expect(ladderRows('bar', {})[0]?.status).toBe('unlocked');
  });

  it('locks levels 2 and 3 with no history at all', () => {
    const rows = ladderRows('bar', {});
    expect(rows[1]?.status).toBe('locked');
    expect(rows[2]?.status).toBe('locked');
  });

  it('keeps level 2 locked after a failed level 1', () => {
    // The results screen calls 5/10 a fail and offers a retry; the ladder
    // must agree rather than open the next level for merely finishing.
    expect(ladderRows('bar', { 'bar:1': 5 })[1]?.status).toBe('locked');
  });

  it('keeps level 2 locked one short of the pass mark', () => {
    expect(ladderRows('bar', { 'bar:1': 7 })[1]?.status).toBe('locked');
  });

  it('unlocks level 2 once level 1 reaches the pass mark', () => {
    expect(ladderRows('bar', { 'bar:1': 8 })[1]?.status).toBe('unlocked');
  });

  it('locks a level whose predecessor is locked, even if it has its own score', () => {
    // Scores recorded while the gate was lenient don't reopen a level whose
    // way in is still shut.
    const rows = ladderRows('bar', { 'bar:1': 5, 'bar:2': 9 });
    expect(rows[1]?.status).toBe('locked');
    expect(rows[2]?.status).toBe('locked');
  });

  it('reports a passed level as cleared, carrying the score', () => {
    const row = ladderRows('bar', { 'bar:1': 9 })[0];
    expect(row?.status).toBe('cleared');
    expect(row?.best).toEqual({ correct: 9, total: 10 });
  });

  it('keeps a failed level unlocked, carrying the score', () => {
    const row = ladderRows('bar', { 'bar:1': 5 })[0];
    expect(row?.status).toBe('unlocked');
    expect(row?.best).toEqual({ correct: 5, total: 10 });
  });

  it('shows no score on a locked level', () => {
    expect(ladderRows('bar', { 'bar:1': 5, 'bar:2': 9 })[1]?.best).toBeUndefined();
  });

  it('gives each locked level a hint naming the score that unlocks it', () => {
    const rows = ladderRows('bar', {});
    expect(rows[1]?.unlockHint).toBe('Score 8/10 on L1');
    expect(rows[2]?.unlockHint).toBe('Score 8/10 on L2');
  });

  it('gives open levels no unlock hint', () => {
    const rows = ladderRows('bar', { 'bar:1': 9 });
    expect(rows[0]?.unlockHint).toBeUndefined();
    expect(rows[1]?.unlockHint).toBeUndefined();
  });

  it('does not leak progress between squads', () => {
    const rows = ladderRows('rma', { 'bar:1': 9 });
    expect(rows[0]?.status).toBe('unlocked');
    expect(rows[1]?.status).toBe('locked');
  });

  it('returns exactly three rows in level order', () => {
    expect(ladderRows('bar', {}).map((r) => r.level)).toEqual([1, 2, 3]);
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
    expect(focusedLevel(ladderRows('bar', {}))).toBe(1);
  });

  it('focuses the next level once the one before it is cleared', () => {
    expect(focusedLevel(ladderRows('bar', { 'bar:1': 9 }))).toBe(2);
  });

  it('stays on a failed level, for a retry', () => {
    expect(focusedLevel(ladderRows('bar', { 'bar:1': 5 }))).toBe(1);
  });

  it('focuses the last level, as a replay, once every level is cleared', () => {
    expect(focusedLevel(ladderRows('bar', { 'bar:1': 9, 'bar:2': 8, 'bar:3': 8 }))).toBe(3);
  });

  it('falls back to level 1 for an empty ladder', () => {
    expect(focusedLevel([])).toBe(1);
  });
});

describe('playLabel', () => {
  it('reads Play for a level not yet played', () => {
    expect(playLabel({ level: 1, status: 'unlocked' })).toBe('Play');
  });

  it('reads Play Again for a cleared level', () => {
    expect(playLabel({ level: 1, status: 'cleared', best: { correct: 9, total: 10 } })).toBe(
      'Play Again',
    );
  });

  it('reads Play Again for a level played but not yet cleared', () => {
    expect(playLabel({ level: 1, status: 'unlocked', best: { correct: 5, total: 10 } })).toBe(
      'Play Again',
    );
  });
});

describe('rungAccessibilityLabel', () => {
  it('announces a cleared rung with its best score', () => {
    const row = { level: 1, status: 'cleared', best: { correct: 9, total: 10 } } as const;
    expect(rungAccessibilityLabel(row, 'Name from Number')).toBe('Name from Number, best 9 of 10');
  });

  it('announces a locked rung with what unlocks it', () => {
    const row = { level: 3, status: 'locked', unlockHint: 'Score 8/10 on L2' } as const;
    expect(rungAccessibilityLabel(row, 'Full Profile')).toBe(
      'Full Profile, locked, Score 8/10 on L2',
    );
  });

  it('announces an unlocked rung by its title alone', () => {
    expect(rungAccessibilityLabel({ level: 2, status: 'unlocked' }, 'Name + Position')).toBe(
      'Name + Position',
    );
  });
});
