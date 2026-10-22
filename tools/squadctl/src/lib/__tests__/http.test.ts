import { describe, expect, it } from 'vitest';
import { DEFAULT_USER_AGENT, WikiFetchError, WikimediaHttp, type FetchLike } from '../http.ts';

type Reply = { status?: number; body?: string; retryAfter?: string } | Error;

/** A fake `fetch` answering each call with the next reply — a thrown error
 *  when the reply is one — recording what each request carried. */
function fakeFetch(replies: Reply[]) {
  const urls: string[] = [];
  const agents: string[] = [];
  const signals: AbortSignal[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    urls.push(url);
    agents.push(init.headers['User-Agent'] ?? '');
    signals.push(init.signal);
    const reply = replies.shift();
    if (reply === undefined) throw new Error(`unexpected request ${url}`);
    if (reply instanceof Error) throw reply;
    const status = reply.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: {
        get: (name: string) => (name === 'retry-after' ? (reply.retryAfter ?? null) : null),
      },
      text: async () => reply.body ?? '',
    };
  };
  return { fetchImpl, urls, agents, signals };
}

function http(fetchImpl: FetchLike) {
  const sleeps: number[] = [];
  const instance = new WikimediaHttp({
    userAgent: 'test-agent/1.0',
    delayMs: 500,
    fetchImpl,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  });
  return { instance, sleeps };
}

const URL = 'https://en.wikipedia.org/w/api.php?action=query';

describe('user agent', () => {
  // Wikimedia policy allows refusing a generic or absent agent, so this must
  // name the tool and carry a contact.
  it('names the tool and a contact that is not a personal address', () => {
    expect(DEFAULT_USER_AGENT).toContain('squadctl');
    expect(DEFAULT_USER_AGENT).toMatch(/https?:\/\//);
    expect(DEFAULT_USER_AGENT).not.toContain('@');
  });
});

describe('WikimediaHttp.getText', () => {
  it('pauses before each request, names itself and bounds the wait', async () => {
    const fake = fakeFetch([{ body: 'ok' }]);
    const { instance, sleeps } = http(fake.fetchImpl);
    expect(await instance.getText(URL)).toBe('ok');
    expect(sleeps).toEqual([500]);
    expect(fake.agents).toEqual(['test-agent/1.0']);
    expect(fake.signals[0]).toBeInstanceOf(AbortSignal);
    expect(instance.requests).toBe(1);
  });

  it('backs off on 429, honouring Retry-After, and on 5xx, then succeeds', async () => {
    const fake = fakeFetch([{ status: 429, retryAfter: '3' }, { status: 503 }, { body: 'ok' }]);
    const { instance, sleeps } = http(fake.fetchImpl);
    expect(await instance.getText(URL)).toBe('ok');
    expect(sleeps).toEqual([500, 3000, 500, 4000, 500]);
  });

  // One dropped connection must not fail a whole batch of 50.
  it('backs off on a thrown network error or timeout, then succeeds', async () => {
    const fake = fakeFetch([
      new TypeError('fetch failed: ECONNRESET'),
      new DOMException('The operation timed out.', 'TimeoutError'),
      { body: 'ok' },
    ]);
    const { instance, sleeps } = http(fake.fetchImpl);
    expect(await instance.getText(URL)).toBe('ok');
    expect(sleeps).toEqual([500, 2000, 500, 4000, 500]);
  });

  it('gives up after its retries with a network error', async () => {
    const statuses = fakeFetch(Array.from({ length: 5 }, () => ({ status: 429 })));
    await expect(http(statuses.fetchImpl).instance.getText(URL)).rejects.toThrow(/HTTP 429/);
    const thrown = fakeFetch(Array.from({ length: 5 }, () => new TypeError('fetch failed')));
    const failure = http(thrown.fetchImpl).instance.getText(URL);
    await expect(failure).rejects.toThrow(WikiFetchError);
    await expect(failure).rejects.toMatchObject({ code: 'network' });
    expect(thrown.urls).toHaveLength(5);
  });

  it('fails on any other HTTP error without retrying', async () => {
    const fake = fakeFetch([{ status: 404 }]);
    await expect(http(fake.fetchImpl).instance.getText(URL)).rejects.toThrow(/HTTP 404/);
    expect(fake.urls).toHaveLength(1);
  });
});
