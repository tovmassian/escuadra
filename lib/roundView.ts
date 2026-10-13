// Pure view-model helpers for the play screen. No React and no store values —
// only types — so this stays unit-testable, since the project's Vitest setup
// has no React Native renderer.
import type { Level, Question, QuestionPart } from '@/lib/questionEngine';
import type { QuestionResult } from '@/stores/session';
import {
  heroCardMinSize,
  heroCardSize,
  heroFitHeight,
  heroNumberSize,
  heroTab,
} from '@/theme/tokens';

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

export type PartState = 'answered-correct' | 'answered-wrong' | 'current' | 'upcoming';

export interface PartRailRow {
  label: string;
  state: PartState;
  /** The option the player actually picked, or null while unanswered. */
  answer: string | null;
}

function partLabel(part: QuestionPart): string {
  switch (part.kind) {
    case 'name':
      return 'NAME';
    case 'position':
      return 'POSITION';
    case 'nationality':
      return 'NATIONALITY';
    case 'club':
      return 'CLUB';
  }
}

/**
 * One row per part of the current question.
 *
 * Invariant 8: a row shows a verdict only where one was actually earned, and
 * reports the option the player picked rather than the correct one.
 *
 * Invariant 7: asking stops on a wrong part, so a part that has not been
 * answered is `current` only when it is genuinely the active index —
 * everything else is `upcoming`, never accented.
 */
export function partRailRows(
  question: Question,
  result: QuestionResult,
  currentPartIndex: number,
): PartRailRow[] {
  return question.parts.map((part, i) => {
    const answeredPart = result.parts[i];
    const label = partLabel(part);

    if (answeredPart) {
      return {
        label,
        state: answeredPart.correct ? 'answered-correct' : 'answered-wrong',
        answer: part.options[answeredPart.pickedIndex] ?? null,
      };
    }
    return { label, state: i === currentPartIndex ? 'current' : 'upcoming', answer: null };
  });
}

export interface HeroCardFit {
  size: number;
  numberSize: number;
}

/**
 * The hero card's size for a screen with `usableHeight` points between its
 * safe-area insets. Full size when the level fits; otherwise the card gives up
 * exactly the missing height, so every option stays on screen without
 * scrolling, down to the level's floor. The card stays square either way —
 * the photo slot it reserves keeps its shape.
 */
export function fitHeroCard(level: Level, usableHeight: number): HeroCardFit {
  const full = heroCardSize[level];
  const missing = Math.max(0, heroFitHeight[level] - usableHeight);
  const size = Math.max(heroCardMinSize[level], full - Math.ceil(missing));
  return { size, numberSize: Math.round((heroNumberSize[level] * size) / full) };
}

export interface HeroTabMetrics {
  thickness: number;
  numberSize: number;
  fillet: number;
  padStart: number;
  padEnd: number;
}

/** The photo hero's number tab for a hero of side `size` (Photo POC). */
export function heroTabMetrics(size: number): HeroTabMetrics {
  const thickness = Math.max(heroTab.minThickness, Math.round(size * heroTab.thicknessRatio));
  return {
    thickness,
    numberSize: Math.max(heroTab.minNumberSize, Math.round(thickness * heroTab.numberRatio)),
    fillet: heroTab.fillet,
    padStart: Math.round(thickness * heroTab.padStartRatio),
    padEnd: Math.round(thickness * heroTab.padEndRatio),
  };
}
