// Pure results-screen model. Kept out of the screen so invariant 10's rules
// are unit-testable.

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
    (id) =>
      id !== primary &&
      (id !== 'studyMissed' || missedCount > 0) &&
      // studyMissed strictly supersedes study whenever it's on offer: studying
      // the exact players you missed beats studying the whole squad. The full
      // squad list is still reachable from the difficulty screen, so this is
      // never a dead end.
      (id !== 'study' || missedCount === 0),
  );

  return [primary, ...rest];
}

/**
 * A la escuadra — the flawless round the product is named for.
 *
 * A round with nothing attempted is not flawless: 0/0 is vacuously perfect
 * and must not trigger the celebration.
 */
export function isFlawless(correct: number, attempted: number): boolean {
  return attempted > 0 && correct === attempted;
}
