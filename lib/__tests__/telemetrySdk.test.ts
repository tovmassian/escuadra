import { createHash } from 'node:crypto';
import TelemetryDeck from '@telemetrydeck/sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';

// About states what a usage statistic carries: a hashed form of a random
// identifier, a random session code that is new each time the app starts, and
// the statistic itself; the request also names the app and the SDK version.
// Nothing else. That is a statement about the SDK, not
// only about our code, so this test builds the same client `lib/telemetry.ts`
// does and pins the request it sends. A failure after an upgrade of
// `@telemetrydeck/sdk` means the SDK now sends something About does not say:
// that is a disclosure review (CLAUDE.md, guardrail 4), not a test to update.
//
// It imports the SDK directly: `lib/telemetry.ts` pulls in React Native, which
// Vitest's node environment cannot load.

const INSTALL_ID = '7f3c1d2e-5b6a-4c8d-9e0f-1a2b3c4d5e6f';
const PAYLOAD = { language: 'de', languageSource: 'phone' };

interface Sent {
  url: string;
  init: RequestInit;
  /** The parsed request body: the SDK posts an array of signals. */
  signals: Record<string, unknown>[];
}

/** Sends one signal through a client built like the app's, and returns what fetch received. */
async function sendOne(options: { testMode?: boolean } = {}): Promise<Sent> {
  const fetchStub = vi.fn(async (_url: string, _init: RequestInit) => new Response('{}'));
  vi.stubGlobal('fetch', fetchStub);
  const client = new TelemetryDeck({
    appID: 'APP',
    clientUser: INSTALL_ID,
    subtleCrypto: globalThis.crypto.subtle as unknown as Function,
    ...options,
  });
  await client.signal('app.launched', PAYLOAD);
  expect(fetchStub).toHaveBeenCalledTimes(1);
  const [url, init] = fetchStub.mock.calls[0] ?? [];
  return {
    url: url ?? '',
    init: init ?? {},
    signals: JSON.parse(String(init?.body)) as Record<string, unknown>[],
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('what the TelemetryDeck SDK sends', () => {
  it('posts one signal to TelemetryDeck, with a JSON body and nothing else in the request', async () => {
    const { url, init, signals } = await sendOne();
    expect(url).toBe('https://nom.telemetrydeck.com/v2/');
    expect(Object.keys(init).sort()).toEqual(['body', 'headers', 'method', 'mode']);
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(signals).toHaveLength(1);
  });

  it('carries the identifier, a session code, the app, the event, the SDK version and the payload', async () => {
    const [signal] = (await sendOne()).signals;
    expect(Object.keys(signal ?? {}).sort()).toEqual([
      'appID',
      'clientUser',
      'payload',
      'sessionID',
      'telemetryClientVersion',
      'type',
    ]);
    expect(signal?.appID).toBe('APP');
    expect(signal?.type).toBe('app.launched');
    expect(signal?.telemetryClientVersion).toMatch(/^JavaScriptSDK \d+\.\d+\.\d+$/);
  });

  it('adds only the test flag on a test-mode client', async () => {
    const [signal] = (await sendOne({ testMode: true })).signals;
    expect(Object.keys(signal ?? {}).sort()).toEqual([
      'appID',
      'clientUser',
      'isTestMode',
      'payload',
      'sessionID',
      'telemetryClientVersion',
      'type',
    ]);
    expect(signal?.isTestMode).toBe(true);
  });

  it('sends the identifier hashed, never as it is stored', async () => {
    const [signal] = (await sendOne()).signals;
    expect(signal?.clientUser).toMatch(/^[0-9a-f]{64}$/);
    expect(signal?.clientUser).toBe(createHash('sha256').update(INSTALL_ID).digest('hex'));
    expect(signal?.clientUser).not.toBe(INSTALL_ID);
    expect(JSON.stringify(signal)).not.toContain(INSTALL_ID);
  });

  it('gives each client its own session code, apart from the identifier', async () => {
    const first = (await sendOne()).signals[0]?.sessionID;
    const second = (await sendOne()).signals[0]?.sessionID;
    expect(typeof first).toBe('string');
    expect(typeof second).toBe('string');
    expect(first).not.toBe('');
    expect(first).not.toBe(second);
    expect(first).not.toBe(INSTALL_ID);
  });

  it('puts into the payload only what the caller passed', async () => {
    const [signal] = (await sendOne()).signals;
    expect(signal?.payload).toEqual(PAYLOAD);
  });
});

// `lib/telemetry.ts` queues every signal (#221), and a flush posts the queue. About
// states what a queued statistic carries: everything above, and the time it was made.
describe('what the TelemetryDeck SDK sends for a queued signal', () => {
  it('carries the time it was made, and otherwise what a sent signal does', async () => {
    const fetchStub = vi.fn(async (_url: string, _init: RequestInit) => new Response('{}'));
    vi.stubGlobal('fetch', fetchStub);
    const client = new TelemetryDeck({
      appID: 'APP',
      clientUser: INSTALL_ID,
      subtleCrypto: globalThis.crypto.subtle as unknown as Function,
    });
    await client.queue('app.launched', PAYLOAD);
    await client.flush();

    expect(fetchStub).toHaveBeenCalledTimes(1);
    const [url, init] = fetchStub.mock.calls[0] ?? [];
    expect(url).toBe('https://nom.telemetrydeck.com/v2/');
    const [signal] = JSON.parse(String(init?.body)) as Record<string, unknown>[];
    expect(Object.keys(signal ?? {}).sort()).toEqual([
      'appID',
      'clientUser',
      'payload',
      'receivedAt',
      'sessionID',
      'telemetryClientVersion',
      'type',
    ]);
    expect(Number.isNaN(Date.parse(String(signal?.receivedAt)))).toBe(false);
    expect(signal?.clientUser).toBe(createHash('sha256').update(INSTALL_ID).digest('hex'));
    expect(signal?.payload).toEqual(PAYLOAD);
  });
});
