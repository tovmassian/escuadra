import { beforeEach, describe, expect, it } from 'vitest';
import { firstWrongPart, selectMissed, selectScore, useSession } from './session';
import type { Player, RosterEntry, Squad } from '@/types/squad';

function player(overrides: Partial<Player> & Pick<Player, 'id' | 'name' | 'position'>): Player {
  return {
    fullName: overrides.name,
    birth: '2000-01-01',
    nationality: 'England',
    club: null,
    photo: null,
    ...overrides,
  };
}

function roster(): RosterEntry[] {
  const positions: Player['position'][] = ['GK', 'DF', 'MF', 'FW'];
  return Array.from({ length: 12 }, (_, i) => {
    const p = player({
      id: `p${i}`,
      name: `Player ${i}`,
      position: positions[i % positions.length] as Player['position'],
    });
    return { member: { playerId: p.id, no: i + 1 }, player: p };
  });
}

const squad: Squad = {
  id: 'test',
  kind: 'club',
  name: 'Test FC',
  season: '2025/26',
  primaryColor: '#EF0107',
  secondaryColor: '#FFFFFF',
  verified: false,
  members: [],
};

describe('session store', () => {
  beforeEach(() => {
    useSession.getState().reset();
  });

  it('starts idle', () => {
    expect(useSession.getState().phase).toBe('idle');
  });

  it('startRound builds questions and enters playing phase', () => {
    useSession.getState().startRound(squad, roster(), 1);
    const state = useSession.getState();
    expect(state.phase).toBe('playing');
    expect(state.questions).toHaveLength(10);
    expect(state.results).toHaveLength(10);
  });

  it('answerPart advances through a multi-part question and grades correctly', () => {
    useSession.getState().startRound(squad, roster(), 2);
    const q = useSession.getState().questions[0];
    if (!q) throw new Error('no question');

    useSession.getState().answerPart(q.parts[0]?.correctIndex ?? -1);
    expect(useSession.getState().currentPartIndex).toBe(1);
    expect(useSession.getState().results[0]?.correct).toBeNull();

    useSession.getState().answerPart(q.parts[1]?.correctIndex ?? -1);
    expect(useSession.getState().results[0]?.correct).toBe(true);
  });

  it('records incorrect when any part is wrong, with no partial credit', () => {
    useSession.getState().startRound(squad, roster(), 2);
    const q = useSession.getState().questions[0];
    if (!q) throw new Error('no question');

    useSession.getState().answerPart(q.parts[0]?.correctIndex ?? -1);
    const wrongPositionIndex = (q.parts[1]?.correctIndex ?? 0) === 0 ? 1 : 0;
    useSession.getState().answerPart(wrongPositionIndex);

    expect(useSession.getState().results[0]?.correct).toBe(false);
  });

  it('stops asking parts the moment one is wrong, grading immediately', () => {
    useSession.getState().startRound(squad, roster(), 3);
    const q = useSession.getState().questions[0];
    if (!q) throw new Error('no question');

    const wrongNameIndex = q.parts[0]!.correctIndex === 0 ? 1 : 0;
    useSession.getState().answerPart(wrongNameIndex);

    const state = useSession.getState();
    expect(state.currentPartIndex).toBe(0);
    expect(state.results[0]?.correct).toBe(false);
    expect(state.results[0]?.parts[1]).toBeNull();
    expect(state.results[0]?.parts[2]).toBeNull();
  });

  it('advanceQuestion moves forward and completes after the last question', () => {
    useSession.getState().startRound(squad, roster(), 1);
    for (let i = 0; i < 10; i++) {
      expect(useSession.getState().phase).toBe('playing');
      useSession.getState().advanceQuestion();
    }
    expect(useSession.getState().phase).toBe('complete');
  });

  it('selectScore counts only answered questions', () => {
    useSession.getState().startRound(squad, roster(), 1);
    const q = useSession.getState().questions[0];
    if (!q) throw new Error('no question');
    useSession.getState().answerPart(q.parts[0]?.correctIndex ?? -1);

    const score = selectScore(useSession.getState().results);
    expect(score.attempted).toBe(1);
    expect(score.correct).toBe(1);
  });

  it('selectMissed and firstWrongPart surface the wrong pick', () => {
    useSession.getState().startRound(squad, roster(), 1);
    const q = useSession.getState().questions[0];
    if (!q) throw new Error('no question');
    const namePart = q.parts[0];
    if (namePart?.kind !== 'name') throw new Error('expected name part');
    const wrongIndex = namePart.correctIndex === 0 ? 1 : 0;

    useSession.getState().answerPart(wrongIndex);

    const missed = selectMissed(useSession.getState().results);
    expect(missed).toHaveLength(1);
    const wrong = firstWrongPart(missed[0]!);
    expect(wrong?.pickedLabel).toBe(namePart.options[wrongIndex]);
  });

  it('reset clears the round', () => {
    useSession.getState().startRound(squad, roster(), 1);
    useSession.getState().reset();
    expect(useSession.getState().phase).toBe('idle');
    expect(useSession.getState().questions).toHaveLength(0);
  });

  it('produces an identical round for the same explicit seed', () => {
    useSession.getState().startRound(squad, roster(), 1, 4242);
    const first = JSON.stringify(useSession.getState().questions);

    useSession.getState().reset();
    useSession.getState().startRound(squad, roster(), 1, 4242);
    const second = JSON.stringify(useSession.getState().questions);

    expect(second).toEqual(first);
  });

  it('produces a different round for a different seed', () => {
    useSession.getState().startRound(squad, roster(), 1, 1);
    const a = useSession
      .getState()
      .questions.map((q) => q.playerId)
      .join(',');

    useSession.getState().reset();
    useSession.getState().startRound(squad, roster(), 1, 2);
    const b = useSession
      .getState()
      .questions.map((q) => q.playerId)
      .join(',');

    expect(b).not.toEqual(a);
  });
});
