import { describe, expect, it } from 'vitest';
import {
  answerLayout,
  fitHeroCard,
  heroTabMetrics,
  isCompact,
  partCounter,
  partRailRows,
  positionLabel,
  progressOutcomes,
  promptText,
  slotStates,
  streak,
  tileVerdict,
} from './roundView';
import {
  heroCardMinSize,
  heroCardSize,
  heroFitHeight,
  heroNumberSize,
  heroTab,
  sizes,
} from '@/theme/tokens';
import type { Level, Question, QuestionPart } from '@/lib/questionEngine';
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

describe('fitHeroCard', () => {
  it('keeps the full-size hero when the screen has room', () => {
    for (const level of [1, 2, 3] as const) {
      expect(fitHeroCard(level, heroFitHeight[level])).toEqual({
        size: heroCardSize[level],
        numberSize: heroNumberSize[level],
      });
      expect(fitHeroCard(level, 2000).size).toBe(heroCardSize[level]);
    }
  });

  it('gives up exactly the missing height on a short screen', () => {
    // iPhone SE (2nd/3rd gen): 667pt tall, a 20pt status bar, no home indicator.
    const usable = 667 - 20;
    const missing = heroFitHeight[1] - usable;
    expect(fitHeroCard(1, usable).size).toBe(heroCardSize[1] - missing);
  });

  it('never shrinks below the level minimum', () => {
    for (const level of [1, 2, 3] as const) {
      expect(fitHeroCard(level, 300).size).toBe(heroCardMinSize[level]);
    }
  });

  it('scales the shirt number with the card', () => {
    const { size, numberSize } = fitHeroCard(1, 300);
    expect(numberSize).toBe(Math.round((heroNumberSize[1] * size) / heroCardSize[1]));
  });
});

describe('heroTabMetrics', () => {
  it('scales the tab with the hero at every level size', () => {
    expect(heroTabMetrics(220)).toMatchObject({ thickness: 59, numberSize: 35 });
    expect(heroTabMetrics(130)).toMatchObject({ thickness: 35, numberSize: 21 });
    expect(heroTabMetrics(108)).toMatchObject({ thickness: 29, numberSize: 17 });
  });

  it('holds the number at its floor on the smallest hero', () => {
    // 68pt is level 3's fitHeroCard minimum; the ratios alone give an ~11pt number.
    expect(heroTabMetrics(68)).toMatchObject({
      thickness: heroTab.minThickness,
      numberSize: heroTab.minNumberSize,
    });
  });

  it('never lets the number outgrow its tab', () => {
    for (const size of [68, 90, 108, 124, 130, 180, 220]) {
      const m = heroTabMetrics(size);
      expect(m.numberSize).toBeLessThan(m.thickness);
    }
  });
});

// ---- Spotlight (2.0) -------------------------------------------------------

function spotQuestion(overrides: Partial<Question> = {}): Question {
  return {
    playerId: 'ferran',
    playerName: 'Ferran Torres',
    memberNo: 7,
    age: 26,
    position: 'FW',
    affiliation: 'Barcelona',
    parts: [{ kind: 'name', options: ['A', 'Ferran Torres', 'B', 'C'], correctIndex: 1 }],
    ...overrides,
  };
}

const L2_PARTS: QuestionPart[] = [
  { kind: 'name', options: ['A', 'Ferran Torres', 'B', 'C'], correctIndex: 1 },
  { kind: 'position', options: ['GK', 'DF', 'MF', 'FW'], correctIndex: 3 },
];
const L3_NATION_PARTS: QuestionPart[] = [
  { kind: 'name', options: ['A', 'B', 'Ferran Torres', 'C', 'D', 'E'], correctIndex: 2 },
  { kind: 'position', options: ['GK', 'DF', 'MF', 'FW'], correctIndex: 3 },
  { kind: 'club', options: ['Arsenal', 'Barcelona', 'Celta', 'Getafe'], correctIndex: 1 },
];

function scoredResult(q: Question, picks: number[], correct: boolean | null): QuestionResult {
  return {
    question: q,
    parts: q.parts.map((p, i) => {
      const pick = picks[i];
      return pick === undefined ? null : { pickedIndex: pick, correct: pick === p.correctIndex };
    }),
    correct,
  };
}

// An asked slot's value is null while it is `active` or `pending`; `-` here.
const view = (slots: { key: string; state: string; value: string | null }[]) =>
  slots.map((s) => `${s.key}:${s.state}:${s.value ?? '-'}`);

// Spec §13: every level, part and verdict. A nation squad's affiliation is a
// CLUB (asked on level 3); a club squad's is a NAT (asked on level 3 too).
const L3_CLUB_PARTS: QuestionPart[] = [
  { kind: 'name', options: ['A', 'B', 'Ferran Torres', 'C', 'D', 'E'], correctIndex: 2 },
  { kind: 'position', options: ['GK', 'DF', 'MF', 'FW'], correctIndex: 3 },
  { kind: 'nationality', options: ['Brazil', 'Spain', 'Poland', 'Chile'], correctIndex: 1 },
];

interface SlotCase {
  label: string;
  q: Question;
  result: QuestionResult;
  at: number;
  kind: 'club' | 'nation';
  level: Level;
  expected: string[];
}

function slotCase(
  label: string,
  kind: 'club' | 'nation',
  level: Level,
  parts: QuestionPart[],
  picks: number[],
  correct: boolean | null,
  at: number,
  expected: string[],
): SlotCase {
  const q = spotQuestion({ parts, affiliation: kind === 'club' ? 'Spain' : 'Barcelona' });
  return { label, q, result: scoredResult(q, picks, correct), at, kind, level, expected };
}

const L1_PARTS: QuestionPart[] = [
  { kind: 'name', options: ['A', 'Ferran Torres', 'B', 'C'], correctIndex: 1 },
];

const SLOT_CASES: SlotCase[] = [
  slotCase('L1 nation, unanswered', 'nation', 1, L1_PARTS, [], null, 0, [
    'NAME:active:-',
    'POS:given:FW',
    'AGE:given:26',
    'CLUB:given:Barcelona',
  ]),
  slotCase('L1 nation, right', 'nation', 1, L1_PARTS, [1], true, 0, [
    'NAME:correct:Ferran Torres',
    'POS:given:FW',
    'AGE:given:26',
    'CLUB:given:Barcelona',
  ]),
  slotCase('L1 nation, wrong', 'nation', 1, L1_PARTS, [0], false, 0, [
    'NAME:wrong:Ferran Torres',
    'POS:given:FW',
    'AGE:given:26',
    'CLUB:given:Barcelona',
  ]),
  slotCase('L2 nation, unanswered', 'nation', 2, L2_PARTS, [], null, 0, [
    'NAME:active:-',
    'POS:pending:-',
    'AGE:given:26',
    'CLUB:given:Barcelona',
  ]),
  slotCase('L2 nation, wrong at the name', 'nation', 2, L2_PARTS, [0], false, 0, [
    'NAME:wrong:Ferran Torres',
    'POS:notAsked:FW',
    'AGE:given:26',
    'CLUB:given:Barcelona',
  ]),
  slotCase('L2 nation, wrong at the position', 'nation', 2, L2_PARTS, [1, 0], false, 1, [
    'NAME:correct:Ferran Torres',
    'POS:wrong:FW',
    'AGE:given:26',
    'CLUB:given:Barcelona',
  ]),
  slotCase('L2 nation, all right', 'nation', 2, L2_PARTS, [1, 3], true, 1, [
    'NAME:correct:Ferran Torres',
    'POS:correct:FW',
    'AGE:given:26',
    'CLUB:given:Barcelona',
  ]),
  slotCase('L3 nation, unanswered', 'nation', 3, L3_NATION_PARTS, [], null, 0, [
    'NAME:active:-',
    'POS:pending:-',
    'CLUB:pending:-',
  ]),
  slotCase('L3 nation, name right, position next', 'nation', 3, L3_NATION_PARTS, [2], null, 1, [
    'NAME:correct:Ferran Torres',
    'POS:active:-',
    'CLUB:pending:-',
  ]),
  slotCase('L3 nation, position right, club next', 'nation', 3, L3_NATION_PARTS, [2, 3], null, 2, [
    'NAME:correct:Ferran Torres',
    'POS:correct:FW',
    'CLUB:active:-',
  ]),
  slotCase('L3 nation, wrong at the name', 'nation', 3, L3_NATION_PARTS, [0], false, 0, [
    'NAME:wrong:Ferran Torres',
    'POS:notAsked:FW',
    'CLUB:notAsked:Barcelona',
  ]),
  slotCase('L3 nation, wrong at the position', 'nation', 3, L3_NATION_PARTS, [2, 0], false, 1, [
    'NAME:correct:Ferran Torres',
    'POS:wrong:FW',
    'CLUB:notAsked:Barcelona',
  ]),
  slotCase('L3 nation, wrong at the club', 'nation', 3, L3_NATION_PARTS, [2, 3, 0], false, 2, [
    'NAME:correct:Ferran Torres',
    'POS:correct:FW',
    'CLUB:wrong:Barcelona',
  ]),
  slotCase('L3 nation, all right', 'nation', 3, L3_NATION_PARTS, [2, 3, 1], true, 2, [
    'NAME:correct:Ferran Torres',
    'POS:correct:FW',
    'CLUB:correct:Barcelona',
  ]),
  slotCase('L3 club, unanswered', 'club', 3, L3_CLUB_PARTS, [], null, 0, [
    'NAME:active:-',
    'POS:pending:-',
    'NAT:pending:-',
  ]),
  slotCase('L3 club, name right, position next', 'club', 3, L3_CLUB_PARTS, [2], null, 1, [
    'NAME:correct:Ferran Torres',
    'POS:active:-',
    'NAT:pending:-',
  ]),
  slotCase('L3 club, position right, nationality next', 'club', 3, L3_CLUB_PARTS, [2, 3], null, 2, [
    'NAME:correct:Ferran Torres',
    'POS:correct:FW',
    'NAT:active:-',
  ]),
  slotCase('L3 club, wrong at the name', 'club', 3, L3_CLUB_PARTS, [0], false, 0, [
    'NAME:wrong:Ferran Torres',
    'POS:notAsked:FW',
    'NAT:notAsked:Spain',
  ]),
  slotCase('L3 club, wrong at the position', 'club', 3, L3_CLUB_PARTS, [2, 0], false, 1, [
    'NAME:correct:Ferran Torres',
    'POS:wrong:FW',
    'NAT:notAsked:Spain',
  ]),
  slotCase('L3 club, wrong at the nationality', 'club', 3, L3_CLUB_PARTS, [2, 3, 0], false, 2, [
    'NAME:correct:Ferran Torres',
    'POS:correct:FW',
    'NAT:wrong:Spain',
  ]),
  slotCase('L3 club, all right', 'club', 3, L3_CLUB_PARTS, [2, 3, 1], true, 2, [
    'NAME:correct:Ferran Torres',
    'POS:correct:FW',
    'NAT:correct:Spain',
  ]),
];

describe('slotStates', () => {
  it('level 1 asks the name and prints position, age and club as clues', () => {
    const q = spotQuestion();
    expect(view(slotStates(q, scoredResult(q, [], null), 0, 'nation', 1))).toEqual([
      'NAME:active:-',
      'POS:given:FW',
      'AGE:given:26',
      'CLUB:given:Barcelona',
    ]);
  });

  it('a club squad prints nationality, not club', () => {
    const q = spotQuestion({ affiliation: 'Spain' });
    expect(slotStates(q, scoredResult(q, [], null), 0, 'club', 1).map((s) => s.key)).toEqual([
      'NAME',
      'POS',
      'AGE',
      'NAT',
    ]);
  });

  it('drops AGE when the player has no birth date', () => {
    const q = spotQuestion({ age: null });
    expect(slotStates(q, scoredResult(q, [], null), 0, 'nation', 1).map((s) => s.key)).toEqual([
      'NAME',
      'POS',
      'CLUB',
    ]);
  });

  it('level 2: position is pending until the name is answered, then active', () => {
    const q = spotQuestion({ parts: L2_PARTS });
    expect(view(slotStates(q, scoredResult(q, [], null), 0, 'nation', 2)).slice(0, 2)).toEqual([
      'NAME:active:-',
      'POS:pending:-',
    ]);
    expect(view(slotStates(q, scoredResult(q, [1], null), 1, 'nation', 2)).slice(0, 2)).toEqual([
      'NAME:correct:Ferran Torres',
      'POS:active:-',
    ]);
  });

  it('level 3 asks name, position and club, and has no AGE slot', () => {
    const q = spotQuestion({ parts: L3_NATION_PARTS });
    expect(view(slotStates(q, scoredResult(q, [], null), 0, 'nation', 3))).toEqual([
      'NAME:active:-',
      'POS:pending:-',
      'CLUB:pending:-',
    ]);
  });

  // Invariant 7: asking stops at the first wrong part; the rest show the
  // right value, muted, never a verdict they did not earn (invariant 8).
  it('after a wrong name, later slots are not asked and show the right value', () => {
    const q = spotQuestion({ parts: L3_NATION_PARTS });
    expect(view(slotStates(q, scoredResult(q, [0], false), 0, 'nation', 3))).toEqual([
      'NAME:wrong:Ferran Torres',
      'POS:notAsked:FW',
      'CLUB:notAsked:Barcelona',
    ]);
  });

  it('a wrong last part is wrong, the earlier right ones stay correct', () => {
    const q = spotQuestion({ parts: L3_NATION_PARTS });
    expect(view(slotStates(q, scoredResult(q, [2, 3, 0], false), 2, 'nation', 3))).toEqual([
      'NAME:correct:Ferran Torres',
      'POS:correct:FW',
      'CLUB:wrong:Barcelona',
    ]);
  });

  it('never marks a slot correct that was not answered right', () => {
    const q = spotQuestion({ parts: L2_PARTS });
    const states = slotStates(q, scoredResult(q, [0], false), 0, 'nation', 2).map((s) => s.state);
    expect(states).not.toContain('correct');
  });

  it('never carries the answer on a slot still being asked', () => {
    // A chip, a label or a flag lookup built from `value` cannot leak what it
    // was never given.
    for (const c of SLOT_CASES) {
      const asking = slotStates(c.q, c.result, c.at, c.kind, c.level).filter(
        (s) => s.state === 'active' || s.state === 'pending',
      );
      for (const s of asking) expect(s.value, `${c.label} ${s.key}`).toBeNull();
    }
  });

  it('carries the true value on every other slot', () => {
    for (const c of SLOT_CASES) {
      const settled = slotStates(c.q, c.result, c.at, c.kind, c.level).filter(
        (s) => s.state !== 'active' && s.state !== 'pending',
      );
      for (const s of settled) expect(s.value, `${c.label} ${s.key}`).not.toBeNull();
    }
  });

  for (const c of SLOT_CASES) {
    it(`${c.label}`, () => {
      expect(view(slotStates(c.q, c.result, c.at, c.kind, c.level))).toEqual(c.expected);
    });
  }

  it('asks a club squad for nationality, so NAT is never a given clue', () => {
    for (const c of SLOT_CASES.filter((c) => c.kind === 'club' && c.level === 3)) {
      const nat = slotStates(c.q, c.result, c.at, c.kind, c.level).find((s) => s.key === 'NAT');
      expect(nat?.state, c.label).not.toBe('given');
    }
  });
});

describe('isCompact and answerLayout', () => {
  it('goes compact below the threshold', () => {
    expect(isCompact(sizes.compactBelow - 1)).toBe(true);
    expect(isCompact(sizes.compactBelow)).toBe(false);
  });

  it('lays names, clubs and nationalities in two columns, positions in four', () => {
    const name4: QuestionPart = { kind: 'name', options: ['a', 'b', 'c', 'd'], correctIndex: 0 };
    const name6: QuestionPart = {
      kind: 'name',
      options: ['a', 'b', 'c', 'd', 'e', 'f'],
      correctIndex: 0,
    };
    const pos: QuestionPart = {
      kind: 'position',
      options: ['GK', 'DF', 'MF', 'FW'],
      correctIndex: 0,
    };
    const nat: QuestionPart = {
      kind: 'nationality',
      options: ['a', 'b', 'c', 'd'],
      correctIndex: 0,
    };
    expect(answerLayout(name4, false)).toEqual({
      columns: 2,
      tileHeight: sizes.answerTile.names4.normal,
    });
    expect(answerLayout(name6, true)).toEqual({
      columns: 2,
      tileHeight: sizes.answerTile.names6.compact,
    });
    expect(answerLayout(pos, false)).toEqual({
      columns: 4,
      tileHeight: sizes.answerTile.positions.normal,
    });
    expect(answerLayout(nat, true)).toEqual({
      columns: 2,
      tileHeight: sizes.answerTile.names4.compact,
    });
  });
});

describe('streak', () => {
  it('counts correct answers in a row up to the current question', () => {
    expect(streak([result(true), result(true), result(null)], 2)).toBe(2);
  });

  it('includes the current question once it is answered right', () => {
    expect(streak([result(true), result(true), result(true)], 2)).toBe(3);
  });

  it('resets on a miss, including a miss on the current question', () => {
    expect(streak([result(true), result(false), result(true), result(null)], 3)).toBe(1);
    expect(streak([result(true), result(true), result(false)], 2)).toBe(0);
  });

  it('is zero at the start of a round', () => {
    expect(streak([result(null), result(null)], 0)).toBe(0);
  });
});

describe('promptText and partCounter', () => {
  it('asks each part in its own words', () => {
    expect(promptText(L3_NATION_PARTS[0] as QuestionPart, 7, null)).toBe('Who wears 7?');
    expect(promptText(L3_NATION_PARTS[1] as QuestionPart, 7, null)).toBe('Position?');
    expect(promptText(L3_NATION_PARTS[2] as QuestionPart, 7, null)).toBe('Which club?');
    expect(promptText({ kind: 'nationality', options: ['a'], correctIndex: 0 }, 7, null)).toBe(
      'Nationality?',
    );
  });

  it('reads the verdict once the question is scored', () => {
    expect(promptText(L3_NATION_PARTS[0] as QuestionPart, 7, true)).toBe('Correct');
    expect(promptText(L3_NATION_PARTS[0] as QuestionPart, 7, false)).toBe('Missed');
  });

  it('counts parts only on multi-part questions', () => {
    expect(partCounter(spotQuestion(), 0)).toBeNull();
    expect(partCounter(spotQuestion({ parts: L3_NATION_PARTS }), 1)).toBe('2/3');
  });
});

describe('tileVerdict', () => {
  const part: QuestionPart = { kind: 'name', options: ['a', 'b', 'c', 'd'], correctIndex: 1 };
  it('is idle until answered', () => {
    expect(tileVerdict(part, null, 1)).toBe('idle');
  });
  it('separates the right pick, the right answer missed, the wrong pick and the rest', () => {
    expect(tileVerdict(part, 1, 1)).toBe('correct-picked');
    expect(tileVerdict(part, 2, 1)).toBe('correct-unpicked');
    expect(tileVerdict(part, 2, 2)).toBe('incorrect-picked');
    expect(tileVerdict(part, 2, 3)).toBe('incorrect-other');
  });
});

describe('positionLabel', () => {
  it('names each position for the tile beneath its code', () => {
    expect(['GK', 'DF', 'MF', 'FW'].map((p) => positionLabel(p as 'GK'))).toEqual([
      'Keeper',
      'Defender',
      'Midfield',
      'Forward',
    ]);
  });
});
