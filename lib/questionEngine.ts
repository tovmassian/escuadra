// Pure question/round builder. No React, no store imports, no I/O — every
// input arrives as a parameter (roster, level, seed) and every random choice
// routes through the injected RNG, so `buildRound` is deterministic per seed
// and trivially unit-testable. This is the piece most likely to need
// iteration, per CLAUDE.md, and distractor quality is what makes or breaks
// the whole game: wrong options must be genuinely confusable, not random.
import { getAge } from './age';
import { createRng, shuffle } from './prng';
import { ROUND_LENGTH } from './scoring';
import type { Position, RosterEntry, Squad } from '@/types/squad';

export type Level = 1 | 2 | 3;

export type QuestionPart =
  | { kind: 'name'; options: string[]; correctIndex: number }
  | { kind: 'position'; options: Position[]; correctIndex: number }
  | { kind: 'nationality'; options: string[]; correctIndex: number }
  | { kind: 'club'; options: string[]; correctIndex: number };

export interface Question {
  playerId: string;
  playerName: string;
  memberNo: number;
  age: number;
  /** The subject's actual position — always present, even at level 1 where
   *  no `position` part is asked, so the level-1 stat chip has something to show. */
  position: Position;
  /** Nationality on a club squad, club on a nation squad — the same
   *  conditional as the level-3 third part (`squad.kind` decides which),
   *  surfaced here as a stat chip on levels 1-2 too, where it isn't the
   *  thing being tested. Falls back to '—' for the rare nation-squad player
   *  missing club data. */
  affiliation: string;
  parts: QuestionPart[];
}

export interface BuildRoundOptions {
  squad: Squad;
  /** Pre-joined by the caller (see `lib/squads.ts#getRoster`) — the engine
   *  does no data loading of its own. */
  roster: RosterEntry[];
  level: Level;
  /** Defaults to `Date.now()`; tests always pass one explicitly. */
  seed?: number;
  size?: number;
  /** Defaults to `new Date()`; pass explicitly in tests for deterministic ages. */
  now?: Date;
}

const POSITIONS: readonly Position[] = ['GK', 'DF', 'MF', 'FW'];

// Level-3 fallback pools, used only when a squad's own roster isn't diverse
// enough to supply genuinely-different nationality/club distractors on its
// own. Plain literals, not I/O — but the one place this file carries
// embedded reference data, worth flagging as such.
const FALLBACK_NATIONALITIES: readonly string[] = [
  'England',
  'France',
  'Spain',
  'Germany',
  'Italy',
  'Argentina',
  'Portugal',
  'Netherlands',
  'Belgium',
  'Croatia',
];
const FALLBACK_CLUBS: readonly string[] = [
  'Manchester United',
  'Chelsea',
  'Bayern Munich',
  'Juventus',
  'Inter Milan',
  'Atletico Madrid',
  'AC Milan',
  'Borussia Dortmund',
];

function nameDistractorCount(level: Level): number {
  return level === 3 ? 5 : 3;
}

/** Fills `needed` distinct values from `pool`, excluding `exclude`, topping
 *  up from `fallback` when the pool runs short. */
function pickDistractorValues(
  pool: readonly string[],
  needed: number,
  rng: () => number,
  fallback: readonly string[],
  exclude: string,
): string[] {
  const uniquePool = Array.from(new Set(pool)).filter((v) => v !== exclude);
  const chosen = shuffle(uniquePool, rng).slice(0, needed);
  if (chosen.length < needed) {
    const remaining = fallback.filter((v) => v !== exclude && !chosen.includes(v));
    chosen.push(...shuffle(remaining, rng).slice(0, needed - chosen.length));
  }
  return chosen;
}

function buildNamePart(
  subject: RosterEntry,
  roster: RosterEntry[],
  needed: number,
  rng: () => number,
): QuestionPart {
  const others = roster.filter((r) => r.player.id !== subject.player.id);
  // Tier 1: same position — genuinely confusable. Tier 2: rest of the squad,
  // used only to top up when tier 1 is short (e.g. a squad with two keepers).
  const samePosition = shuffle(
    others.filter((r) => r.player.position === subject.player.position),
    rng,
  );
  const rest = shuffle(
    others.filter((r) => r.player.position !== subject.player.position),
    rng,
  );
  const distractorNames = [...samePosition, ...rest].slice(0, needed).map((r) => r.player.name);

  const options = shuffle([subject.player.name, ...distractorNames], rng);
  return { kind: 'name', options, correctIndex: options.indexOf(subject.player.name) };
}

function buildPositionPart(subject: RosterEntry): QuestionPart {
  return {
    kind: 'position',
    options: [...POSITIONS],
    correctIndex: POSITIONS.indexOf(subject.player.position),
  };
}

function buildNationalityPart(
  subject: RosterEntry,
  roster: RosterEntry[],
  rng: () => number,
): QuestionPart {
  const correct = subject.player.nationality;
  const pool = roster.map((r) => r.player.nationality);
  const distractors = pickDistractorValues(pool, 3, rng, FALLBACK_NATIONALITIES, correct);
  const options = shuffle([correct, ...distractors], rng);
  return { kind: 'nationality', options, correctIndex: options.indexOf(correct) };
}

function buildClubPart(
  subject: RosterEntry,
  roster: RosterEntry[],
  rng: () => number,
): QuestionPart {
  const correct = subject.player.club;
  if (!correct) {
    throw new Error(
      `buildRound: level-3 club question needs Player.club, but "${subject.player.name}" (${subject.player.id}) has none. This is a data-authoring bug — every nation-squad player must have a club.`,
    );
  }
  const pool = roster.map((r) => r.player.club).filter((c): c is string => c !== null);
  const distractors = pickDistractorValues(pool, 3, rng, FALLBACK_CLUBS, correct);
  const options = shuffle([correct, ...distractors], rng);
  return { kind: 'club', options, correctIndex: options.indexOf(correct) };
}

export function buildRound(opts: BuildRoundOptions): Question[] {
  const { squad, roster, level, seed = Date.now(), size = ROUND_LENGTH, now = new Date() } = opts;
  const rng = createRng(seed);

  const minRosterSize = level === 3 ? 6 : 4;
  if (roster.length < minRosterSize) {
    throw new Error(
      `buildRound: squad "${squad.id}" has ${roster.length} members, needs at least ${minRosterSize} for level ${level}.`,
    );
  }

  const needed = nameDistractorCount(level);
  const subjects = shuffle(roster, rng).slice(0, Math.min(size, roster.length));

  return subjects.map((subject) => {
    const parts: QuestionPart[] = [buildNamePart(subject, roster, needed, rng)];
    if (level >= 2) parts.push(buildPositionPart(subject));
    if (level >= 3) {
      parts.push(
        squad.kind === 'club'
          ? buildNationalityPart(subject, roster, rng)
          : buildClubPart(subject, roster, rng),
      );
    }
    return {
      playerId: subject.player.id,
      playerName: subject.player.name,
      memberNo: subject.member.no,
      age: getAge(subject.player.birth, now),
      position: subject.player.position,
      affiliation:
        squad.kind === 'club' ? subject.player.nationality : (subject.player.club ?? '—'),
      parts,
    };
  });
}

/** No partial credit: every part of a question must match. */
export function isQuestionCorrect(
  question: Question,
  pickedIndexes: readonly (number | null)[],
): boolean {
  return question.parts.every((part, i) => pickedIndexes[i] === part.correctIndex);
}
