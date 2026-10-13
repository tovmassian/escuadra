// squadctl's second networked file, beside wiki-fetch.ts: the MediaWiki API
// client `enrich` batches its Wikipedia, Wikidata and Commons lookups
// through. Every response is cached before anything parses it, so a rule
// change re-runs against it with `--offline` at zero network cost and a
// changed result is attributable to the rule, not to Wikimedia.
//
// Etiquette, as wiki-fetch.ts: a User-Agent naming the tool and the repo, a
// pause before every request, and backoff on 429. Wikimedia's APIs answered
// 429 to a cloud session's shared IP after fewer than ten requests, so run
// this on a developer machine.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DEFAULT_USER_AGENT } from './wiki-fetch.ts';

export const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';
export const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
export const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';

/** Commons snaps a requested width to its standard sizes: 512 comes back as
 *  960 px (463 KB for one photo), 500 exactly (119 KB) — enough for the
 *  220 pt hero at 2x. */
export const THUMB_WIDTH = 500;

/** The three batched lookups, at most 50 titles, ids or files each. */
export const REQUESTS = {
  /** Each article's free lead image and Wikidata item. */
  articles: (titles: readonly string[]): Record<string, string> => ({
    action: 'query',
    prop: 'pageimages|pageprops',
    piprop: 'name',
    pilicense: 'free',
    pilimit: '50',
    ppprop: 'wikibase_item|disambiguation',
    redirects: '1',
    titles: titles.join('|'),
  }),
  /** Each item's claims, trimmed to the few read before caching. */
  people: (ids: readonly string[]): Record<string, string> => ({
    action: 'wbgetentities',
    props: 'claims',
    ids: ids.join('|'),
  }),
  /** Each file's thumbnail, Commons page and credit metadata. */
  credits: (files: readonly string[]): Record<string, string> => ({
    action: 'query',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: String(THUMB_WIDTH),
    iiextmetadatafilter: 'LicenseShortName|Artist|LicenseUrl|AttributionRequired',
    titles: files.map((file) => `File:${file}`).join('|'),
  }),
};

export type WikimediaFailureCode = 'network' | 'not-cached';

export class WikimediaFetchError extends Error {
  // An explicit field, not a parameter property: Node's strip-only
  // TypeScript mode rejects parameter properties.
  readonly code: WikimediaFailureCode;

  constructor(message: string, code: WikimediaFailureCode) {
    super(message);
    this.name = 'WikimediaFetchError';
    this.code = code;
  }
}

interface ResponseLike {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
}

type FetchLike = (url: string, init: { headers: Record<string, string> }) => Promise<ResponseLike>;

export interface WikimediaClientOptions {
  /** Directory holding one `<sha1 of url>.json` per response. */
  cacheDir: string;
  /** Serve every response from the cache and make no requests at all. */
  offline: boolean;
  userAgent?: string;
  /** Pause before each request. The whole player base is ~190 requests. */
  delayMs?: number;
  /** Retries on 429 and 5xx before a batch is reported failed. */
  maxRetries?: number;
  fetchImpl?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
}

interface CachedResponse {
  url: string;
  fetchedAt: string;
  body: unknown;
}

/** One request, one URL: parameters sorted, so the same lookup always hits
 *  the same cache entry however its caller built the parameters. */
export function apiUrl(endpoint: string, params: Record<string, string>): string {
  const all: Record<string, string> = { format: 'json', formatversion: '2', ...params };
  const search = new URLSearchParams(
    Object.keys(all)
      .sort()
      .map((key) => [key, all[key] ?? '']),
  );
  return `${endpoint}?${search.toString()}`;
}

/** Where one response is cached: named by the hash of its URL. */
export function cacheFile(cacheDir: string, url: string): string {
  return path.join(cacheDir, `${createHash('sha1').update(url).digest('hex')}.json`);
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export class WikimediaClient {
  /** Requests actually sent this run; zero offline. */
  requests = 0;

  private readonly options: Required<Omit<WikimediaClientOptions, 'userAgent'>> & {
    userAgent: string;
  };

  constructor(options: WikimediaClientOptions) {
    this.options = {
      cacheDir: options.cacheDir,
      offline: options.offline,
      userAgent: options.userAgent ?? DEFAULT_USER_AGENT,
      delayMs: options.delayMs ?? 500,
      maxRetries: options.maxRetries ?? 4,
      fetchImpl: options.fetchImpl ?? ((url, init) => fetch(url, init)),
      sleep: options.sleep ?? defaultSleep,
    };
  }

  /** One API query, following MediaWiki's `continue` until the batch is
   *  complete. Returns every response body in order, each after
   *  `transform` — which is also what the cache stores. */
  async query(
    endpoint: string,
    params: Record<string, string>,
    transform: (body: unknown) => unknown = (body) => body,
  ): Promise<unknown[]> {
    const bodies: unknown[] = [];
    let continuation: Record<string, string> = {};
    for (;;) {
      const url = apiUrl(endpoint, { ...params, ...continuation });
      const body = this.options.offline
        ? this.readCache(url)
        : await this.fetchAndCache(url, transform);
      bodies.push(body);
      const next = (body as { continue?: Record<string, string> } | null)?.continue;
      if (next === undefined) return bodies;
      continuation = next;
    }
  }

  private cachePath(url: string): string {
    return cacheFile(this.options.cacheDir, url);
  }

  private readCache(url: string): unknown {
    try {
      return (JSON.parse(readFileSync(this.cachePath(url), 'utf8')) as CachedResponse).body;
    } catch {
      throw new WikimediaFetchError(
        `--offline: nothing cached for ${url} (run once without --offline first)`,
        'not-cached',
      );
    }
  }

  private async fetchAndCache(
    url: string,
    transform: (body: unknown) => unknown,
  ): Promise<unknown> {
    const body = transform(await this.fetchJson(url));
    mkdirSync(this.options.cacheDir, { recursive: true });
    const cached: CachedResponse = { url, fetchedAt: new Date().toISOString(), body };
    writeFileSync(this.cachePath(url), `${JSON.stringify(cached)}\n`);
    return body;
  }

  private async fetchJson(url: string): Promise<unknown> {
    const { fetchImpl, sleep, delayMs, maxRetries, userAgent } = this.options;
    for (let attempt = 0; ; attempt++) {
      await sleep(delayMs);
      this.requests++;
      let response: ResponseLike;
      try {
        response = await fetchImpl(url, { headers: { 'User-Agent': userAgent } });
      } catch (cause) {
        throw new WikimediaFetchError(`request failed: ${url} (${String(cause)})`, 'network');
      }
      const retryable = response.status === 429 || response.status >= 500;
      if (retryable && attempt < maxRetries) {
        const retryAfter = Number(response.headers.get('retry-after'));
        await sleep(retryAfter > 0 ? retryAfter * 1000 : 2000 * 2 ** attempt);
        continue;
      }
      if (!response.ok)
        throw new WikimediaFetchError(`HTTP ${response.status} for ${url}`, 'network');
      const body = await response.json();
      const error = (body as { error?: { code?: string; info?: string } } | null)?.error;
      if (error !== undefined) {
        throw new WikimediaFetchError(
          `API error ${error.code ?? '?'} for ${url}: ${error.info ?? ''}`,
          'network',
        );
      }
      return body;
    }
  }
}
