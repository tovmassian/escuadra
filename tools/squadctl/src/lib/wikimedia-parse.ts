// The Wikipedia and Wikidata lookups `enrich` batches: each player article's
// lead image and Wikidata item, and each item's person-ness, birth date and
// image. Each query sits beside the reader that depends on it, so a field
// read is a field asked for. Commons credits are photo-credit.ts. Pure —
// lib/wikimedia-fetch.ts sends the queries and caches each key's answer.
import { fileKey } from '../../../../scripts/commons.ts';
import type { Lookup } from './wikimedia-fetch.ts';

export const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';
export const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';

interface TitleMapping {
  from: string;
  to: string;
}

interface QueryReply<Page> {
  query?: { normalized?: TitleMapping[]; redirects?: TitleMapping[]; pages?: Page[] };
}

/** Each requested title's page across one batch's `action=query` replies,
 *  following MediaWiki's title normalisation, then redirects. A page that
 *  continued replies answer more than once is combined by `merge`. A title
 *  the replies do not answer is absent. */
export function pagesByTitle<Page extends { title: string }>(
  titles: readonly string[],
  replies: readonly unknown[],
  merge: (seen: Page, next: Page) => Page,
): Map<string, Page> {
  const moves = new Map<string, string>();
  const pages = new Map<string, Page>();
  for (const reply of replies) {
    const query = (reply as QueryReply<Page>).query ?? {};
    for (const { from, to } of [...(query.normalized ?? []), ...(query.redirects ?? [])]) {
      moves.set(from, to);
    }
    for (const page of query.pages ?? []) {
      const seen = pages.get(page.title);
      pages.set(page.title, seen === undefined ? page : merge(seen, page));
    }
  }
  const result = new Map<string, Page>();
  for (const requested of titles) {
    // Normalised, then redirected: at most a couple of hops, bounded so a
    // malformed reply cannot loop.
    let title = requested;
    for (let hop = 0; hop < 4 && moves.has(title); hop++) title = moves.get(title) ?? title;
    const page = pages.get(title);
    if (page !== undefined) result.set(requested, page);
  }
  return result;
}

export type ArticleInfo =
  | { status: 'ok'; title: string; image: string | null; qid: string | null }
  | { status: 'missing'; title: string }
  | { status: 'disambiguation'; title: string };

interface WikiPage {
  title: string;
  missing?: boolean;
  invalid?: boolean;
  pageimage?: string;
  pageprops?: { wikibase_item?: string; disambiguation?: string };
}

/** What the page a title leads to says. */
export function readArticle(page: WikiPage): ArticleInfo {
  if (page.missing === true || page.invalid === true) {
    return { status: 'missing', title: page.title };
  }
  if (page.pageprops?.disambiguation !== undefined) {
    return { status: 'disambiguation', title: page.title };
  }
  return {
    status: 'ok',
    title: page.title,
    image: page.pageimage === undefined ? null : fileKey(page.pageimage),
    qid: page.pageprops?.wikibase_item ?? null,
  };
}

/** Each title's article: its free lead image and Wikidata item. */
export const ARTICLES: Lookup<ArticleInfo, WikiPage> = {
  name: 'wikipedia',
  endpoint: WIKIPEDIA_API,
  params: (titles) => ({
    action: 'query',
    prop: 'pageimages|pageprops',
    piprop: 'name',
    pilicense: 'free',
    pilimit: '50',
    ppprop: 'wikibase_item|disambiguation',
    redirects: '1',
    titles: titles.join('|'),
  }),
  // `continue` splits one page's props across replies: the image in one,
  // the Wikidata item in the next.
  answers: (titles, replies) =>
    pagesByTitle<WikiPage>(titles, replies, (seen, next) => ({
      ...seen,
      ...next,
      pageimage: next.pageimage ?? seen.pageimage,
      pageprops: { ...seen.pageprops, ...next.pageprops },
    })),
  read: readArticle,
};

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

/** The claims `readPerson` reads, and all an item keeps once cached: a
 *  footballer's item carries hundreds of claims, and the whole player base
 *  is ~80 MB untrimmed against well under 1 MB trimmed. Typed, so reading a
 *  property not kept here does not compile — and a newly kept one needs one
 *  online run to reach the cache. */
const KEPT_PROPERTIES = ['P31', 'P569', 'P18'] as const;
type KeptProperty = (typeof KEPT_PROPERTIES)[number];

/** An item as cached: its kept claims, or the mark that it does not exist. */
export interface Entity {
  id: string;
  missing?: string;
  claims?: Partial<Record<KeptProperty, Claim[]>>;
}

interface EntitiesReply {
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

/** What an item says about its person; null when Wikidata has no such item. */
export function readPerson(entity: Entity): PersonInfo | null {
  if (entity.missing !== undefined) return null;
  const claims = entity.claims ?? {};
  const instanceOf = rankedClaims(claims.P31).map(
    (c) => (c.mainsnak?.datavalue?.value as { id?: string } | undefined)?.id,
  );
  const image = rankedClaims(claims.P18)[0]?.mainsnak?.datavalue?.value;
  return {
    human: instanceOf.includes(HUMAN),
    births: birthDates(claims.P569),
    image: typeof image === 'string' ? fileKey(image) : null,
  };
}

/** Each item's person-ness, birth date and image. */
export const PEOPLE: Lookup<PersonInfo | null, Entity> = {
  name: 'wikidata',
  endpoint: WIKIDATA_API,
  params: (ids) => ({ action: 'wbgetentities', props: 'claims', ids: ids.join('|') }),
  // Each item trimmed to its kept claims, without references or qualifiers.
  answers: (ids, replies) => {
    const result = new Map<string, Entity>();
    for (const reply of replies) {
      const entities = (reply as EntitiesReply).entities ?? {};
      for (const id of ids) {
        const entity = entities[id];
        if (entity === undefined) continue;
        if (entity.missing !== undefined) {
          result.set(id, { id, missing: entity.missing });
          continue;
        }
        const claims: Entity['claims'] = {};
        for (const property of KEPT_PROPERTIES) {
          const list = entity.claims?.[property];
          if (list !== undefined)
            claims[property] = list.map(({ rank, mainsnak }) => ({ rank, mainsnak }));
        }
        result.set(id, { id, claims });
      }
    }
    return result;
  },
  read: readPerson,
};
