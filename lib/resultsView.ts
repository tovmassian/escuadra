// Pure results-screen model. Kept out of the screen so invariant 10's rules
// are unit-testable.

/**
 * Shared pass threshold: the results screen's pass/fail verdict and the
 * picker's "cleared" badge are the same concept, so they share one constant
 * rather than two values that can silently drift apart.
 */
export const PASS_RATIO = 0.8;

export type ActionId = 'nextLevel' | 'retry' | 'studyMissed' | 'study' | 'chooseTeam';

/**
 * Ordered actions for the results screen, primary first.
 *
 * Invariant 10: the set varies by pass/fail and by whether the level ceiling
 * is reached. Passing below the ceiling advances; passing at the ceiling has
 * nowhere to advance to, so it points at a new team. Failing puts the missed
 * list first — for a study tool the misses are the result, and retrying the
 * round you just failed teaches nothing.
 */
export function actionOrder(opts: {
  passed: boolean;
  hasNextLevel: boolean;
  missedCount: number;
}): ActionId[] {
  const { passed, hasNextLevel, missedCount } = opts;

  const primary: ActionId = passed
    ? hasNextLevel
      ? 'nextLevel'
      : 'chooseTeam'
    : missedCount > 0
      ? 'studyMissed'
      : 'retry';

  const rest: ActionId[] = (['studyMissed', 'retry', 'study', 'chooseTeam'] as const).filter(
    (id) => id !== primary && (id !== 'studyMissed' || missedCount > 0),
  );

  return [primary, ...rest];
}
