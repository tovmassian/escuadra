import { describe, expect, it } from 'vitest';
import { partRailRows, progressOutcomes } from './roundView';
import type { Question, QuestionPart } from '@/lib/questionEngine';
import type { AnsweredPart, QuestionResult } from '@/stores/session';

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

function namePart(): QuestionPart {
  return { kind: 'name', options: ['Bernal', 'Gavi', 'Pedri', 'Olmo'], correctIndex: 0 };
}
function positionPart(): QuestionPart {
  return { kind: 'position', options: ['GK', 'DF', 'MF', 'FW'], correctIndex: 2 };
}
function nationalityPart(): QuestionPart {
  return { kind: 'nationality', options: ['Spain', 'Brazil', 'Poland'], correctIndex: 0 };
}

function question(parts: QuestionPart[]): Question {
  return {
    playerId: 'p1',
    playerName: 'Bernal',
    memberNo: 22,
    age: 18,
    position: 'MF',
    affiliation: 'Spain',
    parts,
  };
}

function answered(pickedIndex: number, correct: boolean): AnsweredPart {
  return { pickedIndex, correct };
}

describe('partRailRows', () => {
  const q = question([namePart(), positionPart(), nationalityPart()]);

  it('labels each part by its kind', () => {
    const rows = partRailRows(q, { question: q, parts: [null, null, null], correct: null }, 0);
    expect(rows.map((r) => r.label)).toEqual(['NAME', 'POSITION', 'NATIONALITY']);
  });

  it('labels the third part CLUB on a nation squad question', () => {
    const nq = question([
      namePart(),
      positionPart(),
      { kind: 'club', options: ['Barcelona'], correctIndex: 0 },
    ]);
    const rows = partRailRows(nq, { question: nq, parts: [null, null, null], correct: null }, 0);
    expect(rows[2]?.label).toBe('CLUB');
  });

  it('marks the active part current and later parts upcoming', () => {
    const rows = partRailRows(q, { question: q, parts: [null, null, null], correct: null }, 0);
    expect(rows[0]?.state).toBe('current');
    expect(rows[1]?.state).toBe('upcoming');
    expect(rows[2]?.state).toBe('upcoming');
  });

  it('shows an earned correct verdict with the answer that was given', () => {
    const rows = partRailRows(
      q,
      { question: q, parts: [answered(0, true), null, null], correct: null },
      1,
    );
    expect(rows[0]?.state).toBe('answered-correct');
    expect(rows[0]?.answer).toBe('Bernal');
  });

  it('shows a wrong verdict with the answer the player actually picked', () => {
    // Invariant 8: never a green check that was not earned, and the rail
    // must report what the player chose, not the correct option.
    const rows = partRailRows(
      q,
      { question: q, parts: [answered(1, false), null, null], correct: false },
      0,
    );
    expect(rows[0]?.state).toBe('answered-wrong');
    expect(rows[0]?.answer).toBe('Gavi');
  });

  it('leaves unanswered parts without an answer string', () => {
    const rows = partRailRows(q, { question: q, parts: [null, null, null], correct: null }, 0);
    expect(rows[1]?.answer).toBeNull();
  });

  it('keeps parts after a wrong answer upcoming rather than current', () => {
    // Invariant 7: asking stops on a wrong part, so nothing downstream is
    // active — the rail must not accent a part that will never be asked.
    const rows = partRailRows(
      q,
      { question: q, parts: [answered(1, false), null, null], correct: false },
      0,
    );
    expect(rows[1]?.state).toBe('upcoming');
    expect(rows[2]?.state).toBe('upcoming');
  });

  it('returns one row per part', () => {
    const single = question([namePart()]);
    const rows = partRailRows(single, { question: single, parts: [null], correct: null }, 0);
    expect(rows).toHaveLength(1);
  });
});
