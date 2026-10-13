// Pure decision logic for `enrich`: given one player record and what the
// batched Wikipedia, Wikidata and Commons lookups said, the record's next
// photo and birth date, and any conflict a person must settle. The I/O
// lives in commands/enrich.ts.
//
// Rules (spec §8.2):
// - photo is the lookup's verdict, rewritten every run: the article's free
//   lead image, else the Wikidata item's image, when its credit is complete
//   and its licence accepted. A failed lookup keeps the stored photo.
// - birth is filled only where unknown, and only from one day-precise
//   Wikidata date. A stored date Wikidata disagrees with is never
//   overwritten: it is a conflict, and the photo is held with it, because a
//   different birth date is how a title naming the wrong person shows up.
//   A person answers it with `birth <id> <date>`, `birth <id> --keep`
//   (recorded in decisions.json) or `retitle`.
import type { Player, Squad } from '../../../../types/squad.ts';
import type { CreditOutcome, MissingField } from './photo-credit.ts';
import type { ArticleInfo, PersonInfo } from './wikimedia-parse.ts';

export type PhotoStatus =
  | 'ok'
  | 'no-title'
  | 'missing-article'
  | 'disambiguation'
  | 'not-a-person'
  | 'no-free-image'
  | 'refused-licence'
  | 'incomplete-credit'
  | 'held'
  | 'lookup-failed';

export type BirthStatus =
  'filled' | 'agrees' | 'kept' | 'conflict' | 'ambiguous' | 'none' | 'lookup-failed';

/** Report order: shown first, then why not, most fixable last. */
export const PHOTO_STATUSES: readonly PhotoStatus[] = [
  'ok',
  'no-free-image',
  'no-title',
  'missing-article',
  'refused-licence',
  'incomplete-credit',
  'not-a-person',
  'disambiguation',
  'held',
  'lookup-failed',
];

export const BIRTH_STATUSES: readonly BirthStatus[] = [
  'filled',
  'agrees',
  'kept',
  'none',
  'ambiguous',
  'conflict',
  'lookup-failed',
];

export interface Lookups {
  /** Keyed by the title as stored on the player. */
  articles: ReadonlyMap<string, ArticleInfo>;
  /** Keyed by Wikidata item id. */
  people: ReadonlyMap<string, PersonInfo>;
  /** Keyed by file key. */
  credits: ReadonlyMap<string, CreditOutcome>;
  /** Titles, item ids and files whose batch failed after its retries. */
  failedTitles: ReadonlySet<string>;
  failedItems: ReadonlySet<string>;
  failedFiles: ReadonlySet<string>;
}

export interface BirthConflict {
  kind: 'birth-mismatch';
  playerId: string;
  name: string;
  /** The article title the lookup resolved to. */
  title: string;
  qid: string;
  stored: string;
  wikidata: string[];
}

export interface PlayerEnrichment {
  playerId: string;
  photo: PhotoStatus;
  birth: BirthStatus;
  /** The file shown, or the one refused or incomplete. */
  file: string | null;
  licence: string | null;
  imageSource: 'article' | 'wikidata' | null;
  missing: MissingField[];
  conflict: BirthConflict | null;
  /** The record as it should be stored after this run. */
  player: Player;
}

function outcome(
  player: Player,
  photo: PhotoStatus,
  birth: BirthStatus,
  next: Player,
  extra: Partial<PlayerEnrichment> = {},
): PlayerEnrichment {
  return {
    playerId: player.id,
    photo,
    birth,
    file: null,
    licence: null,
    imageSource: null,
    missing: [],
    conflict: null,
    player: next,
    ...extra,
  };
}

function birthVerdict(
  player: Player,
  person: PersonInfo | null,
  kept: ReadonlyMap<string, string>,
): { status: BirthStatus; birth: string | null } {
  const births = person?.births ?? [];
  if (births.length === 0) return { status: 'none', birth: player.birth };
  if (player.birth === null) {
    const only = births.length === 1 ? births[0] : undefined;
    return only === undefined
      ? { status: 'ambiguous', birth: null }
      : { status: 'filled', birth: only };
  }
  if (births.includes(player.birth)) return { status: 'agrees', birth: player.birth };
  // A person confirmed this very date against Wikidata's (`birth --keep`).
  return kept.get(player.id) === player.birth
    ? { status: 'kept', birth: player.birth }
    : { status: 'conflict', birth: player.birth };
}

/** `kept` maps a player id to the stored birth date a person confirmed
 *  against Wikidata (decisions.json `keptBirths`). */
export function enrichPlayer(
  player: Player,
  lookups: Lookups,
  kept: ReadonlyMap<string, string> = new Map(),
): PlayerEnrichment {
  const title = player.wikiTitle;
  if (title === null) return outcome(player, 'no-title', 'none', { ...player, photo: null });

  const article = lookups.articles.get(title);
  if (lookups.failedTitles.has(title) || article === undefined) {
    return outcome(player, 'lookup-failed', 'lookup-failed', player);
  }
  if (article.status === 'missing') {
    return outcome(player, 'missing-article', 'none', { ...player, photo: null });
  }
  if (article.status === 'disambiguation') {
    return outcome(player, 'disambiguation', 'none', { ...player, photo: null });
  }

  let person: PersonInfo | null = null;
  if (article.qid !== null) {
    if (lookups.failedItems.has(article.qid)) {
      return outcome(player, 'lookup-failed', 'lookup-failed', player);
    }
    person = lookups.people.get(article.qid) ?? null;
    if (person !== null && !person.human) {
      return outcome(player, 'not-a-person', 'none', { ...player, photo: null });
    }
  }

  const birth = birthVerdict(player, person, kept);
  const withBirth: Player = { ...player, birth: birth.birth };
  if (birth.status === 'conflict' && article.qid !== null && player.birth !== null) {
    const conflict: BirthConflict = {
      kind: 'birth-mismatch',
      playerId: player.id,
      name: player.name,
      title: article.title,
      qid: article.qid,
      stored: player.birth,
      wikidata: person?.births ?? [],
    };
    return outcome(player, 'held', 'conflict', { ...withBirth, photo: null }, { conflict });
  }

  // The article's lead image first, then the item's own, each tried only if
  // the one before it was looked up and is unusable.
  const candidates: { file: string; source: 'article' | 'wikidata' }[] = [];
  if (article.image !== null) candidates.push({ file: article.image, source: 'article' });
  if (person?.image != null && person.image !== article.image) {
    candidates.push({ file: person.image, source: 'wikidata' });
  }
  const first = candidates[0];
  if (first === undefined) {
    return outcome(player, 'no-free-image', birth.status, { ...withBirth, photo: null });
  }

  for (const candidate of candidates) {
    const credit = lookups.credits.get(candidate.file);
    if (lookups.failedFiles.has(candidate.file) || credit === undefined) {
      return outcome(player, 'lookup-failed', birth.status, withBirth, { file: candidate.file });
    }
    if (credit.status === 'ok') {
      return outcome(
        player,
        'ok',
        birth.status,
        { ...withBirth, photo: credit.credit },
        { file: candidate.file, licence: credit.credit.licence, imageSource: candidate.source },
      );
    }
  }

  // Nothing usable: report why the first candidate was not.
  const firstCredit = lookups.credits.get(first.file);
  const refused = firstCredit?.status === 'refused-licence';
  return outcome(
    player,
    refused ? 'refused-licence' : 'incomplete-credit',
    birth.status,
    { ...withBirth, photo: null },
    {
      file: first.file,
      licence:
        firstCredit !== undefined && firstCredit.status !== 'ok' ? firstCredit.licence : null,
      imageSource: first.source,
      missing: firstCredit?.status === 'incomplete-credit' ? firstCredit.missing : [],
    },
  );
}

export function describeBirthConflict(conflict: BirthConflict): string {
  return `birth date on ${conflict.playerId} ("${conflict.name}") — stored ${conflict.stored}, Wikidata ${conflict.wikidata.join(' or ')} ("${conflict.title}")`;
}

/** The three answers, each as the command that hands it back. */
export function birthConflictFixes(conflict: BirthConflict): string[] {
  const date =
    conflict.wikidata.length === 1
      ? (conflict.wikidata[0] ?? '')
      : `<${conflict.wikidata.join(' | ')}>`;
  return [
    `Wikidata is right:      npm run squadctl -- birth ${conflict.playerId} ${date}`,
    `wrong person:           npm run squadctl -- retitle ${conflict.playerId} "<their article title>"`,
    `stored date is right:   npm run squadctl -- birth ${conflict.playerId} --keep`,
  ];
}

/** A real `YYYY-MM-DD` calendar date — 1998-02-29 is not one. */
export function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** The players a `--only` run looks up: every member of the named teams. */
export function playersInTeams(
  players: readonly Player[],
  squads: readonly Squad[],
  teamIds: readonly string[],
): Player[] {
  const wanted = new Set(
    squads.filter((s) => teamIds.includes(s.id)).flatMap((s) => s.members.map((m) => m.playerId)),
  );
  return players.filter((p) => wanted.has(p.id));
}

export interface EnrichSummary {
  players: number;
  photo: Partial<Record<PhotoStatus, number>>;
  birth: Partial<Record<BirthStatus, number>>;
  /** Licence mix of the photos that will be shown. */
  licences: Record<string, number>;
  changed: { photos: number; births: number; records: number };
}

export function summarize(
  before: readonly Player[],
  results: readonly PlayerEnrichment[],
): EnrichSummary {
  const byId = new Map(before.map((p) => [p.id, p]));
  const summary: EnrichSummary = {
    players: results.length,
    photo: {},
    birth: {},
    licences: {},
    changed: { photos: 0, births: 0, records: 0 },
  };
  for (const result of results) {
    summary.photo[result.photo] = (summary.photo[result.photo] ?? 0) + 1;
    summary.birth[result.birth] = (summary.birth[result.birth] ?? 0) + 1;
    const licence = result.player.photo?.licence;
    if (result.photo === 'ok' && licence !== undefined) {
      summary.licences[licence] = (summary.licences[licence] ?? 0) + 1;
    }
    const old = byId.get(result.playerId);
    if (old === undefined) continue;
    if (JSON.stringify(old.photo) !== JSON.stringify(result.player.photo)) summary.changed.photos++;
    if (old.birth !== result.player.birth) summary.changed.births++;
    if (JSON.stringify(old) !== JSON.stringify(result.player)) summary.changed.records++;
  }
  return summary;
}
