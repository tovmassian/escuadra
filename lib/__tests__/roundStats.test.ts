import { describe, expect, it } from 'vitest';
import type { Question, QuestionPart } from '@/lib/questionEngine';
import type { QuestionResult } from '@/stores/session';
import { leftRound, missesByPart, previousBestValue, type RoundSnapshot } from '../roundStats';

const part = (kind: QuestionPart['kind']): QuestionPart =>
  ({ kind, options: [], correctIndex: 0 }) as unknown as QuestionPart;

const LEVEL_3_CLUB: QuestionPart[] = [part('name'), part('position'), part('nationality')];

/** A question answered right up to `wrongAt` (a part index), or all right when null. */
function answered(parts: QuestionPart[], wrongAt: number | null): QuestionResult {
  const question = { parts } as unknown as Question;
  if (wrongAt === null) {
    return {
      question,
      parts: parts.map(() => ({ pickedIndex: 0, correct: true })),
      correct: true,
    };
  }
  return {
    question,
    parts: parts.map((_, i) =>
      i < wrongAt
        ? { pickedIndex: 0, correct: true }
        : i === wrongAt
          ? { pickedIndex: 1, correct: false }
          : null,
    ),
    correct: false,
  };
}

const unanswered = (parts: QuestionPart[]): QuestionResult => ({
  question: { parts } as unknown as Question,
  parts: parts.map(() => null),
  correct: null,
});

describe('missesByPart', () => {
  it('counts each miss once, against the first part answered wrong', () => {
    const results = [
      answered(LEVEL_3_CLUB, 0),
      answered(LEVEL_3_CLUB, 1),
      answered(LEVEL_3_CLUB, 1),
      answered(LEVEL_3_CLUB, 2),
      answered(LEVEL_3_CLUB, null),
    ];
    expect(missesByPart(results, 3)).toEqual({
      missedName: 1,
      missedPosition: 2,
      missedClubOrNationality: 1,
    });
  });

  it("counts a nation squad's club part as the third", () => {
    const nation = [part('name'), part('position'), part('club')];
    expect(missesByPart([answered(nation, 2)], 3)).toEqual({
      missedName: 0,
      missedPosition: 0,
      missedClubOrNationality: 1,
    });
  });

  it('sends only the parts the level asks', () => {
    const one = [part('name')];
    expect(missesByPart([answered(one, 0), answered(one, null)], 1)).toEqual({ missedName: 1 });
    const two = [part('name'), part('position')];
    expect(missesByPart([answered(two, 1)], 2)).toEqual({ missedName: 0, missedPosition: 1 });
  });

  it('counts nothing for a question not yet answered', () => {
    expect(missesByPart([unanswered(LEVEL_3_CLUB)], 3)).toEqual({
      missedName: 0,
      missedPosition: 0,
      missedClubOrNationality: 0,
    });
  });
});

describe('previousBestValue', () => {
  it('is none on a first play', () => {
    expect(previousBestValue(undefined)).toBe('none');
  });

  it('is the best score, outdated or not', () => {
    expect(previousBestValue({ score: 7, squadUpdated: '2020-01-01' })).toBe(7);
    expect(previousBestValue({ score: 0, squadUpdated: '2026-10-01' })).toBe(0);
  });
});

describe('leftRound', () => {
  const playing: RoundSnapshot = {
    phase: 'playing',
    squadId: 'arm',
    level: 2,
    currentIndex: 3,
    results: [
      answered([part('name'), part('position')], null),
      answered([part('name'), part('position')], 0),
      answered([part('name'), part('position')], null),
      unanswered([part('name'), part('position')]),
    ],
    activeMs: 42_000,
  };

  it('describes a round thrown away unfinished', () => {
    expect(leftRound(playing)).toEqual({
      squad: 'arm',
      level: 2,
      question: 4,
      score: 2,
      activeMs: 42_000,
    });
  });

  it('is null when there is no round in progress', () => {
    expect(leftRound({ ...playing, phase: 'idle' })).toBeNull();
    expect(leftRound({ ...playing, phase: 'complete' })).toBeNull();
    expect(leftRound({ ...playing, squadId: null })).toBeNull();
  });
});
