import { describe, expect, it } from 'vitest';
import { en, type Messages } from '@/i18n/en';
import {
  answerLayout,
  footerMode,
  isCompact,
  nextButtonText,
  optionText,
  partCounter,
  positionCode,
  positionLabel,
  progressOutcomes,
  promptText,
  slotSpoken,
  slotStates,
  slotValueText,
  startsNewRound,
  streak,
  streakMilestone,
  tileVerdict,
} from '../roundView';
import { sizes } from '@/theme/tokens';
import type { Level, Question, QuestionPart } from '@/lib/questionEngine';
import type { QuestionResult, SessionPhase } from '@/stores/session';

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
    expect(promptText(L3_NATION_PARTS[0] as QuestionPart, 7, null, en)).toBe('Who wears 7?');
    expect(promptText(L3_NATION_PARTS[1] as QuestionPart, 7, null, en)).toBe('Position?');
    expect(promptText(L3_NATION_PARTS[2] as QuestionPart, 7, null, en)).toBe('Which club?');
    expect(promptText({ kind: 'nationality', options: ['a'], correctIndex: 0 }, 7, null, en)).toBe(
      'Nationality?',
    );
  });

  it('reads the verdict once the question is scored', () => {
    expect(promptText(L3_NATION_PARTS[0] as QuestionPart, 7, true, en)).toBe('Correct');
    expect(promptText(L3_NATION_PARTS[0] as QuestionPart, 7, false, en)).toBe('Missed');
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
    expect(['GK', 'DF', 'MF', 'FW'].map((p) => positionLabel(p as 'GK', en))).toEqual([
      'Keeper',
      'Defender',
      'Midfield',
      'Forward',
    ]);
  });
});

describe('footerMode', () => {
  it('waits for an answer, then moves on by itself or waits on a miss', () => {
    expect(footerMode(null, false)).toBe('waiting');
    expect(footerMode(true, false)).toBe('autoNext');
    expect(footerMode(false, false)).toBe('gotIt');
  });

  // Spec §2.4: no auto-advance while a screen reader is on.
  it('never moves on by itself with a screen reader on', () => {
    expect(footerMode(true, true)).toBe('next');
    expect(footerMode(false, true)).toBe('gotIt');
  });
});

describe('nextButtonText', () => {
  it('moves on to the next question before the last', () => {
    expect(nextButtonText('gotIt', false, en)).toEqual({
      label: 'Got it — next',
      spoken: 'Got it — next',
    });
    expect(nextButtonText('next', false, en)).toEqual({
      label: 'Next question',
      spoken: 'Next question',
    });
    expect(nextButtonText('autoNext', false, en)).toEqual({
      label: 'Next · tap to skip',
      spoken: 'Next question',
    });
  });

  it('says where the last question goes: to the results', () => {
    expect(nextButtonText('gotIt', true, en)).toEqual({
      label: 'See results',
      spoken: 'See results',
    });
    expect(nextButtonText('next', true, en)).toEqual({
      label: 'See results',
      spoken: 'See results',
    });
    expect(nextButtonText('autoNext', true, en)).toEqual({
      label: 'See results · tap to skip',
      spoken: 'See results',
    });
  });
});

describe('streakMilestone', () => {
  it('fires when the streak reaches 5 or 10', () => {
    expect(streakMilestone(4, 5)).toBe(true);
    expect(streakMilestone(9, 10)).toBe(true);
  });

  it('stays quiet otherwise, and on a re-render at the same count', () => {
    expect(streakMilestone(5, 5)).toBe(false);
    expect(streakMilestone(5, 6)).toBe(false);
    expect(streakMilestone(5, 0)).toBe(false);
    expect(streakMilestone(3, 4)).toBe(false);
  });
});

describe('slotSpoken', () => {
  it('names a settled slot with its value', () => {
    // A position by its word, not its code, which a screen reader spells (#187).
    expect(slotSpoken({ key: 'POS', state: 'given', value: 'FW' }, 'en', en)).toBe(
      'Position: Forward',
    );
    expect(slotSpoken({ key: 'NAME', state: 'correct', value: 'Pedri' }, 'en', en)).toBe(
      'Name: Pedri, right',
    );
    expect(slotSpoken({ key: 'CLUB', state: 'wrong', value: 'Barcelona' }, 'en', en)).toBe(
      'Club: Barcelona, the right answer',
    );
    expect(slotSpoken({ key: 'NAT', state: 'notAsked', value: 'Spain' }, 'en', en)).toBe(
      'Nationality: Spain, not asked',
    );
  });

  // Guardrail: a screen reader must not read out the answer being asked.
  it('never speaks a value for a slot still being asked', () => {
    expect(slotSpoken({ key: 'NAME', state: 'active', value: null }, 'en', en)).toBe(
      'Name: being asked',
    );
    expect(slotSpoken({ key: 'POS', state: 'pending', value: null }, 'en', en)).toBe(
      'Position: asked next',
    );
  });
});

// A catalog that spells the codes differently, as Spanish will (#145).
const spanishCodes: Messages = {
  ...en,
  positionCodes: { GK: 'POR', DF: 'DEF', MF: 'MED', FW: 'DEL' },
};

describe('positionCode', () => {
  it('is the English code today', () => {
    expect((['GK', 'DF', 'MF', 'FW'] as const).map((p) => positionCode(p, en))).toEqual([
      'GK',
      'DF',
      'MF',
      'FW',
    ]);
  });

  it('follows the catalog, never the data', () => {
    expect(positionCode('GK', spanishCodes)).toBe('POR');
  });
});

describe('optionText', () => {
  const position: QuestionPart = {
    kind: 'position',
    options: ['GK', 'DF', 'MF', 'FW'],
    correctIndex: 2,
  };
  const nationality: QuestionPart = {
    kind: 'nationality',
    options: ['China PR', 'Spain', 'Atlantis'],
    correctIndex: 1,
  };
  const name: QuestionPart = { kind: 'name', options: ['Pedri', 'Rodri'], correctIndex: 0 };
  const club: QuestionPart = { kind: 'club', options: ['Arsenal'], correctIndex: 0 };

  it('draws a position as its catalog code', () => {
    expect(optionText(position, 3, 'en', en)).toBe('FW');
    expect(optionText(position, 3, 'en', spanishCodes)).toBe('DEL');
  });

  it('draws a nationality as its country name, or as it is when unmapped', () => {
    expect(optionText(nationality, 0, 'en', en)).toBe('China PR');
    expect(optionText(nationality, 2, 'en', en)).toBe('Atlantis');
  });

  it('leaves names and clubs alone', () => {
    expect(optionText(name, 1, 'en', en)).toBe('Rodri');
    expect(optionText(club, 0, 'en', en)).toBe('Arsenal');
  });

  it('shows a dash for an index past the options', () => {
    expect(optionText(name, 9, 'en', en)).toBe('—');
  });
});

describe('slotValueText', () => {
  it('draws POS as a code and NAT as a country name', () => {
    expect(slotValueText({ key: 'POS', state: 'given', value: 'FW' }, 'en', spanishCodes)).toBe(
      'DEL',
    );
    expect(slotValueText({ key: 'NAT', state: 'given', value: 'China PR' }, 'en', en)).toBe(
      'China PR',
    );
  });

  it('leaves NAME, AGE and CLUB as they are', () => {
    expect(slotValueText({ key: 'CLUB', state: 'given', value: 'Arsenal' }, 'en', en)).toBe(
      'Arsenal',
    );
    expect(slotValueText({ key: 'AGE', state: 'given', value: '26' }, 'en', en)).toBe('26');
  });

  it('is null while the slot is being asked, so nothing leaks', () => {
    expect(slotValueText({ key: 'NAT', state: 'active', value: null }, 'en', en)).toBeNull();
  });

  it("speaks a position as the catalog's word, not its code (#187)", () => {
    const spanish: Messages = { ...spanishCodes, positions: { ...en.positions, FW: 'Delantero' } };
    expect(slotSpoken({ key: 'POS', state: 'given', value: 'FW' }, 'en', spanish)).toBe(
      'Position: Delantero',
    );
  });
});

describe('startsNewRound', () => {
  // The question screen for Spain, level 2, over every session it can meet.
  const at = (phase: SessionPhase, squadId: string | null, level: Level | null) => ({
    phase,
    squadId,
    level,
  });
  const cases = [
    { label: 'idle, after a reset', session: at('idle', null, null), starts: true },
    { label: 'idle, same squad and level', session: at('idle', 'spain', 2), starts: true },
    { label: 'idle, another squad', session: at('idle', 'france', 2), starts: true },
    { label: 'idle, another level', session: at('idle', 'spain', 1), starts: true },
    // Retry and next level on Results hand over a round they started; a round
    // left mid-way by a system back resumes.
    { label: 'playing, same squad and level', session: at('playing', 'spain', 2), starts: false },
    { label: 'playing, another squad', session: at('playing', 'france', 2), starts: true },
    { label: 'playing, another level', session: at('playing', 'spain', 3), starts: true },
    // The last round's, left by a system back from Results (#222).
    { label: 'complete, same squad and level', session: at('complete', 'spain', 2), starts: true },
    { label: 'complete, another squad', session: at('complete', 'france', 2), starts: true },
    { label: 'complete, another level', session: at('complete', 'spain', 1), starts: true },
  ];

  for (const c of cases) {
    it(`${c.starts ? 'starts' : 'keeps'} the round when the session is ${c.label}`, () => {
      expect(startsNewRound(c.session, 'spain', 2)).toBe(c.starts);
    });
  }
});
