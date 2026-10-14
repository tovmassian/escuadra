// How squadctl talks to Wikimedia: `fetch`'s wikitext (wiki-fetch.ts) and
// `enrich`'s batched lookups (wikimedia-fetch.ts) both send every request
// through `WikimediaHttp`, so an etiquette or resilience fix reaches both.
//
// Etiquette: a User-Agent naming the tool and the repo, and a pause before
// every request. Resilience: a timeout on each request, and backoff on
// whatever a later attempt can cure — 429, 5xx, a dropped connection, a
// stalled socket — before the failure is reported.
const FALLBACK_USER_AGENT = 'escuadra-squadctl/1.0 (https://github.com/tovmassian/escuadra)';

/** Wikimedia policy allows refusing a generic or absent User-Agent, so this
 *  names the tool and carries a contact. The contact is the public repo, not
 *  a personal address; override with SQUADCTL_USER_AGENT to be reachable
 *  directly. */
export const DEFAULT_USER_AGENT =
  process.env.SQUADCTL_USER_AGENT !== undefined && process.env.SQUADCTL_USER_AGENT !== ''
    ? process.env.SQUADCTL_USER_AGENT
    : FALLBACK_USER_AGENT;

export type FetchFailureCode = 'network' | 'no-section' | 'not-cached';

export class WikiFetchError extends Error {
  // An explicit field, not a constructor parameter property: Node's
  // strip-only TypeScript mode rejects parameter properties outright, and
  // this project runs .ts through node directly with no compile step.
  readonly code: FetchFailureCode;

  constructor(message: string, code: FetchFailureCode) {
    super(message);
    this.name = 'WikiFetchError';
    this.code = code;
  }
}

export interface ResponseLike {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}

export type FetchLike = (
  url: string,
  init: { headers: Record<string, string>; signal: AbortSignal },
) => Promise<ResponseLike>;

export interface HttpOptions {
  userAgent?: string;
  /** Pause before each request, retries included. */
  delayMs?: number;
  /** Further attempts after the first, before the failure is reported. */
  maxRetries?: number;
  /** How long one attempt may take, headers and body together. */
  timeoutMs?: number;
  fetchImpl?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export class WikimediaHttp {
  /** Requests actually sent, retries included. */
  requests = 0;

  private readonly options: Required<HttpOptions>;

  constructor(options: HttpOptions = {}) {
    this.options = {
      userAgent: options.userAgent ?? DEFAULT_USER_AGENT,
      delayMs: options.delayMs ?? 500,
      maxRetries: options.maxRetries ?? 4,
      timeoutMs: options.timeoutMs ?? 30_000,
      fetchImpl: options.fetchImpl ?? ((url, init) => fetch(url, init)),
      sleep: options.sleep ?? defaultSleep,
    };
  }

  /** The body of a successful GET. Waits out a server's `Retry-After`, else
   *  backs off exponentially; any other HTTP error fails at once, since
   *  asking again would get the same answer. */
  async getText(url: string): Promise<string> {
    const { fetchImpl, sleep, delayMs, maxRetries, timeoutMs, userAgent } = this.options;
    for (let attempt = 0; ; attempt++) {
      await sleep(delayMs);
      this.requests++;
      const retriesLeft = attempt < maxRetries;
      const backoff = 2000 * 2 ** attempt;
      let response: ResponseLike;
      let body: string;
      try {
        response = await fetchImpl(url, {
          headers: { 'User-Agent': userAgent },
          signal: AbortSignal.timeout(timeoutMs),
        });
        body = response.ok ? await response.text() : '';
      } catch (cause) {
        if (retriesLeft) {
          await sleep(backoff);
          continue;
        }
        throw new WikiFetchError(`request failed: ${url} (${String(cause)})`, 'network');
      }
      if ((response.status === 429 || response.status >= 500) && retriesLeft) {
        const retryAfter = Number(response.headers.get('retry-after'));
        await sleep(retryAfter > 0 ? retryAfter * 1000 : backoff);
        continue;
      }
      if (!response.ok) throw new WikiFetchError(`HTTP ${response.status} for ${url}`, 'network');
      return body;
    }
  }
}
