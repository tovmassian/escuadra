// squadctl's second networked file, beside wiki-fetch.ts: the client `enrich`
// sends its batched Wikipedia, Wikidata and Commons lookups through. Each
// lookup — wikimedia-parse.ts and photo-credit.ts define them, every query
// beside the reader that depends on it — says what to ask for and where each
// key's answer sits in the replies. This file sends the batches and caches
// the answers: transport and cache only, and no rule reads a reply here.
//
// Cached per key, not per batch. A batch is whichever 50 keys a run happened
// to select, so `--only esp` or one `retitle` moves every batch boundary;
// a key's answer is the same whichever batch carried it. Each answer is
// cached before any rule reads it, so a rule change re-runs with `--offline`
// at zero network cost and a changed result is attributable to the rule,
// not to Wikimedia. An online run always asks again — that is how a new photo
// or a changed licence arrives — and refreshes what it asked.
//
// Requests go through lib/http.ts. Wikimedia's APIs answered 429 to a cloud
// session's shared IP after fewer than ten requests, so run this on a
// developer machine.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { WikiFetchError, WikimediaHttp, type HttpOptions } from './http.ts';

/** MediaWiki's per-request title and id limit for clients without the
 *  apihighlimits right. */
export const BATCH_SIZE = 50;

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size));
  return batches;
}

/** One batched lookup: how to ask for a batch of keys, where each key's
 *  answer sits in the replies, and what an answer says. */
export interface Lookup<Info, Answer = unknown> {
  /** Names the stage in reports, and its cache folder. */
  name: string;
  endpoint: string;
  /** The query for one batch of at most `BATCH_SIZE` keys. */
  params(keys: readonly string[]): Record<string, string>;
  /** Each key's answer across a batch's replies — more than one when the
   *  query was `continue`d: the page or entity that answers it, in
   *  Wikimedia's own shape, trimmed to what `read` uses. A key no reply
   *  answers is absent, never guessed. */
  answers(keys: readonly string[], replies: readonly unknown[]): Map<string, Answer>;
  /** What one answer says: where the rules begin. */
  read(answer: Answer): Info;
}

export interface LookupResult<Info> {
  found: Map<string, Info>;
  /** Every key asked for and not found: its batch failed after its retries,
   *  the replies did not answer it, or `--offline` had nothing cached. */
  failed: Set<string>;
  /** One line per failed batch, or per group of unanswered keys. */
  failures: string[];
}

/** One request, one URL: parameters sorted, so the same query always has
 *  the same URL however its caller built the parameters. */
export function apiUrl(endpoint: string, params: Record<string, string>): string {
  const all: Record<string, string> = { format: 'json', formatversion: '2', ...params };
  const search = new URLSearchParams(
    Object.keys(all)
      .sort()
      .map((key) => [key, all[key] ?? '']),
  );
  return `${endpoint}?${search.toString()}`;
}

const sha1 = (text: string): string => createHash('sha1').update(text).digest('hex');

/** Where one key's answer is cached: under the lookup's name and its query's
 *  shape — the query with no keys — so a changed query (another thumbnail
 *  width, another field) never serves an answer the old query got. */
export function answerFile(cacheDir: string, lookup: Lookup<unknown>, key: string): string {
  const shape = sha1(apiUrl(lookup.endpoint, lookup.params([]))).slice(0, 12);
  return path.join(cacheDir, lookup.name, shape, `${sha1(key)}.json`);
}

interface CachedAnswer {
  key: string;
  fetchedAt: string;
  answer: unknown;
}

export function writeAnswer(
  cacheDir: string,
  lookup: Lookup<unknown>,
  key: string,
  answer: unknown,
  fetchedAt = new Date().toISOString(),
): void {
  const file = answerFile(cacheDir, lookup, key);
  mkdirSync(path.dirname(file), { recursive: true });
  const cached: CachedAnswer = { key, fetchedAt, answer };
  writeFileSync(file, `${JSON.stringify(cached)}\n`);
}

function readAnswer(cacheDir: string, lookup: Lookup<unknown>, key: string): unknown {
  try {
    return (JSON.parse(readFileSync(answerFile(cacheDir, lookup, key), 'utf8')) as CachedAnswer)
      .answer;
  } catch {
    return undefined;
  }
}

/** A few keys for a report line, and how many more there are. */
function sample(keys: readonly string[]): string {
  const shown = keys.slice(0, 5).join(', ');
  return keys.length > 5 ? `${shown} and ${keys.length - 5} more` : shown;
}

export interface WikimediaClientOptions extends HttpOptions {
  /** Directory holding each lookup's cached answers, one file per key. */
  cacheDir: string;
  /** Serve every answer from the cache and make no requests at all. */
  offline: boolean;
}

export class WikimediaClient {
  private readonly http: WikimediaHttp;
  private readonly cacheDir: string;
  private readonly offline: boolean;

  constructor({ cacheDir, offline, ...http }: WikimediaClientOptions) {
    this.cacheDir = cacheDir;
    this.offline = offline;
    this.http = new WikimediaHttp(http);
  }

  /** Requests actually sent this run; zero offline. */
  get requests(): number {
    return this.http.requests;
  }

  /** Every key's answer, read: from the cache offline, else asked for in
   *  batches of `BATCH_SIZE` and cached. Each key ends up found or failed. */
  async lookUp<Info, Answer>(
    lookup: Lookup<Info, Answer>,
    keys: readonly string[],
  ): Promise<LookupResult<Info>> {
    const result: LookupResult<Info> = { found: new Map(), failed: new Set(), failures: [] };
    const fail = (unanswered: readonly string[], why: string) => {
      for (const key of unanswered) result.failed.add(key);
      result.failures.push(why);
    };

    if (this.offline) {
      const missing: string[] = [];
      for (const key of keys) {
        const answer = readAnswer(this.cacheDir, lookup, key);
        if (answer === undefined) missing.push(key);
        else result.found.set(key, lookup.read(answer as Answer));
      }
      if (missing.length > 0) {
        fail(
          missing,
          `${lookup.name}: nothing cached for ${sample(missing)} (run once without --offline first)`,
        );
      }
      return result;
    }

    const batches = chunk(keys, BATCH_SIZE);
    for (const [index, batch] of batches.entries()) {
      const at = `${lookup.name} batch ${index + 1}/${batches.length}`;
      let answers: Map<string, Answer>;
      try {
        answers = lookup.answers(batch, await this.query(lookup.endpoint, lookup.params(batch)));
      } catch (error) {
        fail(batch, `${at}: ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }
      const unanswered: string[] = [];
      for (const key of batch) {
        const answer = answers.get(key);
        if (answer === undefined) {
          unanswered.push(key);
          continue;
        }
        writeAnswer(this.cacheDir, lookup, key, answer);
        result.found.set(key, lookup.read(answer));
      }
      if (unanswered.length > 0) fail(unanswered, `${at}: no answer for ${sample(unanswered)}`);
    }
    return result;
  }

  /** One API query, following MediaWiki's `continue` until the batch is
   *  complete. Returns every reply in order, untouched. */
  async query(endpoint: string, params: Record<string, string>): Promise<unknown[]> {
    const replies: unknown[] = [];
    let continuation: Record<string, string> = {};
    for (;;) {
      const url = apiUrl(endpoint, { ...params, ...continuation });
      const text = await this.http.getText(url);
      let reply: unknown;
      try {
        reply = JSON.parse(text);
      } catch {
        throw new WikiFetchError(`reply for ${url} was not JSON`, 'network');
      }
      const error = (reply as { error?: { code?: string; info?: string } } | null)?.error;
      if (error !== undefined) {
        throw new WikiFetchError(
          `API error ${error.code ?? '?'} for ${url}: ${error.info ?? ''}`,
          'network',
        );
      }
      replies.push(reply);
      const next = (reply as { continue?: Record<string, string> } | null)?.continue;
      if (next === undefined) return replies;
      continuation = next;
    }
  }
}
