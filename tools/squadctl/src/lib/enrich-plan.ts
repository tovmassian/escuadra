// Pure decision logic for `enrich`: given one player record and what the
// batched Wikipedia, Wikidata and Commons lookups said, the record's next
// photo and birth date, and any conflict a person must settle — and which
// Commons files the lookups still need for that. The I/O lives in
// commands/enrich.ts.
//
// Rules (spec §8.2):
// - photo is the lookup's verdict, rewritten every run: the article's free
//   lead image, else the Wikidata item's image, when its credit is complete,
//   its licence accepted and its credit does not name the player. A failed
//   lookup keeps the stored photo.
// - birth is filled only where unknown, and only from one day-precise
//   Wikidata date that puts the player at a playing age in their squad's
//   season. A filled date's only source is the item it came from, so
//   nothing can cross-check it: an age no current player has is how a title
//   naming an older namesake shows up, as `implausible-birth`. A namesake of
//   the same age is not caught here.
// - A stored date Wikidata disagrees with is never overwritten: it is a
//   `birth-mismatch`, because a different birth date is how a title naming
//   the wrong person shows up. A person answers it with `birth <id> <date>`,
//   `birth <id> --keep` (recorded in decisions.json) or `retitle`.
// - Either conflict holds the photo with it.
import type { PhotoCredit, Player } from '../../../../types/squad.ts';
import { creditNamesPlayer, type CreditOutcome, type MissingField } from './photo-credit.ts';
import { normalizeName } from '../../../../scripts/roster-envelope.ts';
import type { ArticleInfo, InfoboxInfo, PersonInfo } from './wikimedia-parse.ts';

export type PhotoStatus =
  | 'ok'
  | 'no-title'
  | 'missing-article'
  | 'disambiguation'
  | 'not-a-person'
  | 'no-free-image'
  | 'refused-licence'
  | 'incomplete-credit'
  | 'credit-names-player'
  | 'held'
  | 'lookup-failed';

export type BirthStatus =
  | 'filled'
  | 'agrees'
  | 'kept'
  | 'confirmed'
  | 'corrected'
  | 'conflict'
  | 'ambiguous'
  | 'none'
  | 'lookup-failed';

/** Report order: shown first, then why not, most fixable last. */
export const PHOTO_STATUSES: readonly PhotoStatus[] = [
  'ok',
  'no-free-image',
  'no-title',
  'missing-article',
  'refused-licence',
  'incomplete-credit',
  'credit-names-player',
  'not-a-person',
  'disambiguation',
  'held',
  'lookup-failed',
];

export const BIRTH_STATUSES: readonly BirthStatus[] = [
  'filled',
  'agrees',
  'kept',
  'confirmed',
  'corrected',
  'none',
  'ambiguous',
  'conflict',
  'lookup-failed',
];

/** The ages a squad's players are found at, in years on 1 July of the
 *  season's first year. The base's youngest is 15 and oldest 43 (2026). */
export const PLAYING_AGE = { min: 15, max: 45 } as const;

export interface Lookups {
  /** Keyed by the title as stored on the player. */
  articles: ReadonlyMap<string, ArticleInfo>;
  /** Keyed by Wikidata item id; null when Wikidata has no such item. */
  people: ReadonlyMap<string, PersonInfo | null>;
  /** Keyed by file key. */
  credits: ReadonlyMap<string, CreditOutcome>;
  /** Titles, item ids and files no lookup answered: their batch failed after
   *  its retries, the reply skipped them, or nothing was cached offline. */
  failedTitles: ReadonlySet<string>;
  failedItems: ReadonlySet<string>;
  failedFiles: ReadonlySet<string>;
  /** Keyed by article title: asked only where the birth dates disagree. */
  infoboxes: ReadonlyMap<string, InfoboxInfo>;
  failedInfoboxes: ReadonlySet<string>;
}

/** What a run knows beyond the lookups. */
export interface EnrichContext {
  /** Player id → the stored birth date a person confirmed against
   *  Wikidata's (decisions.json `keptBirths`). */
  kept: ReadonlyMap<string, string>;
  /** Player id → their latest squad season's first year (`seasonYears`).
   *  A player in no squad is in no season, and gets no age check. */
  seasonYears: ReadonlyMap<string, number>;
}

const NO_CONTEXT: EnrichContext = { kept: new Map(), seasonYears: new Map() };

interface ConflictSubject {
  playerId: string;
  name: string;
  /** The article title the lookup resolved to. */
  title: string;
  qid: string;
}

export type BirthConflict =
  | (ConflictSubject & { kind: 'birth-mismatch'; stored: string; wikidata: string[] })
  | (ConflictSubject & {
      kind: 'implausible-birth';
      wikidata: string;
      seasonYear: number;
      age: number;
    });

export interface PlayerEnrichment {
  playerId: string;
  photo: PhotoStatus;
  birth: BirthStatus;
  /** The file shown, or the one refused, incomplete or not answered. */
  file: string | null;
  licence: string | null;
  imageSource: 'article' | 'wikidata' | null;
  /** Why an `incomplete-credit` photo was not shown. */
  missing: MissingField[];
  /** The credit that named the player, for a `credit-names-player` photo. */
  author: string | null;
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
    author: null,
    conflict: null,
    player: next,
    ...extra,
  };
}

/** Whole years of age on 1 July of `seasonYear`. */
export function ageInSeason(birth: string, seasonYear: number): number {
  const year = Number.parseInt(birth.slice(0, 4), 10);
  return seasonYear - year - (birth.slice(5) > '07-01' ? 1 : 0);
}

type OkArticle = Extract<ArticleInfo, { status: 'ok' }>;

/** Who the record's title leads to, or the outcome that ends the lookup
 *  before there is anyone to photograph. */
type Resolution =
  | { kind: 'person'; article: OkArticle; person: PersonInfo | null }
  | { kind: 'ended'; result: PlayerEnrichment };

function resolve(player: Player, lookups: Lookups): Resolution {
  const ended = (photo: PhotoStatus, birth: BirthStatus, next: Player): Resolution => ({
    kind: 'ended',
    result: outcome(player, photo, birth, next),
  });
  const title = player.wikiTitle;
  if (title === null) return ended('no-title', 'none', { ...player, photo: null });

  const article = lookups.articles.get(title);
  if (lookups.failedTitles.has(title) || article === undefined) {
    return ended('lookup-failed', 'lookup-failed', player);
  }
  if (article.status === 'missing') {
    return ended('missing-article', 'none', { ...player, photo: null });
  }
  if (article.status === 'disambiguation') {
    return ended('disambiguation', 'none', { ...player, photo: null });
  }

  let person: PersonInfo | null = null;
  if (article.qid !== null) {
    const answered = lookups.people.get(article.qid);
    if (lookups.failedItems.has(article.qid) || answered === undefined) {
      return ended('lookup-failed', 'lookup-failed', player);
    }
    person = answered;
    if (person !== null && !person.human) {
      return ended('not-a-person', 'none', { ...player, photo: null });
    }
  }
  return { kind: 'person', article, person };
}

/** The same club, however each source writes it: `Inter Turku` and
 *  `FC Inter Turku`, `Valenzuela PB–Mendiola` and `Valenzuela PB-Mendiola`. */
function clubsAgree(infobox: string | null, ours: string | null): boolean {
  if (infobox === null || ours === null) return false;
  const compact = (club: string) => normalizeName(club).replace(/[^a-z0-9]/g, '');
  const [a, b] = [compact(infobox), compact(ours)];
  return a.length >= 3 && b.length >= 3 && (a.includes(b) || b.includes(a));
}

/** The stored date and Wikidata's disagree. The article's own infobox breaks
 *  the tie, as the README asks a person to — this project's source is
 *  Wikipedia:
 *
 *  - infobox = stored: Wikidata is the odd one out. The stored date stands.
 *  - infobox = Wikidata, and its current club is ours: the stored date is a
 *    typo in the squad table. Wikidata's date is written.
 *  - otherwise no majority, or a club that says the article may be a
 *    namesake's (Iraq's Hussein Hassan links an Al-Zawraa player's article;
 *    the squad says Erbil). The conflict stays for a person. */
function tieBreak(
  player: Player & { birth: string },
  births: readonly string[],
  infobox: InfoboxInfo | undefined,
): { status: BirthStatus; birth: string } | null {
  if (infobox?.birth === player.birth) return { status: 'confirmed', birth: player.birth };
  if (
    infobox?.birth != null &&
    births.includes(infobox.birth) &&
    clubsAgree(infobox.club, player.club)
  ) {
    return { status: 'corrected', birth: infobox.birth };
  }
  return null;
}

function birthVerdict(
  player: Player,
  article: OkArticle,
  person: PersonInfo | null,
  context: EnrichContext,
  infobox: InfoboxInfo | undefined,
): { status: BirthStatus; birth: string | null; conflict: BirthConflict | null } {
  const births = person?.births ?? [];
  // Births come from the item, so there is one whenever there are births.
  if (births.length === 0 || article.qid === null) {
    return { status: 'none', birth: player.birth, conflict: null };
  }
  const subject = {
    playerId: player.id,
    name: player.name,
    title: article.title,
    qid: article.qid,
  };
  if (player.birth === null) {
    const only = births.length === 1 ? births[0] : undefined;
    if (only === undefined) return { status: 'ambiguous', birth: null, conflict: null };
    const seasonYear = context.seasonYears.get(player.id);
    if (seasonYear !== undefined) {
      const age = ageInSeason(only, seasonYear);
      if (age < PLAYING_AGE.min || age > PLAYING_AGE.max) {
        return {
          status: 'conflict',
          birth: null,
          conflict: { ...subject, kind: 'implausible-birth', wikidata: only, seasonYear, age },
        };
      }
    }
    return { status: 'filled', birth: only, conflict: null };
  }
  if (births.includes(player.birth)) {
    return { status: 'agrees', birth: player.birth, conflict: null };
  }
  // A person confirmed this very date against Wikidata's (`birth --keep`).
  if (context.kept.get(player.id) === player.birth) {
    return { status: 'kept', birth: player.birth, conflict: null };
  }
  const settled = tieBreak({ ...player, birth: player.birth }, births, infobox);
  if (settled !== null) return { ...settled, conflict: null };
  return {
    status: 'conflict',
    birth: player.birth,
    conflict: { ...subject, kind: 'birth-mismatch', stored: player.birth, wikidata: births },
  };
}

interface Candidate {
  file: string;
  source: 'article' | 'wikidata';
}

/** The images a photo is chosen from, in order: the article's lead image,
 *  then the item's own. */
function photoCandidates(article: OkArticle, person: PersonInfo | null): Candidate[] {
  const candidates: Candidate[] = [];
  if (article.image !== null) candidates.push({ file: article.image, source: 'article' });
  if (person?.image != null && person.image !== article.image) {
    candidates.push({ file: person.image, source: 'wikidata' });
  }
  return candidates;
}

/** How far down its candidates a photo gets: to the first one Commons has
 *  not answered, else to the first usable one, else through them all. Each
 *  is tried only if the one before it was answered and is unusable. A
 *  credit that names the player makes its photo unusable: the credit shows
 *  for the whole question (guardrail 1), and is never rewritten to fit. */
type Walk =
  | { state: 'unanswered'; candidate: Candidate }
  | { state: 'ok'; candidate: Candidate; credit: PhotoCredit }
  | { state: 'unusable' };

function walk(
  candidates: readonly Candidate[],
  lookups: Lookups,
  player: Pick<Player, 'name' | 'fullName'>,
): Walk {
  for (const candidate of candidates) {
    const credit = lookups.credits.get(candidate.file);
    if (lookups.failedFiles.has(candidate.file) || credit === undefined) {
      return { state: 'unanswered', candidate };
    }
    if (credit.status === 'ok' && !creditNamesPlayer(credit.credit.author, player)) {
      return { state: 'ok', candidate, credit: credit.credit };
    }
  }
  return { state: 'unusable' };
}

export function enrichPlayer(
  player: Player,
  lookups: Lookups,
  context: EnrichContext = NO_CONTEXT,
): PlayerEnrichment {
  const resolved = resolve(player, lookups);
  if (resolved.kind === 'ended') return resolved.result;
  const { article, person } = resolved;

  const birth = birthVerdict(
    player,
    article,
    person,
    context,
    lookups.infoboxes.get(article.title),
  );
  const withBirth: Player = { ...player, birth: birth.birth };
  if (birth.conflict !== null) {
    return outcome(
      player,
      'held',
      'conflict',
      { ...withBirth, photo: null },
      { conflict: birth.conflict },
    );
  }

  const candidates = photoCandidates(article, person);
  const first = candidates[0];
  if (first === undefined) {
    return outcome(player, 'no-free-image', birth.status, { ...withBirth, photo: null });
  }
  const reached = walk(candidates, lookups, player);
  if (reached.state === 'unanswered') {
    return outcome(player, 'lookup-failed', birth.status, withBirth, {
      file: reached.candidate.file,
    });
  }
  if (reached.state === 'ok') {
    return outcome(
      player,
      'ok',
      birth.status,
      { ...withBirth, photo: reached.credit },
      {
        file: reached.candidate.file,
        licence: reached.credit.licence,
        imageSource: reached.candidate.source,
      },
    );
  }

  // Nothing usable: report why the first candidate was not. A complete
  // credit that is not usable is one that names the player.
  const firstCredit = lookups.credits.get(first.file);
  if (firstCredit?.status === 'ok') {
    return outcome(
      player,
      'credit-names-player',
      birth.status,
      { ...withBirth, photo: null },
      {
        file: first.file,
        licence: firstCredit.credit.licence,
        imageSource: first.source,
        author: firstCredit.credit.author,
      },
    );
  }
  const refused = firstCredit?.status === 'refused-licence';
  return outcome(
    player,
    refused ? 'refused-licence' : 'incomplete-credit',
    birth.status,
    { ...withBirth, photo: null },
    {
      file: first.file,
      licence: firstCredit?.licence ?? null,
      imageSource: first.source,
      missing: firstCredit?.status === 'incomplete-credit' ? firstCredit.missing : [],
    },
  );
}

/** The Commons files the photos still wait on: each player's next candidate
 *  that no lookup has answered or failed yet — the article's image first,
 *  the item's own only once that one is answered and unusable. The same
 *  walk `enrichPlayer` takes, so the candidate rule lives in one place; empty
 *  once every photo is decided. A held player's files are included, so the
 *  answer to a birth conflict re-runs with `--offline`. */
export function pendingFiles(players: readonly Player[], lookups: Lookups): string[] {
  const pending = new Set<string>();
  for (const player of players) {
    const resolved = resolve(player, lookups);
    if (resolved.kind === 'ended') continue;
    const reached = walk(photoCandidates(resolved.article, resolved.person), lookups, player);
    if (reached.state === 'unanswered' && !lookups.failedFiles.has(reached.candidate.file)) {
      pending.add(reached.candidate.file);
    }
  }
  return [...pending].sort();
}

/** The article titles whose infobox a birth tie still waits on: every
 *  record whose stored date Wikidata does not give, not yet answered or
 *  failed. A `--keep`ed one is asked too; its answer is simply unused. */
export function pendingInfoboxes(players: readonly Player[], lookups: Lookups): string[] {
  const pending = new Set<string>();
  for (const player of players) {
    if (player.birth === null) continue;
    const resolved = resolve(player, lookups);
    if (resolved.kind === 'ended') continue;
    const births = resolved.person?.births ?? [];
    const title = resolved.article.title;
    if (births.length === 0 || births.includes(player.birth)) continue;
    if (lookups.infoboxes.has(title) || lookups.failedInfoboxes.has(title)) continue;
    pending.add(title);
  }
  return [...pending].sort();
}

export function describeBirthConflict(conflict: BirthConflict): string {
  const who = `birth date on ${conflict.playerId} ("${conflict.name}")`;
  return conflict.kind === 'birth-mismatch'
    ? `${who} — stored ${conflict.stored}, Wikidata ${conflict.wikidata.join(' or ')} ("${conflict.title}")`
    : `${who} — Wikidata's ${conflict.wikidata} ("${conflict.title}") makes them ${conflict.age} in ${conflict.seasonYear}, outside playing age ${PLAYING_AGE.min}–${PLAYING_AGE.max}`;
}

/** The answers, each as the command that hands it back. */
export function birthConflictFixes(conflict: BirthConflict): string[] {
  const retitle = `wrong person:           npm run squadctl -- retitle ${conflict.playerId} "<their article title>"`;
  if (conflict.kind === 'implausible-birth') {
    return [
      retitle,
      `the date is right:      npm run squadctl -- birth ${conflict.playerId} ${conflict.wikidata}`,
    ];
  }
  const date =
    conflict.wikidata.length === 1
      ? (conflict.wikidata[0] ?? '')
      : `<${conflict.wikidata.join(' | ')}>`;
  return [
    `Wikidata is right:      npm run squadctl -- birth ${conflict.playerId} ${date}`,
    retitle,
    `stored date is right:   npm run squadctl -- birth ${conflict.playerId} --keep`,
  ];
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
