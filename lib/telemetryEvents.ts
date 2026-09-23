// The telemetry allowlist and the pure decisions around it. Kept free of React
// Native and the SDK so Vitest can pin exactly what may leave the device —
// `lib/telemetry.ts` is the only module that actually sends anything.
//
// Every event and property here is disclosed in the privacy policy and the
// store privacy declarations. Adding one is a disclosure review, not just a
// code change (CLAUDE.md guardrail 4).

import type { Squad } from '@/types/squad';

type SquadKind = Squad['kind'];

/** Allowed property names per event. A value's type lives in `TelemetryProps`. */
export const TELEMETRY_EVENTS = {
  'app.launched': [],
  'round.started': ['kind', 'level'],
  'round.completed': ['kind', 'level', 'score', 'aLaEscuadra'],
  'study.opened': ['kind'],
  'result.shared': ['level', 'score'],
} as const satisfies Record<string, readonly string[]>;

export type TelemetryEvent = keyof typeof TELEMETRY_EVENTS;

export interface TelemetryProps {
  'app.launched': Record<string, never>;
  'round.started': { kind: SquadKind; level: number };
  'round.completed': { kind: SquadKind; level: number; score: number; aLaEscuadra: boolean };
  'study.opened': { kind: SquadKind };
  'result.shared': { level: number; score: number };
}

/**
 * The signal payload for an event: allowlisted keys only, every value a
 * string (TelemetryDeck stores payload values as strings anyway). Keys a
 * caller passes outside the allowlist are dropped, so a cast at a call site
 * cannot widen what is sent.
 */
export function buildPayload<E extends TelemetryEvent>(
  event: E,
  props: TelemetryProps[E],
): Record<string, string> {
  const payload: Record<string, string> = {};
  const values = props as Record<string, unknown>;
  for (const key of TELEMETRY_EVENTS[event]) {
    if (values[key] !== undefined) payload[key] = String(values[key]);
  }
  return payload;
}

export interface TelemetryEnvironment {
  isDev: boolean;
  platform: string;
  enabled: boolean;
  appId: string;
  installId: string | null;
  hasTextEncoder: boolean;
}

/**
 * Whether a signal may be sent at all. Inert in development and on web — the
 * web build is what `npm run shots*` captures, so Playwright never sends —
 * when the user has opted out, and whenever the pieces a signal needs are
 * missing, so a misconfiguration fails silent rather than crashing.
 */
export function telemetryGate(env: TelemetryEnvironment): boolean {
  return (
    !env.isDev &&
    env.platform !== 'web' &&
    env.enabled &&
    env.appId !== '' &&
    env.installId !== null &&
    env.hasTextEncoder
  );
}

/** Everything but a production-channel build sends TelemetryDeck test signals. */
export function isTestMode(channel: string | null): boolean {
  return channel !== 'production';
}
