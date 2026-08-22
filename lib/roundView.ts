// Pure view-model helpers for the play screen. No React and no store values —
// only types — so this stays unit-testable, since the project's Vitest setup
// has no React Native renderer.
import type { QuestionResult } from '@/stores/session';

export type DotOutcome = 'correct' | 'wrong' | 'current' | 'future';

/**
 * One outcome per question, for the progress bar.
 *
 * Invariant 9: the bar counts questions, not parts. A question stays
 * `current` until its last part resolves, so a level-3 question does not
 * advance the bar three times.
 */
export function progressOutcomes(results: QuestionResult[], currentIndex: number): DotOutcome[] {
  return results.map((r, i) => {
    if (r.correct === true) return 'correct';
    if (r.correct === false) return 'wrong';
    return i === currentIndex ? 'current' : 'future';
  });
}
