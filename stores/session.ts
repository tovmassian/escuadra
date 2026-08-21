// Ephemeral round state — deliberately NOT wrapped in zustand's `persist`.
// A half-finished round must not survive an app restart (CLAUDE.md). Plain
// in-memory zustand state already survives ordinary navigation within one JS
// runtime (Question -> Results), which is all "resume mid-round" ever needs;
// it's gone the moment the app is actually killed and reopened. Do not
// "helpfully" add persistence here later — that's the bug this comment exists
// to prevent.
import { create } from 'zustand';
import { buildRound, isQuestionCorrect, type Level, type Question } from '@/lib/questionEngine';
import type { RosterEntry, Squad } from '@/types/squad';

export interface AnsweredPart {
  pickedIndex: number;
  correct: boolean;
}

export interface QuestionResult {
  question: Question;
  parts: (AnsweredPart | null)[];
  /** null until the question's last part is answered. */
  correct: boolean | null;
}

export type SessionPhase = 'idle' | 'playing' | 'complete';

interface SessionState {
  squadId: string | null;
  squadName: string | null;
  level: Level | null;
  questions: Question[];
  currentIndex: number;
  /** Drives progressive reveal/collapse within one question (L2 has 2 parts, L3 has 3). */
  currentPartIndex: number;
  results: QuestionResult[];
  phase: SessionPhase;

  startRound: (squad: Squad, roster: RosterEntry[], level: Level) => void;
  /** Grades the current part, advances to the next part, or finalizes the
   *  question (via `isQuestionCorrect` — no partial credit) on the last part. */
  answerPart: (pickedIndex: number) => void;
  /** Continue button: moves to the next question, or flips phase to 'complete'. */
  advanceQuestion: () => void;
  reset: () => void;
}

const initialState = {
  squadId: null,
  squadName: null,
  level: null,
  questions: [],
  currentIndex: 0,
  currentPartIndex: 0,
  results: [],
  phase: 'idle' as SessionPhase,
};

export const useSession = create<SessionState>()((set, get) => ({
  ...initialState,

  startRound: (squad, roster, level) => {
    const questions = buildRound({ squad, roster, level, seed: Date.now() });
    set({
      squadId: squad.id,
      squadName: squad.name,
      level,
      questions,
      currentIndex: 0,
      currentPartIndex: 0,
      results: questions.map((question) => ({
        question,
        parts: question.parts.map(() => null),
        correct: null,
      })),
      phase: 'playing',
    });
  },

  answerPart: (pickedIndex) => {
    const { questions, currentIndex, currentPartIndex, results } = get();
    const question = questions[currentIndex];
    const part = question?.parts[currentPartIndex];
    const existing = results[currentIndex];
    if (!question || !part || !existing) return;

    const isCorrect = pickedIndex === part.correctIndex;
    const nextParts = existing.parts.slice();
    nextParts[currentPartIndex] = { pickedIndex, correct: isCorrect };

    const isLastPart = currentPartIndex === question.parts.length - 1;
    // No partial credit, so a wrong pick already dooms the question — stop
    // asking the remaining parts and grade it immediately instead of
    // marching through position/nationality/club for a question that's
    // already lost.
    const isQuestionOver = !isCorrect || isLastPart;
    const overallCorrect = isQuestionOver
      ? isQuestionCorrect(
          question,
          nextParts.map((p) => p?.pickedIndex ?? null),
        )
      : null;

    const nextResults = results.slice();
    nextResults[currentIndex] = { ...existing, parts: nextParts, correct: overallCorrect };

    set({
      results: nextResults,
      currentPartIndex: isQuestionOver ? currentPartIndex : currentPartIndex + 1,
    });
  },

  advanceQuestion: () => {
    const { currentIndex, questions } = get();
    if (currentIndex >= questions.length - 1) {
      set({ phase: 'complete' });
      return;
    }
    set({ currentIndex: currentIndex + 1, currentPartIndex: 0 });
  },

  reset: () => set(initialState),
}));

export function selectScore(results: QuestionResult[]): { correct: number; attempted: number } {
  let correct = 0;
  let attempted = 0;
  for (const r of results) {
    if (r.correct !== null) attempted += 1;
    if (r.correct === true) correct += 1;
  }
  return { correct, attempted };
}

export function selectMissed(results: QuestionResult[]): QuestionResult[] {
  return results.filter((r) => r.correct === false);
}

/** Label + value for whichever part of a missed question was first wrong —
 *  not always the name (a right name can still fail on position/nationality/club). */
export function firstWrongPart(
  result: QuestionResult,
): { partIndex: number; pickedLabel: string } | null {
  for (let i = 0; i < result.parts.length; i++) {
    const answered = result.parts[i];
    const part = result.question.parts[i];
    if (!answered || !part || answered.correct) continue;
    return { partIndex: i, pickedLabel: part.options[answered.pickedIndex] ?? '—' };
  }
  return null;
}
