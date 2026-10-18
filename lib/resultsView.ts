// Pure results-screen model. Kept out of the screen so invariant 10's rules
// are unit-testable.

import { A_LA_ESCUADRA_TITLE } from '@/i18n/names';
import type { Messages } from '@/i18n/en';
import type { SupportedLanguage } from '@/i18n/resolveLanguage';
import { optionText } from '@/lib/roundView';
import { PASS_RATIO, ROUND_LENGTH } from '@/lib/scoring';
import type { QuestionResult } from '@/stores/session';

/**
 * A la escuadra — the flawless round the product is named for.
 *
 * A round with nothing attempted is not flawless: 0/0 is vacuously perfect
 * and must not trigger the celebration.
 */
export function isFlawless(correct: number, attempted: number): boolean {
  return attempted > 0 && correct === attempted;
}

/**
 * The results screen's success mark renders in one of two tones once the
 * round is passed: `passed` (ball green, frame accent) below a flawless
 * score, `excellent` (both green) at a flawless one. Below `PASS_RATIO`
 * there is no success mark at all.
 *
 * Deliberately reuses `PASS_RATIO` rather than a second range constant —
 * moving the pass bar (e.g. to 5/10) moves this split with it, so the
 * pass/fail verdict, the picker's "cleared" badge, and this tier can never
 * drift out of sync with each other.
 */
export type ResultTier = 'fail' | 'passed' | 'excellent';

export function resultTier(correct: number, attempted: number): ResultTier {
  if (isFlawless(correct, attempted)) return 'excellent';
  if (attempted > 0 && correct / attempted >= PASS_RATIO) return 'passed';
  return 'fail';
}

export type PrimaryAction = 'nextLevel' | 'retry' | 'chooseTeam';

export interface ResultActions {
  primary: PrimaryAction;
  secondary: 'study';
  /** Retry as an icon beside Study, whenever retry isn't the main button. */
  retryIcon: boolean;
}

/**
 * Invariant 10 (spec §3.2):
 * - A failed round's main button retries it.
 * - A pass plays the next level, or, at level 3, chooses a different team.
 * - Study this squad is always the second action.
 * - The screen's close button always chooses a different team.
 */
export function resultActions(passed: boolean, hasNextLevel: boolean): ResultActions {
  const primary: PrimaryAction = passed ? (hasNextLevel ? 'nextLevel' : 'chooseTeam') : 'retry';
  return { primary, secondary: 'study', retryIcon: primary !== 'retry' };
}

export interface ResultCopy {
  title: string;
  verdict: string;
}

/** The tier's title and one line of verdict (spec §3.1). */
export function resultCopy(
  {
    tier,
    level,
    teamName,
    season,
  }: {
    tier: ResultTier;
    level: number;
    teamName: string;
    season: string;
  },
  messages: Messages,
): ResultCopy {
  const { results } = messages;
  if (tier === 'excellent') {
    return {
      title: A_LA_ESCUADRA_TITLE,
      verdict: results.flawlessVerdict(teamName, season, level),
    };
  }
  if (tier === 'passed') {
    return { title: results.clearedTitle(level), verdict: results.clearedVerdict };
  }
  const target = `${Math.ceil(PASS_RATIO * ROUND_LENGTH)}/${ROUND_LENGTH}`;
  return {
    title: results.failTitle,
    verdict: level >= 3 ? results.toClear(target, level) : results.toUnlock(target, level + 1),
  };
}

/**
 * A missed card's line, naming the first wrong part (spec §3.1):
 * - the name: "You picked …";
 * - a later part: what was right first, then the real value and the pick.
 * Empty when no part is wrong.
 */
export function missedLine(
  result: QuestionResult,
  language: SupportedLanguage,
  messages: Messages,
): string {
  const { results } = messages;
  for (let i = 0; i < result.parts.length; i++) {
    const answered = result.parts[i];
    const part = result.question.parts[i];
    if (!answered || !part || answered.correct) continue;
    const picked = optionText(part, answered.pickedIndex, language, messages);
    if (part.kind === 'name') return results.youPicked(picked);
    const right = optionText(part, part.correctIndex, language, messages);
    const before = i === 1 ? results.nameRight : results.nameAndPositionRight;
    return `${before} · ${results.wrongPart[part.kind](right, picked)}`;
  }
  return '';
}
