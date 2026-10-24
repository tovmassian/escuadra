import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Reset Escuadra (#197) stores a new random installId mid-run. About promises a
// session code that is new each time the app starts, so the signal after a
// reset must carry the new (hashed) identifier and the launch's same session
// code. This drives the real `lib/telemetry.ts` with its native imports faked
// and `fetch` stubbed: no network.

const state = vi.hoisted(() => ({
  installId: 'first-install-id' as string | null,
}));

vi.mock('@/stores/progress', () => ({
  useProgress: {
    getState: () => ({ telemetryEnabled: true, installId: state.installId }),
  },
}));
vi.mock('expo-constants', () => ({
  default: { expoConfig: { extra: { telemetryDeckAppId: 'APP' } } },
}));
vi.mock('expo-crypto', () => ({
  digest: (_algorithm: string, data: BufferSource) =>
    globalThis.crypto.subtle.digest('SHA-256', data),
}));
vi.mock('expo-updates', () => ({ channel: 'production' }));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

let bodies: Record<string, unknown>[] = [];

/** Lets the fire-and-forget signal (an async hash, then a POST) finish. */
async function settle(): Promise<void> {
  await vi.waitFor(() => expect(bodies.length).toBeGreaterThan(0));
}

beforeEach(() => {
  bodies = [];
  state.installId = 'first-install-id';
  vi.resetModules();
  vi.stubGlobal('__DEV__', false);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      bodies.push(...(JSON.parse(String(init.body)) as Record<string, unknown>[]));
      return new Response('{}');
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('telemetry across a reset of the install identifier', () => {
  it('sends the new hashed identifier after a reset, with the same session code', async () => {
    const { track } = await import('../telemetry');

    track('app.launched', { language: 'de', languageSource: 'phone' });
    await settle();
    const before = bodies[0];
    expect(before?.clientUser).toBe(sha256('first-install-id'));

    bodies = [];
    state.installId = 'second-install-id';
    track('app.launched', { language: 'de', languageSource: 'phone' });
    await settle();
    const after = bodies[0];

    expect(after?.clientUser).toBe(sha256('second-install-id'));
    expect(JSON.stringify(after)).not.toContain('second-install-id');
    expect(typeof after?.sessionID).toBe('string');
    expect(after?.sessionID).toBe(before?.sessionID);
  });
});
