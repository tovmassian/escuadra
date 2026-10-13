import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { WikimediaClient, WikimediaFetchError, apiUrl } from './wikimedia-fetch.ts';

const API = 'https://en.wikipedia.org/w/api.php';
const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function cacheDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'squadctl-wikimedia-'));
  dirs.push(dir);
  return dir;
}

interface Reply {
  status?: number;
  body?: unknown;
  retryAfter?: string;
}

/** A fake `fetch` answering each call with the next reply, recording URLs. */
function fakeFetch(replies: Reply[]) {
  const urls: string[] = [];
  const agents: string[] = [];
  const fetchImpl = async (url: string, init: { headers: Record<string, string> }) => {
    urls.push(url);
    agents.push(init.headers['User-Agent'] ?? '');
    const reply = replies.shift();
    if (reply === undefined) throw new Error(`unexpected request ${url}`);
    const status = reply.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: {
        get: (name: string) => (name === 'retry-after' ? (reply.retryAfter ?? null) : null),
      },
      json: async () => reply.body,
    };
  };
  return { fetchImpl, urls, agents };
}

function client(
  dir: string,
  fetchImpl: ReturnType<typeof fakeFetch>['fetchImpl'],
  offline = false,
) {
  const sleeps: number[] = [];
  const instance = new WikimediaClient({
    cacheDir: dir,
    offline,
    userAgent: 'test-agent/1.0',
    delayMs: 500,
    fetchImpl,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  });
  return { instance, sleeps };
}

describe('apiUrl', () => {
  it('orders parameters, so one request always has one URL and one cache key', () => {
    expect(apiUrl(API, { titles: 'A|B', action: 'query' })).toBe(
      apiUrl(API, { action: 'query', titles: 'A|B' }),
    );
    expect(apiUrl(API, { action: 'query' })).toBe(
      `${API}?action=query&format=json&formatversion=2`,
    );
  });
});

describe('WikimediaClient.query', () => {
  it('pauses before each request and names itself', async () => {
    const fake = fakeFetch([{ body: { query: {} } }]);
    const { instance, sleeps } = client(cacheDir(), fake.fetchImpl);
    await instance.query(API, { action: 'query' });
    expect(sleeps).toEqual([500]);
    expect(fake.agents).toEqual(['test-agent/1.0']);
    expect(instance.requests).toBe(1);
  });

  it('follows MediaWiki continue, returning every response in order', async () => {
    const fake = fakeFetch([
      { body: { continue: { picontinue: '7', continue: '||' }, query: { n: 1 } } },
      { body: { batchcomplete: true, query: { n: 2 } } },
    ]);
    const { instance } = client(cacheDir(), fake.fetchImpl);
    const bodies = await instance.query(API, { action: 'query', titles: 'A' });
    expect(bodies).toEqual([
      { continue: { picontinue: '7', continue: '||' }, query: { n: 1 } },
      { batchcomplete: true, query: { n: 2 } },
    ]);
    expect(fake.urls[1]).toContain('picontinue=7');
    expect(fake.urls[1]).toContain('titles=A');
  });

  it('backs off on 429, honouring Retry-After, then succeeds', async () => {
    const fake = fakeFetch([
      { status: 429, retryAfter: '3' },
      { status: 503 },
      { body: { query: {} } },
    ]);
    const { instance, sleeps } = client(cacheDir(), fake.fetchImpl);
    await instance.query(API, { action: 'query' });
    expect(sleeps).toEqual([500, 3000, 500, 4000, 500]);
  });

  it('gives up after its retries with a network error', async () => {
    const fake = fakeFetch(Array.from({ length: 5 }, () => ({ status: 429 })));
    const { instance } = client(cacheDir(), fake.fetchImpl);
    await expect(instance.query(API, { action: 'query' })).rejects.toThrow(WikimediaFetchError);
  });

  it('fails on any other HTTP error without retrying', async () => {
    const fake = fakeFetch([{ status: 404 }]);
    const { instance } = client(cacheDir(), fake.fetchImpl);
    await expect(instance.query(API, { action: 'query' })).rejects.toThrow(/HTTP 404/);
    expect(fake.urls).toHaveLength(1);
  });

  it('treats an API error body as a failure', async () => {
    const fake = fakeFetch([{ body: { error: { code: 'toomanyvalues', info: 'Too many' } } }]);
    const { instance } = client(cacheDir(), fake.fetchImpl);
    await expect(instance.query(API, { action: 'query' })).rejects.toThrow(/toomanyvalues/);
  });

  // The cache holds what was parsed, so an offline run parses the same thing.
  it('caches each response after its transform, and serves it offline with no request', async () => {
    const dir = cacheDir();
    const online = fakeFetch([{ body: { entities: { Q1: { big: 'x', keep: 1 } } } }]);
    const transform = (body: unknown) => ({
      kept: (body as { entities: { Q1: { keep: number } } }).entities.Q1.keep,
    });
    const first = await client(dir, online.fetchImpl).instance.query(
      API,
      { action: 'wbgetentities' },
      transform,
    );
    expect(first).toEqual([{ kept: 1 }]);
    const [file] = readdirSync(dir);
    expect(JSON.parse(readFileSync(path.join(dir, file ?? ''), 'utf8'))).toMatchObject({
      url: apiUrl(API, { action: 'wbgetentities' }),
      body: { kept: 1 },
    });

    const offline = fakeFetch([]);
    const { instance, sleeps } = client(dir, offline.fetchImpl, true);
    expect(await instance.query(API, { action: 'wbgetentities' }, transform)).toEqual([
      { kept: 1 },
    ]);
    expect(offline.urls).toEqual([]);
    expect(sleeps).toEqual([]);
    expect(instance.requests).toBe(0);
  });

  it('follows continue offline through the cache', async () => {
    const dir = cacheDir();
    const online = fakeFetch([
      { body: { continue: { iicontinue: 'x', continue: '||' }, query: { n: 1 } } },
      { body: { query: { n: 2 } } },
    ]);
    await client(dir, online.fetchImpl).instance.query(API, { action: 'query' });
    const { instance } = client(dir, fakeFetch([]).fetchImpl, true);
    expect(await instance.query(API, { action: 'query' })).toHaveLength(2);
  });

  it('fails offline, naming the fix, when nothing is cached', async () => {
    const { instance } = client(cacheDir(), fakeFetch([]).fetchImpl, true);
    await expect(instance.query(API, { action: 'query' })).rejects.toThrow(
      /nothing cached.*without --offline/,
    );
  });
});
