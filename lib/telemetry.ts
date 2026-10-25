// The only module that imports the TelemetryDeck SDK. Screens call `track`;
// what may be sent, and when nothing is, lives in `lib/telemetryEvents.ts`.
//
// Signals are queued (#221): the SDK builds each one with the time it was made,
// `stores/progress.ts` keeps it, and a flush posts the queue, keeping a batch
// that found no connection for the next one (`lib/telemetryQueue.ts`).
//
// No global polyfill: the SDK takes `subtleCrypto` directly, so `expo-crypto`
// hashes the install ID, and Hermes provides `TextEncoder`.

import type { Language } from '@/i18n/resolveLanguage';
import { useProgress } from '@/stores/progress';
import TelemetryDeck, { type TelemetryDeckOptions } from '@telemetrydeck/sdk';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Updates from 'expo-updates';
import { Platform } from 'react-native';
import { updateTag } from './settingsView';
import {
  buildPayload,
  contextPayload,
  isTestMode,
  telemetryGate,
  type TelemetryContextInput,
  type TelemetryEvent,
  type TelemetryProps,
} from './telemetryEvents';
import { flushOutcome, type QueuedSignal } from './telemetryQueue';

const appId = (Constants.expoConfig?.extra?.telemetryDeckAppId as string | undefined) ?? '';

let client: TelemetryDeck | null = null;
let language: Language | null = null;

/** The language every signal names, handed over by the root layout as it resolves. */
export function setTelemetryLanguage(next: Language): void {
  language = next;
}

// The SDK's queue store, kept in `stores/progress.ts`. The SDK clears its store
// as soon as a flush posts, before the response comes; this one ignores that, and
// `flushOnce` drops the batch it handed over only once the response says so.
let handed: QueuedSignal[] = [];
const store = {
  async push(body: Promise<QueuedSignal>): Promise<void> {
    // The identifier the signal is being built for. A reset or an opt-out while
    // it is built (an async hash) means it is never queued.
    const builtFor = useProgress.getState().installId;
    const signal = await body;
    const { telemetryEnabled, installId, pushTelemetry } = useProgress.getState();
    if (telemetryEnabled && installId === builtFor) pushTelemetry(signal, Date.now());
  },
  values(): QueuedSignal[] {
    handed = useProgress.getState().telemetryQueue.slice();
    return handed;
  },
  clear(): void {},
};

function clientFor(installId: string): TelemetryDeck {
  if (!client) {
    client = new TelemetryDeck({
      appID: appId,
      clientUser: installId,
      testMode: isTestMode(Updates.channel),
      subtleCrypto: {
        digest: (algorithm: Crypto.CryptoDigestAlgorithm, data: BufferSource) =>
          Crypto.digest(algorithm, data),
      } as unknown as Function,
      store: store as unknown as TelemetryDeckOptions['store'],
    });
  }
  // Reset Escuadra (#197) replaces the identifier mid-run. The SDK reads
  // `clientUser` (and re-hashes it when it changed) each time a signal is built,
  // so pointing the one client at the current identifier keeps this session's
  // code, which About says is new only when a session starts.
  client.clientUser = installId;
  return client;
}

let flushing = false;
let again = false;

/** Posts the queue, one flush at a time; a signal queued meanwhile goes in another pass. */
async function flush(): Promise<void> {
  if (flushing) {
    again = true;
    return;
  }
  flushing = true;
  try {
    do {
      again = false;
      await flushOnce();
    } while (again);
  } finally {
    flushing = false;
  }
}

async function flushOnce(): Promise<void> {
  if (!client || useProgress.getState().telemetryQueue.length === 0) return;
  // The SDK takes its batch through `store.values()` before its first await.
  const request = client.flush();
  const batch = handed;
  let status: number | null = null;
  try {
    status = (await request).status;
  } catch {
    // No connection: the batch waits for the next flush.
  }
  if (flushOutcome(status) !== 'kept') useProgress.getState().dropTelemetry(batch);
}

type AppContext = Omit<TelemetryContextInput, 'language'>;
let app: AppContext | null = null;

/**
 * What every signal says about the app (spec, Context on every signal). Read
 * once: none of it changes while the app runs. A value that can't be read is
 * left out, so a native module that misbehaves never stops a signal.
 */
function context(): TelemetryContextInput {
  app ??= {
    os: Platform.OS,
    appVersion: read(() => Constants.expoConfig?.version ?? null),
    buildNumber: read(buildNumber),
    osVersion: read(osVersion),
    update: read(() =>
      updateTag({
        isEnabled: Updates.isEnabled,
        isEmbeddedLaunch: Updates.isEmbeddedLaunch,
        updateId: Updates.updateId,
        channel: Updates.channel,
        manifest: Updates.manifest,
      }),
    ),
  };
  return { ...app, language };
}

function read(value: () => string | null): string | null {
  try {
    return value();
  } catch {
    return null;
  }
}

/** The embedded native build number, which an update cannot change. */
function buildNumber(): string | null {
  if (Platform.OS === 'ios') return Constants.platform?.ios?.buildNumber ?? null;
  // `versionCode` is deprecated for `expo-application`, which the app does not
  // otherwise need; it still reads the embedded value.
  const code = Constants.platform?.android?.versionCode as number | null | undefined;
  return code === undefined || code === null ? null : String(code);
}

/** The system's version: `18.1` on iOS; on Android its release, `15`, not the API level. */
function osVersion(): string | null {
  if (Platform.OS === 'android') {
    return (Platform.constants as { Release?: string } | undefined)?.Release ?? null;
  }
  return Platform.Version === undefined ? null : String(Platform.Version);
}

type Props<E extends TelemetryEvent> =
  TelemetryProps[E] extends Record<string, never> ? [] : [TelemetryProps[E]];

/** Builds the payload and hands it to `deliver`, or does nothing (the gate). Never throws. */
function send<E extends TelemetryEvent>(
  event: E,
  props: TelemetryProps[E] | undefined,
  deliver: (to: TelemetryDeck, payload: Record<string, string>) => Promise<unknown>,
): void {
  const { telemetryEnabled, installId } = useProgress.getState();
  const allowed = telemetryGate({
    isDev: __DEV__,
    platform: Platform.OS,
    enabled: telemetryEnabled,
    appId,
    installId,
    hasTextEncoder: typeof TextEncoder !== 'undefined',
  });
  if (!allowed || installId === null) return;

  const payload = {
    ...contextPayload(context()),
    ...buildPayload(event, (props ?? {}) as TelemetryProps[E]),
  };
  try {
    deliver(clientFor(installId), payload).catch(() => {});
  } catch {
    // Swallowed on purpose: telemetry can never affect gameplay.
  }
}

/**
 * Queue one allowlisted signal, then flush, or do nothing. Fire-and-forget:
 * never awaited by callers, never throws. Offline, the signal waits in the queue.
 */
export function track<E extends TelemetryEvent>(event: E, ...[props]: Props<E>): void {
  send(event, props, (to, payload) => to.queue(event, payload).then(() => flush()));
}

/**
 * Send one allowlisted signal at once, outside the queue: for Reset Escuadra's
 * own signal, sent just before the reset empties the queue. Offline, it is lost.
 */
export function trackNow<E extends TelemetryEvent>(event: E, ...[props]: Props<E>): void {
  send(event, props, (to, payload) => to.signal(event, payload));
}

/**
 * A session starts (spec, Sessions): `renew` on a return from the background,
 * when the client takes a new session code first; the cold start keeps the
 * client's own. Either way `TelemetryDeck.Session.started` is sent, which also
 * flushes anything left waiting.
 */
export function startSession(renew: boolean): void {
  if (renew && client) client.sessionID = Crypto.randomUUID();
  track('TelemetryDeck.Session.started');
}
