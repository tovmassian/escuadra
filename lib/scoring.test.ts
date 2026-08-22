import { describe, expect, it } from 'vitest';
import { PASS_RATIO, ROUND_LENGTH, scoreKey } from './scoring';

// Deliberate drift guards: these are literal pins, not derived checks. Their
// purpose is to force a reviewer to notice and re-justify any change to a
// value the picker, ladder, question engine and results screen all agree on.
describe('ROUND_LENGTH', () => {
  it('is 10, the round length the whole app agrees on', () => {
    expect(ROUND_LENGTH).toBe(10);
  });
});

describe('PASS_RATIO', () => {
  it('is the shared pass threshold used by both the picker and results screens', () => {
    expect(PASS_RATIO).toBe(0.8);
  });
});

describe('scoreKey', () => {
  it('joins squad and level into the bestScores/completedLevels storage key', () => {
    expect(scoreKey('barcelona', 2)).toBe('barcelona:2');
  });
});
