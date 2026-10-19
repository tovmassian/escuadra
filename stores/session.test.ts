import { beforeEach, describe, expect, it } from 'vitest';
import { selectMissed, selectScore, useSession } from './session';
import { slotStates, type Slot } from '@/lib/roundView';
import type { Player, RosterEntry, Squad } from '@/types/squad';

function player(overrides: Partial<Player> & Pick<Player, 'id' | 'name' | 'position'>): Player {
  return {
    fullName: overrides.name,
    birth: '2000-01-01',
    nationality: 'England',
    club: null,
    photo: null,
    wikiTitle: null,
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
  marker: { bands: ['#EF0107'], orientation: 'vertical' },
  lastUpdated: '2026-08-21',
  source: 'https://en.wikipedia.org/wiki/Test_FC',
  members: [],
};

// The slots the question screen would draw for the current question, built
// from the live store the same way the screen builds them.
function currentSlots(): Slot[] {
  const state = useSession.getState();
  const question = state.questions[state.currentIndex];
  const result = state.results[state.currentIndex];
  if (!question || !result || state.level === null) throw new Error('no question in play');
  return slotStates(question, result, state.currentPartIndex, squad.kind, state.level);
}

const slotView = (slots: Slot[]) => slots.map((s) => `${s.key}:${s.state}`);

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

  it('pins currentPartIndex at the wrong part, so later slots are not asked (invariant 7 store-side contract)', () => {
    // slotStates marks a slot `active` purely from `partIndex === currentPartIndex`
    // while the question is unscored, and `notAsked` once it is. If answerPart
    // ever advanced the index after a wrong answer, or waited to grade, the
    // screen would accent a part that will never be asked, and the player
    // would see an active position/nationality chip on a question already
    // lost. Grading must also happen immediately, not wait for parts that
    // are never coming.
    useSession.getState().startRound(squad, roster(), 3);
    const q = useSession.getState().questions[0];
    if (!q) throw new Error('no question');
    expect(slotView(currentSlots())).toEqual(['NAME:active', 'POS:pending', 'NAT:pending']);

    const wrongNameIndex = q.parts[0]!.correctIndex === 0 ? 1 : 0;
    useSession.getState().answerPart(wrongNameIndex);

    expect(useSession.getState().currentPartIndex).toBe(0);
    expect(useSession.getState().results[0]?.correct).toBe(false);
    expect(slotView(currentSlots())).toEqual(['NAME:wrong', 'POS:notAsked', 'NAT:notAsked']);
  });

  it('no slot is correct unless its part was answered right (invariant 8 store-side contract)', () => {
    // A slot shows a verdict only where one was earned. A wrong position after
    // a right name leaves the name correct, the position wrong, and the part
    // never asked notAsked: no green check on anything the player did not
    // answer, and none on the question as a whole.
    useSession.getState().startRound(squad, roster(), 3);
    const q = useSession.getState().questions[0];
    if (!q) throw new Error('no question');

    useSession.getState().answerPart(q.parts[0]!.correctIndex);
    expect(slotView(currentSlots())).toEqual(['NAME:correct', 'POS:active', 'NAT:pending']);

    const wrongPositionIndex = q.parts[1]!.correctIndex === 0 ? 1 : 0;
    useSession.getState().answerPart(wrongPositionIndex);

    const slots = currentSlots();
    expect(slotView(slots)).toEqual(['NAME:correct', 'POS:wrong', 'NAT:notAsked']);
    const answered = useSession.getState().results[0]?.parts ?? [];
    const correctKeys = slots.filter((s) => s.state === 'correct').map((s) => s.key);
    expect(correctKeys).toHaveLength(answered.filter((p) => p?.correct === true).length);
    expect(useSession.getState().results[0]?.correct).toBe(false);
  });

  it('shows every slot correct only when every part was answered right', () => {
    useSession.getState().startRound(squad, roster(), 3);
    const q = useSession.getState().questions[0];
    if (!q) throw new Error('no question');

    for (const part of q.parts) useSession.getState().answerPart(part.correctIndex);

    expect(slotView(currentSlots())).toEqual(['NAME:correct', 'POS:correct', 'NAT:correct']);
    expect(useSession.getState().results[0]?.correct).toBe(true);
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

  it('selectMissed surfaces the wrong pick', () => {
    useSession.getState().startRound(squad, roster(), 1);
    const q = useSession.getState().questions[0];
    if (!q) throw new Error('no question');
    const namePart = q.parts[0];
    if (namePart?.kind !== 'name') throw new Error('expected name part');
    const wrongIndex = namePart.correctIndex === 0 ? 1 : 0;

    useSession.getState().answerPart(wrongIndex);

    const missed = selectMissed(useSession.getState().results);
    expect(missed).toHaveLength(1);
    expect(missed[0]?.parts[0]?.pickedIndex).toBe(wrongIndex);
  });

  it('reset clears the round', () => {
    useSession.getState().startRound(squad, roster(), 1);
    useSession.getState().reset();
    expect(useSession.getState().phase).toBe('idle');
    expect(useSession.getState().questions).toHaveLength(0);
  });

  // The store-rating prompt's "not on the first round ever" (#57): the
  // question screen notes it as the round completes; Results reads it.
  it('notes whether earlier rounds were completed, for this round only', () => {
    expect(useSession.getState().earlierRounds).toBe(false);
    useSession.getState().startRound(squad, roster(), 1);
    useSession.getState().setEarlierRounds(true);
    expect(useSession.getState().earlierRounds).toBe(true);

    // Retrying from Results starts a new round, which notes its own.
    useSession.getState().startRound(squad, roster(), 1);
    expect(useSession.getState().earlierRounds).toBe(false);

    useSession.getState().setEarlierRounds(true);
    useSession.getState().reset();
    expect(useSession.getState().earlierRounds).toBe(false);
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
