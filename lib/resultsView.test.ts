import { describe, expect, it } from 'vitest';
import { en } from '@/i18n/en';
import type { QuestionPart } from '@/lib/questionEngine';
import { isFlawless, missedLine, resultActions, resultCopy, resultTier } from './resultsView';
import type { QuestionResult } from '@/stores/session';

// Invariant 10 (SCREENS.md, spec §3.2): the main button differs by pass/fail
// and by whether a level is left; Study is always the second; retry becomes
// an icon whenever it is not the main button.
describe('resultActions', () => {
  it('retries a failed round, with Study as the second action and no retry icon', () => {
    expect(resultActions(false, true)).toEqual({
      primary: 'retry',
      secondary: 'study',
      retryIcon: false,
    });
    expect(resultActions(false, false)).toEqual({
      primary: 'retry',
      secondary: 'study',
      retryIcon: false,
    });
  });

  it('plays the next level after a pass below level 3, retry as an icon', () => {
    expect(resultActions(true, true)).toEqual({
      primary: 'nextLevel',
      secondary: 'study',
      retryIcon: true,
    });
  });

  it('chooses a different team after a pass at level 3, retry as an icon', () => {
    expect(resultActions(true, false)).toEqual({
      primary: 'chooseTeam',
      secondary: 'study',
      retryIcon: true,
    });
  });

  it('never offers the same thing twice', () => {
    for (const passed of [true, false]) {
      for (const hasNext of [true, false]) {
        const { primary, retryIcon } = resultActions(passed, hasNext);
        expect(primary === 'retry' && retryIcon, `${passed}/${hasNext}`).toBe(false);
      }
    }
  });
});

describe('resultCopy', () => {
  const base = { level: 2, teamName: 'Spain', season: '2026' };

  it('fail: what to learn, and the score that unlocks the next level', () => {
    expect(resultCopy({ ...base, tier: 'fail' }, en)).toEqual({
      title: 'These are the ones to learn',
      verdict: 'Score 8/10 to unlock level 3.',
    });
  });

  it('fail on level 3: the score that clears it', () => {
    expect(resultCopy({ ...base, level: 3, tier: 'fail' }, en).verdict).toBe(
      'Score 8/10 to clear level 3.',
    );
  });

  it('passed: the level cleared', () => {
    expect(resultCopy({ ...base, tier: 'passed' }, en)).toEqual({
      title: 'Level 2 cleared',
      verdict: 'You knew most of the starting XI.',
    });
  });

  it('10/10: a la escuadra, with the team, season and level', () => {
    expect(resultCopy({ ...base, tier: 'excellent' }, en)).toEqual({
      title: 'A la escuadra',
      verdict: 'Spain · 2026, level 2. Nothing missed.',
    });
  });
});

describe('missedLine', () => {
  // The first wrong part decides the line; the rest were never asked.
  function missed(parts: QuestionPart[], picks: number[]): QuestionResult {
    return {
      question: {
        playerId: 'p',
        playerName: 'Ferran Torres',
        memberNo: 7,
        age: 26,
        position: 'MF',
        affiliation: 'Barcelona',
        parts,
      },
      parts: parts.map((p, i) => {
        const pick = picks[i];
        return pick === undefined ? null : { pickedIndex: pick, correct: pick === p.correctIndex };
      }),
      correct: false,
    };
  }
  const name: QuestionPart = {
    kind: 'name',
    options: ['Marc Pubill', 'Ferran Torres'],
    correctIndex: 1,
  };
  const pos: QuestionPart = {
    kind: 'position',
    options: ['GK', 'DF', 'MF', 'FW'],
    correctIndex: 2,
  };
  const club: QuestionPart = { kind: 'club', options: ['Arsenal', 'Barcelona'], correctIndex: 1 };
  const nat: QuestionPart = { kind: 'nationality', options: ['France', 'Spain'], correctIndex: 1 };

  it('names the wrong pick on the name', () => {
    expect(missedLine(missed([name], [0]), 'en', en)).toBe('You picked Marc Pubill');
  });

  it('says the name was right when the position was wrong', () => {
    expect(missedLine(missed([name, pos], [1, 3]), 'en', en)).toBe(
      'Name right · position is MF, you said FW',
    );
  });

  it('says name and position were right when the club or nationality was wrong', () => {
    expect(missedLine(missed([name, pos, club], [1, 2, 0]), 'en', en)).toBe(
      'Name and position right · club is Barcelona, you said Arsenal',
    );
    expect(missedLine(missed([name, pos, nat], [1, 2, 0]), 'en', en)).toBe(
      'Name and position right · nationality is Spain, you said France',
    );
  });

  it('draws the position codes from the catalog', () => {
    const spanish = { ...en, positionCodes: { GK: 'POR', DF: 'DEF', MF: 'MED', FW: 'DEL' } };
    expect(missedLine(missed([name, pos], [1, 3]), 'en', spanish)).toBe(
      'Name right · position is MED, you said DEL',
    );
  });

  it('is empty for a question with no wrong part', () => {
    expect(missedLine(missed([name], [1]), 'en', en)).toBe('');
  });
});

describe('isFlawless', () => {
  it('is true for a full round with every question correct', () => {
    expect(isFlawless(10, 10)).toBe(true);
  });

  it('is false when a single question was missed', () => {
    expect(isFlawless(9, 10)).toBe(false);
  });

  it('is false for a round with nothing attempted', () => {
    // 0/0 is vacuously "all correct" — guard against celebrating an empty round.
    expect(isFlawless(0, 0)).toBe(false);
  });

  it('is true for a short but complete round', () => {
    expect(isFlawless(3, 3)).toBe(true);
  });
});

describe('resultTier', () => {
  it('is excellent for a flawless round', () => {
    expect(resultTier(10, 10)).toBe('excellent');
  });

  it('is passed at the pass threshold but short of flawless', () => {
    expect(resultTier(8, 10)).toBe('passed');
    expect(resultTier(9, 10)).toBe('passed');
  });

  it('is fail below the pass threshold', () => {
    expect(resultTier(7, 10)).toBe('fail');
  });

  it('is fail for a round with nothing attempted', () => {
    expect(resultTier(0, 0)).toBe('fail');
  });

  it('tracks PASS_RATIO rather than a hardcoded score', () => {
    // If the pass bar ever moves (e.g. to 5/10), the tier split moves with
    // it automatically — this pins that behaviour rather than a literal 8.
    expect(resultTier(5, 10)).toBe('fail');
  });
});
