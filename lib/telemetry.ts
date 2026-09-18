// The only module that imports the TelemetryDeck SDK. Screens call `track`;
// what may be sent, and when nothing is, lives in `lib/telemetryEvents.ts`.
//
// No global polyfill: the SDK takes `subtleCrypto` directly, so `expo-crypto`
// hashes the install ID, and Hermes provides `TextEncoder`.

import TelemetryDeck from '@telemetrydeck/sdk';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Updates from 'expo-updates';
import { Platform } from 'react-native';
import { useProgress } from '@/stores/progress';
import {
  buildPayload,
  isTestMode,
  telemetryGate,
  type TelemetryEvent,
  type TelemetryProps,
} from './telemetryEvents';

const appId = (Constants.expoConfig?.extra?.telemetryDeckAppId as string | undefined) ?? '';

let client: TelemetryDeck | null = null;

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
    });
  }
  return client;
}

/**
 * Send one allowlisted signal, or nothing. Fire-and-forget: never awaited by
 * callers, never throws — offline or failed signals are simply dropped, so
 * telemetry can never affect gameplay.
 */
export function track<E extends TelemetryEvent>(
  event: E,
  ...[props]: TelemetryProps[E] extends Record<string, never> ? [] : [TelemetryProps[E]]
): void {
  const { telemetryEnabled, installId } = useProgress.getState();
  const send = telemetryGate({
    isDev: __DEV__,
    platform: Platform.OS,
    enabled: telemetryEnabled,
    appId,
    installId,
    hasTextEncoder: typeof TextEncoder !== 'undefined',
  });
  if (!send || installId === null) return;

  const payload = buildPayload(event, (props ?? {}) as TelemetryProps[E]);
  try {
    clientFor(installId)
      .signal(event, payload)
      .catch(() => {});
  } catch {
    // Swallowed on purpose — see above.
  }
}
