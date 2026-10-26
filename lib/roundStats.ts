// What a round's statistics say about it (#221): which part each miss failed on,
// the best it had to beat, and what a round thrown away unfinished had reached.
// Pure, so the question screen's signals are unit-tested.

import type { BestScore } from '@/lib/bestScore';
import type { Level } from '@/lib/questionEngine';
import type { PreviousBest } from '@/lib/telemetryEvents';
import type { QuestionResult, SessionPhase } from '@/stores/session';

export interface Misses {
  missedName: number;
  /** Levels 2 and 3. */
  missedPosition?: number;
  /** Level 3: the nationality for a club squad, the club for a nation. */
  missedClubOrNationality?: number;
}

/**
 * Each missed question counted once, against the first part answered wrong:
 * grading stops there (`stores/session.ts`), so the later parts were never asked.
 */
export function missesByPart(results: readonly QuestionResult[], level: Level): Misses {
  let name = 0;
  let position = 0;
  let third = 0;
  for (const result of results) {
    if (result.correct !== false) continue;
    const wrong = result.parts.findIndex((p) => p !== null && !p.correct);
    const kind = result.question.parts[wrong]?.kind;
    if (kind === 'name') name += 1;
    else if (kind === 'position') position += 1;
    else if (kind === 'club' || kind === 'nationality') third += 1;
  }
  return {
    missedName: name,
    ...(level >= 2 ? { missedPosition: position } : {}),
    ...(level >= 3 ? { missedClubOrNationality: third } : {}),
  };
}

/** The best this round had to beat, read before the round's score is recorded. */
export function previousBestValue(best: BestScore | undefined): PreviousBest {
  return best === undefined ? 'none' : best.score;
}

/** The session fields `leftRound` reads. */
export interface RoundSnapshot {
  phase: SessionPhase;
  squadId: string | null;
  level: Level | null;
  currentIndex: number;
  results: readonly QuestionResult[];
  activeMs: number;
}

export interface LeftRound {
  squad: string;
  level: Level;
  /** The question on screen, 1 to 10. */
  question: number;
  /** Questions right so far. */
  score: number;
  activeMs: number;
}

/** A round in progress, as it stood when thrown away; null when none is. */
export function leftRound(session: RoundSnapshot): LeftRound | null {
  if (session.phase !== 'playing' || session.squadId === null || session.level === null) {
    return null;
  }
  return {
    squad: session.squadId,
    level: session.level,
    question: session.currentIndex + 1,
    score: session.results.filter((r) => r.correct === true).length,
    activeMs: session.activeMs,
  };
}
