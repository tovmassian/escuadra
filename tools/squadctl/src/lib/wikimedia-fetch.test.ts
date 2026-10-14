import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { FetchLike } from './http.ts';
import {
  BATCH_SIZE,
  WikimediaClient,
  answerFile,
  apiUrl,
  chunk,
  writeAnswer,
  type Lookup,
} from './wikimedia-fetch.ts';

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

/** A fake `fetch` answering each call with the next reply body (or HTTP
 *  status), recording URLs. */
function fakeFetch(replies: ({ status: number } | object)[]) {
  const urls: string[] = [];
  const fetchImpl: FetchLike = async (url) => {
    urls.push(url);
    const reply = replies.shift();
    if (reply === undefined) throw new Error(`unexpected request ${url}`);
    const status = 'status' in reply ? reply.status : 200;
    return {
      ok: status === 200,
      status,
      headers: { get: () => null },
      text: async () => JSON.stringify(reply),
    };
  };
  return { fetchImpl, urls };
}

function client(dir: string, fetchImpl: FetchLike, offline = false) {
  return new WikimediaClient({
    cacheDir: dir,
    offline,
    userAgent: 'test-agent/1.0',
    maxRetries: 0,
    fetchImpl,
    sleep: async () => {},
  });
}

/** A lookup over replies shaped `{ items: { <key>: answer } }`, reading
 *  each answer's `n`. */
const ITEMS: Lookup<number, { n: number }> = {
  name: 'items',
  endpoint: API,
  params: (keys) => ({ action: 'items', keys: keys.join('|') }),
  answers: (keys, replies) => {
    const result = new Map<string, { n: number }>();
    for (const reply of replies) {
      const items = (reply as { items?: Record<string, { n: number }> }).items ?? {};
      for (const key of keys) {
        const item = items[key];
        if (item !== undefined) result.set(key, item);
      }
    }
    return result;
  },
  read: (answer) => answer.n,
};

describe('chunk', () => {
  it('splits into MediaWiki-sized batches', () => {
    const titles = Array.from({ length: 120 }, (_, i) => `T${i}`);
    expect(chunk(titles, BATCH_SIZE).map((b) => b.length)).toEqual([50, 50, 20]);
  });

  it('returns no batches for no items', () => {
    expect(chunk([], BATCH_SIZE)).toEqual([]);
  });
});

describe('apiUrl', () => {
  it('orders parameters, so one query always has one URL', () => {
    expect(apiUrl(API, { titles: 'A|B', action: 'query' })).toBe(
      apiUrl(API, { action: 'query', titles: 'A|B' }),
    );
    expect(apiUrl(API, { action: 'query' })).toBe(
      `${API}?action=query&format=json&formatversion=2`,
    );
  });
});

describe('WikimediaClient.query', () => {
  it('follows MediaWiki continue, returning every reply in order', async () => {
    const fake = fakeFetch([
      { continue: { picontinue: '7', continue: '||' }, query: { n: 1 } },
      { batchcomplete: true, query: { n: 2 } },
    ]);
    const replies = await client(cacheDir(), fake.fetchImpl).query(API, {
      action: 'query',
      titles: 'A',
    });
    expect(replies).toEqual([
      { continue: { picontinue: '7', continue: '||' }, query: { n: 1 } },
      { batchcomplete: true, query: { n: 2 } },
    ]);
    expect(fake.urls[1]).toContain('picontinue=7');
    expect(fake.urls[1]).toContain('titles=A');
  });

  it('treats an API error body as a failure', async () => {
    const fake = fakeFetch([{ error: { code: 'toomanyvalues', info: 'Too many' } }]);
    await expect(
      client(cacheDir(), fake.fetchImpl).query(API, { action: 'query' }),
    ).rejects.toThrow(/toomanyvalues/);
  });
});

describe('WikimediaClient.lookUp', () => {
  it('asks in batches of 50 and reads each answer', async () => {
    const keys = Array.from({ length: 51 }, (_, i) => `k${i}`);
    const answers = (batch: string[]) => ({
      items: Object.fromEntries(batch.map((key, i) => [key, { n: i }])),
    });
    const fake = fakeFetch([answers(keys.slice(0, 50)), answers(keys.slice(50))]);
    const instance = client(cacheDir(), fake.fetchImpl);
    const result = await instance.lookUp(ITEMS, keys);
    expect(result.found.size).toBe(51);
    expect(result.found.get('k50')).toBe(0);
    expect(result.failed.size).toBe(0);
    expect(instance.requests).toBe(2);
  });

  // A batch is whichever keys a run selected; a key's answer is the same in
  // any batch, so `--only` or a retitle never misses what is cached.
  it('caches each key on its own, so any selection re-runs offline', async () => {
    const dir = cacheDir();
    const online = fakeFetch([{ items: { a: { n: 1 }, b: { n: 2 }, c: { n: 3 } } }]);
    await client(dir, online.fetchImpl).lookUp(ITEMS, ['a', 'b', 'c']);
    expect(JSON.parse(readFileSync(answerFile(dir, ITEMS, 'b'), 'utf8'))).toMatchObject({
      key: 'b',
      answer: { n: 2 },
    });

    const offline = fakeFetch([]);
    const instance = client(dir, offline.fetchImpl, true);
    const result = await instance.lookUp(ITEMS, ['c', 'a']);
    expect([...result.found]).toEqual([
      ['c', 3],
      ['a', 1],
    ]);
    expect(offline.urls).toEqual([]);
    expect(instance.requests).toBe(0);
  });

  it('asks again online, refreshing what is cached', async () => {
    const dir = cacheDir();
    writeAnswer(dir, ITEMS, 'a', { n: 1 });
    const fake = fakeFetch([{ items: { a: { n: 9 } } }]);
    expect((await client(dir, fake.fetchImpl).lookUp(ITEMS, ['a'])).found.get('a')).toBe(9);
    expect(JSON.parse(readFileSync(answerFile(dir, ITEMS, 'a'), 'utf8')).answer).toEqual({
      n: 9,
    });
  });

  // A changed query must not be served what the old one was answered.
  it('keeps answers to a differently shaped query apart', () => {
    const wider = {
      ...ITEMS,
      params: (keys: readonly string[]) => ({ ...ITEMS.params(keys), w: '2' }),
    };
    expect(answerFile('/c', wider, 'a')).not.toBe(answerFile('/c', ITEMS, 'a'));
    expect(path.dirname(answerFile('/c', ITEMS, 'a'))).toBe(
      path.dirname(answerFile('/c', ITEMS, 'b')),
    );
  });

  it('fails a key the replies do not answer, and caches nothing for it', async () => {
    const dir = cacheDir();
    const fake = fakeFetch([{ items: { a: { n: 1 } } }]);
    const result = await client(dir, fake.fetchImpl).lookUp(ITEMS, ['a', 'ghost']);
    expect([...result.failed]).toEqual(['ghost']);
    expect(result.failures).toEqual(['items batch 1/1: no answer for ghost']);
    expect(existsSync(answerFile(dir, ITEMS, 'ghost'))).toBe(false);
  });

  it('fails every key of a batch whose request fails, and goes on', async () => {
    const keys = Array.from({ length: 51 }, (_, i) => `k${i}`);
    const fake = fakeFetch([{ status: 404 }, { items: { k50: { n: 5 } } }]);
    const result = await client(cacheDir(), fake.fetchImpl).lookUp(ITEMS, keys);
    expect(result.failed.size).toBe(50);
    expect(result.found.get('k50')).toBe(5);
    expect(result.failures).toEqual([expect.stringMatching(/^items batch 1\/2: HTTP 404/)]);
  });

  it('fails offline what is not cached, naming the fix', async () => {
    const dir = cacheDir();
    writeAnswer(dir, ITEMS, 'a', { n: 1 });
    const result = await client(dir, fakeFetch([]).fetchImpl, true).lookUp(ITEMS, ['a', 'b']);
    expect(result.found.get('a')).toBe(1);
    expect([...result.failed]).toEqual(['b']);
    expect(result.failures).toEqual([
      'items: nothing cached for b (run once without --offline first)',
    ]);
  });
});
