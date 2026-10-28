// Pure view-model helpers for the play screen. No React and no store values —
// only types — so this stays unit-testable, since the project's Vitest setup
// has no React Native renderer.
import { nationalityName } from '@/i18n/displayNames';
import type { Messages } from '@/i18n/en';
import type { SupportedLanguage } from '@/i18n/resolveLanguage';
import type { Level, Question, QuestionPart } from '@/lib/questionEngine';
import type { QuestionResult, SessionPhase } from '@/stores/session';
import type { Position, Squad } from '@/types/squad';
import { sizes } from '@/theme/tokens';

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

/**
 * Whether the question screen for a squad and level starts a new round when
 * it opens: always, unless the session is already playing that squad and
 * level. Retry and the next level on Results hand over a round they started,
 * and a round left mid-way by a system back resumes. A `complete` session is
 * the last round's, never kept: kept, it reopened that round's Results (#222).
 */
export function startsNewRound(
  session: { phase: SessionPhase; squadId: string | null; level: Level | null },
  squadId: string,
  level: Level,
): boolean {
  return !(session.phase === 'playing' && session.squadId === squadId && session.level === level);
}

/**
 * Whether the question screen draws the session's round: its squad and level,
 * playing or just finished. A finished round stays on screen while Results
 * slides over it, so the button just pressed is never taken from under
 * VoiceOver, which would then start Results wherever that button was (#226).
 * Never the round the screen opened on and replaces (`replaced`, its
 * questions; null when it opened on its own round), not even for the frame
 * before the new round takes its place (#222).
 */
export function drawsRound(
  session: {
    phase: SessionPhase;
    squadId: string | null;
    level: Level | null;
    questions: readonly Question[];
  },
  squadId: string,
  level: Level,
  replaced: readonly Question[] | null,
): boolean {
  return (
    session.phase !== 'idle' &&
    session.squadId === squadId &&
    session.level === level &&
    session.questions !== replaced
  );
}

// ---- Spotlight question screen (2.0, spec §2) ------------------------------

export type SlotKey = 'NAME' | 'POS' | 'AGE' | 'CLUB' | 'NAT';

/**
 * - `given`: a clue, printed.
 * - `active`: the part asked now.
 * - `pending`: asked later.
 * - `correct` / `wrong`: answered, both showing the right value.
 * - `notAsked`: asking stopped at an earlier wrong part (invariant 7). It shows
 *   the right value, muted, and never a verdict it did not earn (invariant 8).
 */
export type SlotState = 'given' | 'active' | 'pending' | 'correct' | 'wrong' | 'notAsked';

export interface Slot {
  key: SlotKey;
  state: SlotState;
  /** The true value in every state but `active` and `pending`, where it is
   *  null: a slot still being asked never carries its answer, so no chip,
   *  label or flag lookup can leak it. A chip shows `?` for `active` and `—`
   *  for `pending`. */
  value: string | null;
}

const PART_SLOT: Record<QuestionPart['kind'], SlotKey> = {
  name: 'NAME',
  position: 'POS',
  nationality: 'NAT',
  club: 'CLUB',
};

/**
 * The chips under the shirt number, which spell out the player (spec §2.2).
 * A clue is printed; an asked part is a slot that fills in as it is answered.
 * Level 3 has no AGE, and AGE drops out when the player has no birth date.
 */
export function slotStates(
  question: Question,
  result: QuestionResult,
  currentPartIndex: number,
  kind: Squad['kind'],
  level: Level,
): Slot[] {
  const affiliation: SlotKey = kind === 'club' ? 'NAT' : 'CLUB';
  const values: Record<SlotKey, string | null> = {
    NAME: question.playerName,
    POS: question.position,
    AGE: level === 3 || question.age === null ? null : String(question.age),
    CLUB: question.affiliation,
    NAT: question.affiliation,
  };
  const asked = question.parts.map((part) => PART_SLOT[part.kind]);
  const scored = result.correct !== null;

  const slots: Slot[] = [];
  for (const key of ['NAME', 'POS', 'AGE', affiliation] as const) {
    const value = values[key];
    if (value === null) continue;
    const partIndex = asked.indexOf(key);
    if (partIndex === -1) {
      slots.push({ key, state: 'given', value });
      continue;
    }
    const answer = result.parts[partIndex];
    const state: SlotState = answer
      ? answer.correct
        ? 'correct'
        : 'wrong'
      : scored
        ? 'notAsked'
        : partIndex === currentPartIndex
          ? 'active'
          : 'pending';
    slots.push({ key, state, value: state === 'active' || state === 'pending' ? null : value });
  }
  return slots;
}

export interface AnswerLayout {
  columns: 2 | 4;
  tileHeight: number;
}

/** Compact below this usable height (window minus safe-area insets), spec §2.3. */
export function isCompact(usableHeight: number): boolean {
  return usableHeight < sizes.compactBelow;
}

/** Two columns for names, clubs and nationalities; four for positions. */
export function answerLayout(part: QuestionPart, compact: boolean): AnswerLayout {
  const size = compact ? 'compact' : 'normal';
  if (part.kind === 'position') return { columns: 4, tileHeight: sizes.answerTile.positions[size] };
  const grid = part.options.length > 4 ? sizes.answerTile.names6 : sizes.answerTile.names4;
  return { columns: 2, tileHeight: grid[size] };
}

/**
 * Correct answers in a row, up to and including the current question once it
 * is scored (spec §2.5). A miss resets it.
 */
export function streak(results: QuestionResult[], currentIndex: number): number {
  let count = 0;
  for (let i = currentIndex; i >= 0; i--) {
    const correct = results[i]?.correct ?? null;
    if (correct === null && i === currentIndex) continue;
    if (correct !== true) break;
    count++;
  }
  return count;
}

/** The prompt row's words: the part's question, or the verdict once scored. */
export function promptText(
  part: QuestionPart,
  memberNo: number,
  verdict: boolean | null,
  messages: Messages,
): string {
  if (verdict !== null) return verdict ? messages.round.correct : messages.round.missed;
  switch (part.kind) {
    case 'name':
      return messages.round.whoWears(memberNo);
    case 'position':
      return messages.round.askPosition;
    case 'club':
      return messages.round.askClub;
    case 'nationality':
      return messages.round.askNationality;
  }
}

export interface PartCounter {
  /** What the prompt row shows: "2/3". */
  label: string;
  /** What a screen reader says: "Part 2 of 3", since it reads the slash. */
  spoken: string;
}

/** The counter beside the prompt on a multi-part question; null on level 1.
 *  `currentPartIndex` is the part being asked. Once the question is scored it
 *  stays on the last part answered, so it is the part on screen in every
 *  state. */
export function partCounter(
  question: Question,
  currentPartIndex: number,
  messages: Messages,
): PartCounter | null {
  const total = question.parts.length;
  if (total < 2) return null;
  const n = currentPartIndex + 1;
  return { label: `${n}/${total}`, spoken: messages.round.partOf(n, total) };
}

/**
 * Five tile states, not four. "You picked the right answer" and "you picked
 * wrong, here is the right one" carry visibly different weight, so they are
 * not merged.
 */
export type TileVerdict =
  'idle' | 'correct-picked' | 'correct-unpicked' | 'incorrect-picked' | 'incorrect-other';

export function tileVerdict(
  part: QuestionPart,
  answeredIndex: number | null,
  index: number,
): TileVerdict {
  if (answeredIndex === null) return 'idle';
  if (index === part.correctIndex)
    return index === answeredIndex ? 'correct-picked' : 'correct-unpicked';
  return index === answeredIndex ? 'incorrect-picked' : 'incorrect-other';
}

/** The word under a position tile's code. */
export function positionLabel(position: Position, messages: Messages): string {
  return messages.positions[position];
}

const POSITION_CODES: readonly string[] = ['GK', 'DF', 'MF', 'FW'];

/** A slot's value is a string, so a position in it needs narrowing back. */
function isPosition(value: string): value is Position {
  return POSITION_CODES.includes(value);
}

/** A position's short code on a tile, chip or badge: GK, DF, MF, FW in English. */
export function positionCode(position: Position, messages: Messages): string {
  return messages.positionCodes[position];
}

/** The text of one answer option. The part keeps the English key (a
 *  nationality, a position code), so the flag and the choice of distractors
 *  never see a translation. */
export function optionText(
  part: QuestionPart,
  index: number,
  language: SupportedLanguage,
  messages: Messages,
): string {
  const value = part.options[index] ?? '—';
  if (part.kind === 'position') return isPosition(value) ? positionCode(value, messages) : value;
  if (part.kind === 'nationality') return nationalityName(value, language);
  return value;
}

/** What a slot chip prints, or null while its part is being asked. The slot
 *  keeps the English value so the chip can look up its flag. */
export function slotValueText(
  slot: Slot,
  language: SupportedLanguage,
  messages: Messages,
): string | null {
  if (slot.value === null) return null;
  if (slot.key === 'POS' && isPosition(slot.value)) return positionCode(slot.value, messages);
  if (slot.key === 'NAT') return nationalityName(slot.value, language);
  return slot.value;
}

/**
 * What the footer offers (spec §2.4):
 * - waiting for a tap;
 * - after a right answer, the bar that moves on by itself;
 * - after a miss, a button that waits.
 *
 * With a screen reader on, a right answer gets a plain Next button: the round
 * never moves on by itself then.
 */
export type FooterMode = 'waiting' | 'autoNext' | 'next' | 'gotIt';

export function footerMode(verdict: boolean | null, screenReader: boolean): FooterMode {
  if (verdict === null) return 'waiting';
  if (verdict === false) return 'gotIt';
  return screenReader ? 'next' : 'autoNext';
}

export interface NextButtonText {
  /** What the button shows. */
  label: string;
  /** What a screen reader says: the destination, without the visual "tap to skip". */
  spoken: string;
}

/**
 * The footer button's words. The last question's button goes to the results,
 * so it says so. The auto-next bar's label is short enough to fit one line of
 * `ctaLabel` on a 360 dp phone.
 */
export function nextButtonText(
  mode: Exclude<FooterMode, 'waiting'>,
  last: boolean,
  messages: Messages,
): NextButtonText {
  const { round } = messages;
  const spoken = last ? round.seeResults : mode === 'gotIt' ? round.gotItNext : round.nextQuestion;
  if (mode !== 'autoNext') return { label: spoken, spoken };
  return { label: round.tapToSkip(last ? round.seeResults : round.next), spoken };
}

/** The streak haptic's moment: the count just reached 5 or 10 (spec §7). */
export function streakMilestone(previous: number, current: number): boolean {
  return current !== previous && (current === 5 || current === 10);
}

/** A slot chip's screen-reader label. A slot still being asked carries no
 *  value, so its label cannot read out the answer. */
export function slotSpoken(slot: Slot, language: SupportedLanguage, messages: Messages): string {
  // A position by its word: a screen reader spells a code out (#187).
  const value =
    slot.key === 'POS' && slot.value !== null && isPosition(slot.value)
      ? positionLabel(slot.value, messages)
      : (slotValueText(slot, language, messages) ?? '');
  return messages.round.slotSpoken[slot.state](messages.slots[slot.key], value);
}
