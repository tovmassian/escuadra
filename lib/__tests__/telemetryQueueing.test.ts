import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// How usage statistics leave the device (#221): queued with the time each was made,
// kept while there is no connection, never sent once usage statistics are off or the
// identifier was reset, and each carrying the app's context. This drives the real
// `lib/telemetry.ts` and the real progress store, with native modules faked and
// `fetch` stubbed: no network.

const disk = vi.hoisted(() => new Map<string, string>());
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => disk.get(key) ?? null,
    setItem: async (key: string, value: string) => void disk.set(key, value),
    removeItem: async (key: string) => void disk.delete(key),
  },
}));
// The store reads the squads only to migrate old scores. Faked, so each test's fresh
// import doesn't load every squad, which is slow enough to time out under load.
vi.mock('@/lib/squads', () => ({ listSquads: () => [] }));
vi.mock('expo-constants', () => ({
  default: {
    expoConfig: { version: '2.0.0', extra: { telemetryDeckAppId: 'APP' } },
    platform: { ios: { buildNumber: '41' } },
  },
}));
const uuids = vi.hoisted(() => ({ n: 0 }));
vi.mock('expo-crypto', () => ({
  digest: (_algorithm: string, data: BufferSource) =>
    globalThis.crypto.subtle.digest('SHA-256', data),
  randomUUID: () => `session-${++uuids.n}`,
}));
vi.mock('expo-updates', () => ({ channel: 'production', isEnabled: false }));
vi.mock('react-native', () => ({ Platform: { OS: 'ios', Version: '18.1' } }));

const { FLUSH_BATCH, FLUSH_TIMEOUT_MS } = await import('../telemetryQueue');

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

type Body = Record<string, unknown>;

/** What the stub does with the next request: no connection, or this status. */
let respond: 'offline' | number = 200;
/** Every batch that reached the server, whatever it answered. */
let posts: Body[][] = [];
let requests = 0;

/** Lets the async hash, the push and the flush that follow a signal settle. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

async function load() {
  const { useProgress } = await import('@/stores/progress');
  const telemetry = await import('../telemetry');
  useProgress.setState({ installId: 'install-1', telemetryEnabled: true, telemetryQueue: [] });
  return { useProgress, ...telemetry };
}

beforeEach(() => {
  disk.clear();
  respond = 200;
  posts = [];
  requests = 0;
  vi.resetModules();
  vi.stubGlobal('__DEV__', false);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      requests += 1;
      if (respond === 'offline') throw new TypeError('Network request failed');
      posts.push(JSON.parse(String(init.body)) as Body[]);
      return new Response('{}', { status: respond });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the offline queue', () => {
  it('keeps a signal made offline, and sends it with the next one', async () => {
    const { track, useProgress } = await load();
    respond = 'offline';
    track('intro.skipped');
    await vi.waitFor(() => expect(requests).toBe(1));
    await tick();
    expect(useProgress.getState().telemetryQueue).toHaveLength(1);

    respond = 200;
    track('intro.skipped');
    await vi.waitFor(() => expect(posts).toHaveLength(1));
    await tick();
    expect(posts[0]).toHaveLength(2);
    expect(useProgress.getState().telemetryQueue).toEqual([]);
  });

  it('sends each queued signal with the time it was made', async () => {
    const { track } = await load();
    track('intro.skipped');
    await vi.waitFor(() => expect(posts).toHaveLength(1));
    expect(Number.isNaN(Date.parse(String(posts[0]?.[0]?.receivedAt)))).toBe(false);
  });

  it('drops a batch the server refuses, and keeps one it could not take', async () => {
    const { track, useProgress } = await load();
    respond = 400;
    track('intro.skipped');
    await vi.waitFor(() => expect(requests).toBe(1));
    await tick();
    expect(useProgress.getState().telemetryQueue).toEqual([]);

    respond = 503;
    track('intro.skipped');
    await vi.waitFor(() => expect(requests).toBe(2));
    await tick();
    expect(useProgress.getState().telemetryQueue).toHaveLength(1);
  });

  it('empties when usage statistics are switched off, and queues nothing while they are off', async () => {
    const { track, useProgress } = await load();
    respond = 'offline';
    track('intro.skipped');
    await vi.waitFor(() => expect(requests).toBe(1));
    await tick();
    useProgress.getState().setTelemetryEnabled(false);
    expect(useProgress.getState().telemetryQueue).toEqual([]);

    track('intro.skipped');
    await tick();
    expect(requests).toBe(1);
    expect(useProgress.getState().telemetryQueue).toEqual([]);
  });

  it('never sends a signal queued before Reset Escuadra', async () => {
    const { track, useProgress } = await load();
    respond = 'offline';
    track('intro.skipped');
    await vi.waitFor(() => expect(requests).toBe(1));
    await tick();
    useProgress.getState().factoryReset('install-2');

    respond = 200;
    track('intro.skipped');
    await vi.waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toHaveLength(1);
    expect(posts[0]?.[0]?.clientUser).toBe(sha256('install-2'));
  });

  it('never queues a signal still being built when the identifier is reset', async () => {
    const { track, useProgress } = await load();
    track('intro.skipped');
    useProgress.getState().factoryReset('install-2');
    await tick();
    await tick();
    expect(posts).toEqual([]);
    expect(useProgress.getState().telemetryQueue).toEqual([]);
  });
});

describe('a flush in flight', () => {
  /** A fetch whose first request waits for `release`; later ones answer 200 at once. */
  function holdFirstRequest() {
    const bodies: Body[][] = [];
    let release: (response: Response) => void = () => {};
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init: RequestInit) => {
        bodies.push(JSON.parse(String(init.body)) as Body[]);
        if (bodies.length > 1) return Promise.resolve(new Response('{}'));
        return new Promise<Response>((resolve) => {
          release = resolve;
        });
      }),
    );
    return { bodies, release: (response: Response) => release(response) };
  }
  const types = (batch: Body[] | undefined) => batch?.map((body) => body.type);

  it('sends a signal queued meanwhile once, in the next request', async () => {
    const { track, useProgress } = await load();
    const held = holdFirstRequest();
    track('intro.skipped');
    await vi.waitFor(() => expect(held.bodies).toHaveLength(1));
    track('picker.noResults', { kind: 'club' });
    await vi.waitFor(() => expect(useProgress.getState().telemetryQueue).toHaveLength(2));

    held.release(new Response('{}'));
    await vi.waitFor(() => expect(held.bodies).toHaveLength(2));
    await tick();
    expect(types(held.bodies[0])).toEqual(['intro.skipped']);
    expect(types(held.bodies[1])).toEqual(['picker.noResults']);
    expect(useProgress.getState().telemetryQueue).toEqual([]);
  });

  it('sends both again when the open request could not deliver', async () => {
    const { track, useProgress } = await load();
    const held = holdFirstRequest();
    track('intro.skipped');
    await vi.waitFor(() => expect(held.bodies).toHaveLength(1));
    track('picker.noResults', { kind: 'club' });
    await vi.waitFor(() => expect(useProgress.getState().telemetryQueue).toHaveLength(2));

    held.release(new Response('{}', { status: 503 }));
    await vi.waitFor(() => expect(held.bodies).toHaveLength(2));
    await tick();
    expect(types(held.bodies[1])).toEqual(['intro.skipped', 'picker.noResults']);
    expect(useProgress.getState().telemetryQueue).toEqual([]);
  });

  it('gives up on a request that never answers, keeps its batch, and flushes again later', async () => {
    const { track, useProgress } = await load();
    holdFirstRequest();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      track('intro.skipped');
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
      await vi.advanceTimersByTimeAsync(FLUSH_TIMEOUT_MS);
      expect(useProgress.getState().telemetryQueue).toHaveLength(1);

      track('picker.noResults', { kind: 'club' });
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
      await vi.waitFor(() => expect(useProgress.getState().telemetryQueue).toEqual([]));
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('a long queue', () => {
  it('goes out in batches, so one refusal never costs it all', async () => {
    const { track, useProgress } = await load();
    const made = new Date().toISOString();
    useProgress.setState({
      telemetryQueue: Array.from({ length: FLUSH_BATCH + 50 }, (_, n) => ({
        type: 'intro.skipped',
        n,
        receivedAt: made,
      })),
    });
    track('intro.skipped');
    await vi.waitFor(() => expect(posts).toHaveLength(2));
    await tick();
    expect(posts.map((batch) => batch.length)).toEqual([FLUSH_BATCH, 51]);
    expect(useProgress.getState().telemetryQueue).toEqual([]);
  });
});

describe('trackNow', () => {
  it('sends at once, without the queue', async () => {
    const { trackNow, useProgress } = await load();
    trackNow('progress.reset', { scope: 'all' });
    await vi.waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]?.[0]?.type).toBe('progress.reset');
    expect(posts[0]?.[0]).not.toHaveProperty('receivedAt');
    expect(useProgress.getState().telemetryQueue).toEqual([]);
  });
});

describe('sessions', () => {
  it('starts a new session code on a return from the background, and only then', async () => {
    const { startSession, track } = await load();
    track('intro.skipped');
    await vi.waitFor(() => expect(posts).toHaveLength(1));
    const first = posts[0]?.[0]?.sessionID;

    startSession(true);
    await vi.waitFor(() => expect(posts).toHaveLength(2));
    const renewed = posts[1]?.[0];
    expect(renewed?.type).toBe('TelemetryDeck.Session.started');
    expect(renewed?.sessionID).not.toBe(first);

    startSession(false);
    await vi.waitFor(() => expect(posts).toHaveLength(3));
    expect(posts[2]?.[0]?.type).toBe('TelemetryDeck.Session.started');
    expect(posts[2]?.[0]?.sessionID).toBe(renewed?.sessionID);
  });
});

describe('the context', () => {
  it('names the app, the platform, the system and the language on every signal', async () => {
    const { setTelemetryLanguage, track } = await load();
    setTelemetryLanguage('fr');
    track('picker.noResults', { kind: 'club' });
    await vi.waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]?.[0]?.payload).toEqual({
      'TelemetryDeck.AppInfo.version': '2.0.0',
      'TelemetryDeck.AppInfo.buildNumber': '41',
      'TelemetryDeck.Device.platform': 'iOS',
      'TelemetryDeck.Device.systemMajorVersion': '18',
      language: 'fr',
      kind: 'club',
    });
  });
});
