// Pure readers for the Wikipedia and Wikidata responses `enrich` batches:
// each player article's lead image and Wikidata item, and each item's
// person-ness, birth date and image. Commons credits are photo-credit.ts.
// No network here — lib/wikimedia-fetch.ts makes the requests.
import { fileKey } from './photo-credit.ts';

/** MediaWiki's per-request title and id limit for clients without the
 *  apihighlimits right. */
export const BATCH_SIZE = 50;

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size));
  return batches;
}

export type ArticleInfo =
  | { status: 'ok'; title: string; image: string | null; qid: string | null }
  | { status: 'missing'; title: string }
  | { status: 'disambiguation'; title: string };

interface TitleMapping {
  from: string;
  to: string;
}

interface WikiPage {
  title: string;
  missing?: boolean;
  invalid?: boolean;
  pageimage?: string;
  pageprops?: { wikibase_item?: string; disambiguation?: string };
}

interface PagesResponse {
  query?: { normalized?: TitleMapping[]; redirects?: TitleMapping[]; pages?: WikiPage[] };
}

/** Each requested title's article, across one batch's responses (more than
 *  one when the query was `continue`d, which splits a page's props). Follows
 *  MediaWiki's title normalisation, then redirects. A title the responses do
 *  not answer is absent, never guessed. */
export function articlesByTitle(
  titles: readonly string[],
  responses: readonly unknown[],
): Map<string, ArticleInfo> {
  const moves = new Map<string, string>();
  const pages = new Map<string, WikiPage>();
  for (const response of responses) {
    const query = (response as PagesResponse).query ?? {};
    for (const { from, to } of [...(query.normalized ?? []), ...(query.redirects ?? [])]) {
      moves.set(from, to);
    }
    for (const page of query.pages ?? []) {
      const seen = pages.get(page.title);
      pages.set(
        page.title,
        seen === undefined
          ? page
          : {
              ...seen,
              ...page,
              pageimage: page.pageimage ?? seen.pageimage,
              pageprops: { ...seen.pageprops, ...page.pageprops },
            },
      );
    }
  }

  const result = new Map<string, ArticleInfo>();
  for (const requested of titles) {
    // Normalised, then redirected: at most a couple of hops, bounded so a
    // malformed response cannot loop.
    let title = requested;
    for (let hop = 0; hop < 4 && moves.has(title); hop++) title = moves.get(title) ?? title;
    const page = pages.get(title);
    if (page === undefined) continue;
    if (page.missing === true || page.invalid === true) {
      result.set(requested, { status: 'missing', title });
    } else if (page.pageprops?.disambiguation !== undefined) {
      result.set(requested, { status: 'disambiguation', title });
    } else {
      result.set(requested, {
        status: 'ok',
        title,
        image: page.pageimage === undefined ? null : fileKey(page.pageimage),
        qid: page.pageprops?.wikibase_item ?? null,
      });
    }
  }
  return result;
}

export interface PersonInfo {
  /** `instance of` (P31) includes human (Q5). A club's item has an image
   *  too — its stadium — so a photo needs this. */
  human: boolean;
  /** Distinct day-precise birth dates (P569), `YYYY-MM-DD`, sorted. More
   *  than one when Wikidata's own claims disagree. */
  births: string[];
  /** The item's image (P18) as a file key, or null. */
  image: string | null;
}

interface Snak {
  snaktype?: string;
  datavalue?: { value?: unknown };
}

interface Claim {
  rank?: string;
  mainsnak?: Snak;
}

interface EntitiesResponse {
  entities?: Record<string, { missing?: string; claims?: Record<string, Claim[] | undefined> }>;
}

/** The claims a reading uses: deprecated ones never, and only the
 *  preferred-rank ones when any exist — Wikidata's own way of saying which
 *  of several statements is current. */
function rankedClaims(claims: readonly Claim[] | undefined): Claim[] {
  const usable = (claims ?? []).filter(
    (c) => c.rank !== 'deprecated' && c.mainsnak?.snaktype === 'value',
  );
  const preferred = usable.filter((c) => c.rank === 'preferred');
  return preferred.length > 0 ? preferred : usable;
}

const DAY_PRECISION = 11;
const GREGORIAN = 'http://www.wikidata.org/entity/Q1985727';

interface TimeValue {
  time?: string;
  precision?: number;
  calendarmodel?: string;
}

/** Day-precise Gregorian dates of birth from P569 claims. */
export function birthDates(claims: readonly unknown[] | undefined): string[] {
  const dates = new Set<string>();
  for (const claim of rankedClaims(claims as Claim[] | undefined)) {
    const value = claim.mainsnak?.datavalue?.value as TimeValue | undefined;
    if (value?.precision !== DAY_PRECISION || value.calendarmodel !== GREGORIAN) continue;
    const match = /^\+(\d{4}-\d{2}-\d{2})T/.exec(value.time ?? '');
    if (match?.[1] !== undefined) dates.add(match[1]);
  }
  return [...dates].sort();
}

const HUMAN = 'Q5';

/** Each Wikidata item across a batch's responses. A missing item is absent. */
export function peopleById(responses: readonly unknown[]): Map<string, PersonInfo> {
  const result = new Map<string, PersonInfo>();
  for (const response of responses) {
    for (const [id, entity] of Object.entries((response as EntitiesResponse).entities ?? {})) {
      if (entity.missing !== undefined) continue;
      const claims = entity.claims ?? {};
      const instanceOf = rankedClaims(claims.P31).map(
        (c) => (c.mainsnak?.datavalue?.value as { id?: string } | undefined)?.id,
      );
      const image = rankedClaims(claims.P18)[0]?.mainsnak?.datavalue?.value;
      result.set(id, {
        human: instanceOf.includes(HUMAN),
        births: birthDates(claims.P569),
        image: typeof image === 'string' ? fileKey(image) : null,
      });
    }
  }
  return result;
}

/** The claims `peopleById` reads. Everything else is dropped before a
 *  response is cached: a footballer's item carries hundreds of claims, and
 *  the whole player base is ~80 MB untrimmed against well under 1 MB
 *  trimmed. A rule that needs another property needs one online run. */
const KEPT_PROPERTIES = ['P31', 'P569', 'P18'];

export function trimEntities(response: unknown): unknown {
  const entities = (response as EntitiesResponse).entities ?? {};
  return {
    entities: Object.fromEntries(
      Object.entries(entities).map(([id, entity]) => {
        if (entity.missing !== undefined) return [id, { id, missing: entity.missing }];
        const claims = Object.fromEntries(
          Object.entries(entity.claims ?? {})
            .filter(([property]) => KEPT_PROPERTIES.includes(property))
            .map(([property, list]) => [
              property,
              (list ?? []).map(({ rank, mainsnak }) => ({ rank, mainsnak })),
            ]),
        );
        return [id, { id, claims }];
      }),
    ),
  };
}
