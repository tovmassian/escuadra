// A best score and the squad version it was set on (#180). Pure, so the
// progress store, its migration and the views share one set of rules.

export interface BestScore {
  /** Correct answers out of `ROUND_LENGTH`. */
  score: number;
  /** The squad's `lastUpdated` when this score was set. */
  squadUpdated: string;
}

/** Set before the squad was last updated: the squad's date has moved on. */
export function isOutdated(best: BestScore, lastUpdated: string): boolean {
  return best.squadUpdated !== lastUpdated;
}

/** The best after a round of `score` on the squad as of `lastUpdated`. A round
 *  on the current squad replaces an outdated best whatever its value; among
 *  rounds on the current squad, the higher score wins. */
export function nextBest(
  prev: BestScore | undefined,
  score: number,
  lastUpdated: string,
): BestScore {
  if (prev === undefined || isOutdated(prev, lastUpdated) || score > prev.score) {
    return { score, squadUpdated: lastUpdated };
  }
  return prev;
}

/** Version 0 kept bare numbers. Each gets its squad's current date, so a
 *  score saved before #180 counts as current; a squad no longer in the data
 *  gets an empty date, which reads as outdated if it ever returns. */
export function migrateBestScores(
  scores: Record<string, number>,
  lastUpdatedOf: (squadId: string) => string | undefined,
): Record<string, BestScore> {
  const migrated: Record<string, BestScore> = {};
  for (const [key, score] of Object.entries(scores)) {
    // The key is `${squadId}:${level}` (`scoreKey`); squad ids hold no colon.
    const squadId = key.slice(0, key.lastIndexOf(':'));
    migrated[key] = { score, squadUpdated: lastUpdatedOf(squadId) ?? '' };
  }
  return migrated;
}
