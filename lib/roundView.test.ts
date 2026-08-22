import { describe, expect, it } from 'vitest';
import { progressOutcomes } from './roundView';
import type { QuestionResult } from '@/stores/session';

// These helpers only read `.correct`, so a minimal stub keeps the tests
// readable — building real Question objects would obscure what is asserted.
function result(correct: boolean | null): QuestionResult {
  return { question: { parts: [] } as unknown as QuestionResult['question'], parts: [], correct };
}

describe('progressOutcomes', () => {
  it('marks answered questions by their real outcome', () => {
    const outcomes = progressOutcomes([result(true), result(false), result(null)], 2);
    expect(outcomes[0]).toBe('correct');
    expect(outcomes[1]).toBe('wrong');
  });

  it('marks the current question as current even though it is unanswered', () => {
    expect(progressOutcomes([result(true), result(null), result(null)], 1)[1]).toBe('current');
  });

  it('marks questions after the current one as future', () => {
    expect(progressOutcomes([result(true), result(null), result(null)], 1)[2]).toBe('future');
  });

  it('keeps the current question current while its parts are still being answered', () => {
    // Invariant 9: no partial credit, so the bar must not advance mid-question.
    expect(progressOutcomes([result(null), result(null)], 0)[0]).toBe('current');
  });

  it('returns one outcome per question', () => {
    expect(progressOutcomes([result(true), result(null), result(null)], 1)).toHaveLength(3);
  });
});
