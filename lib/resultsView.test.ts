import { describe, expect, it } from 'vitest';
import { actionOrder, isFlawless, PASS_RATIO } from './resultsView';

describe('actionOrder', () => {
  it('offers the next level first when the player passed below the ceiling', () => {
    const actions = actionOrder({ passed: true, hasNextLevel: true, missedCount: 2 });
    expect(actions[0]).toBe('nextLevel');
  });

  it('offers a new team first when the player passed at the ceiling', () => {
    // Invariant 10: nothing to advance to, so do not dangle a next level.
    const actions = actionOrder({ passed: true, hasNextLevel: false, missedCount: 1 });
    expect(actions[0]).toBe('chooseTeam');
    expect(actions).not.toContain('nextLevel');
  });

  it('offers studying the missed players first when the player failed', () => {
    const actions = actionOrder({ passed: false, hasNextLevel: true, missedCount: 3 });
    expect(actions[0]).toBe('studyMissed');
  });

  it('falls back to retry as primary when the player failed but missed nothing', () => {
    // Defensive: a 0-attempted round has no missed list to study.
    const actions = actionOrder({ passed: false, hasNextLevel: true, missedCount: 0 });
    expect(actions[0]).toBe('retry');
    expect(actions).not.toContain('studyMissed');
  });

  it('never offers studyMissed when there are no missed players', () => {
    const actions = actionOrder({ passed: true, hasNextLevel: true, missedCount: 0 });
    expect(actions).not.toContain('studyMissed');
  });

  it('always offers a way to leave for another team', () => {
    for (const passed of [true, false]) {
      for (const hasNextLevel of [true, false]) {
        expect(actionOrder({ passed, hasNextLevel, missedCount: 2 })).toContain('chooseTeam');
      }
    }
  });

  it('never repeats an action', () => {
    const actions = actionOrder({ passed: false, hasNextLevel: true, missedCount: 3 });
    expect(new Set(actions).size).toBe(actions.length);
  });

  it('never offers both studyMissed and study in the same list', () => {
    // studyMissed strictly supersedes study when it's on offer: studying the
    // exact players you missed beats studying the whole squad. The full
    // squad list is still reachable from the difficulty screen.
    for (const passed of [true, false]) {
      for (const hasNextLevel of [true, false]) {
        for (const missedCount of [0, 1, 3]) {
          const actions = actionOrder({ passed, hasNextLevel, missedCount });
          const hasBoth = actions.includes('studyMissed') && actions.includes('study');
          expect(hasBoth).toBe(false);
        }
      }
    }
  });
});

describe('PASS_RATIO', () => {
  it('is the shared pass threshold used by both the picker and results screens', () => {
    expect(PASS_RATIO).toBe(0.8);
  });
});

describe('isFlawless', () => {
  it('is true for a full round with every question correct', () => {
    expect(isFlawless(10, 10)).toBe(true);
  });

  it('is false when a single question was missed', () => {
    expect(isFlawless(9, 10)).toBe(false);
  });

  it('is false for a round with nothing attempted', () => {
    // 0/0 is vacuously "all correct" — guard against celebrating an empty round.
    expect(isFlawless(0, 0)).toBe(false);
  });

  it('is true for a short but complete round', () => {
    expect(isFlawless(3, 3)).toBe(true);
  });
});
