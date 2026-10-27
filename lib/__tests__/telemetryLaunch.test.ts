import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The cold start's session and launch signal go once per JavaScript start (#187).
// Android mounts the root layout again when Escuadra is reopened after Back, with
// JavaScript still running; in the 2.0 device pass that sent `Session.started`
// and `app.launched` again under the same session code. Such a reopening is a
// return from the background, judged by the 5-minute gap, from a listener that
// outlives the remount. This drives the real `lib/telemetry.ts` with its native
// imports faked and `fetch` stubbed: no network.

const state = vi.hoisted(() => ({
  queue: [] as Record<string, unknown>[],
  appStateListeners: [] as ((next: string) => void)[],
  uuids: 0,
}));

vi.mock('@/stores/progress', () => ({
  useProgress: {
    getState: () => ({
      telemetryEnabled: true,
      installId: 'install-id',
      telemetryQueue: state.queue,
      pushTelemetry: (signal: Record<string, unknown>) => {
        state.queue = [...state.queue, signal];
      },
      dropTelemetry: (sent: readonly Record<string, unknown>[]) => {
        state.queue = state.queue.filter((signal) => !sent.includes(signal));
      },
    }),
  },
}));
vi.mock('expo-constants', () => ({
  default: { expoConfig: { extra: { telemetryDeckAppId: 'APP' } } },
}));
vi.mock('expo-crypto', () => ({
  digest: (_algorithm: string, data: BufferSource) =>
    globalThis.crypto.subtle.digest('SHA-256', data),
  randomUUID: () => `session-${++state.uuids}`,
}));
vi.mock('expo-updates', () => ({ channel: 'production' }));
vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
  AppState: {
    currentState: 'active',
    addEventListener: (_type: string, listener: (next: string) => void) => {
      state.appStateListeners.push(listener);
      return { remove: () => {} };
    },
  },
}));

const SESSION = 'TelemetryDeck.Session.started';
const MINUTE = 60 * 1000;

let bodies: Record<string, unknown>[] = [];
let now = 0;

const sessions = () => bodies.filter((body) => body.type === SESSION);

/** Moves the app to `next` at `at`, as `AppState` reports it. */
function appState(next: string, at: number): void {
  now = at;
  for (const listener of state.appStateListeners) listener(next);
}

beforeEach(() => {
  bodies = [];
  now = 0;
  state.queue = [];
  state.appStateListeners = [];
  state.uuids = 0;
  vi.resetModules();
  vi.stubGlobal('__DEV__', false);
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      bodies.push(...(JSON.parse(String(init.body)) as Record<string, unknown>[]));
      return new Response('{}');
    }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('the launch, once per JavaScript start', () => {
  it('sends one session and one launch however often the root mounts', async () => {
    const { startLaunch } = await import('../telemetry');
    const launch = vi.fn();

    startLaunch(launch);
    startLaunch(launch);
    startLaunch(launch);
    await vi.waitFor(() => expect(sessions()).toHaveLength(1));

    expect(launch).toHaveBeenCalledTimes(1);
    expect(state.appStateListeners).toHaveLength(1);
  });

  it('starts a session with a new code on a return after 5 minutes, not before', async () => {
    const { startLaunch } = await import('../telemetry');
    startLaunch(() => {});
    await vi.waitFor(() => expect(sessions()).toHaveLength(1));
    const first = sessions()[0]?.sessionID;

    // Back on Home, then reopened within a minute: the same session.
    appState('background', 0);
    appState('active', MINUTE);
    startLaunch(() => {});

    // Away for 6 minutes: a new session, with a new code.
    appState('background', 2 * MINUTE);
    appState('active', 8 * MINUTE);
    startLaunch(() => {});
    await vi.waitFor(() => expect(sessions()).toHaveLength(2));

    const second = sessions()[1]?.sessionID;
    expect(second).toBe('session-1');
    expect(second).not.toBe(first);
  });
});
