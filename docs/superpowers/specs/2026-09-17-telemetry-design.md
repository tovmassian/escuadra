# Telemetry (TelemetryDeck) — design

Issue: #53 · Milestone: v1.1.0 · Branch: `feat/53-telemetry` → `release-1.1.0`

## Goal

Measure retention (D1/D7), weekly active users and rounds per user with a
privacy-first, anonymous, opt-out telemetry layer. Nothing identifying, no
free text, no player data.

## Decisions (agreed 2026-09-17)

- **No global polyfill, no custom entry file.** `@telemetrydeck/sdk` 2.x takes
  a `subtleCrypto` option; we pass `{ digest: Crypto.digest }` from
  `expo-crypto`. Hermes on RN 0.86 ships `TextEncoder`, so `text-encoding` is
  not installed. The gate refuses to send if `TextEncoder` is missing, so the
  worst case is silence, never a crash.
- **App ID** lives in `app.json` → `expo.extra.telemetryDeckAppId`, read via
  `expo-constants`. Empty string = inert.
- **Test mode** = `Updates.channel !== 'production'`. Preview builds
  (`channel: preview`) send test signals; dev builds never send at all.

## Units

| Unit                     | Role                                                                                                                                                                                                |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/telemetryEvents.ts` | Pure. Typed event allowlist, `buildPayload`, `telemetryGate`, `isTestMode`. No React Native imports — Vitest-tested.                                                                                |
| `lib/telemetry.ts`       | The **only** importer of `@telemetrydeck/sdk`. `track(event, props)`: fire-and-forget, never throws. Lazily builds the client; reads opt-out and install ID from `useProgress.getState()` per call. |
| `stores/progress.ts`     | `installId: string \| null`, `telemetryEnabled: boolean` (default `true`). Both survive `reset()`.                                                                                                  |
| `app/_layout.tsx`        | After hydration: create the install ID once (`Crypto.randomUUID()`), then `track('app.launched')` once per JS launch.                                                                               |
| `app/about.tsx`          | "Share anonymous usage statistics" `Switch`, palette colours only.                                                                                                                                  |

## Allowlist

| Event             | Props                                   | Fired from                             |
| ----------------- | --------------------------------------- | -------------------------------------- |
| `app.launched`    | —                                       | root layout, after hydration           |
| `round.started`   | `kind: 'club' \| 'nation'`, `level`     | question screen, when a round is built |
| `round.completed` | `kind`, `level`, `score`, `aLaEscuadra` | question screen, when phase → complete |
| `study.opened`    | `kind`                                  | Study screen mount                     |
| `result.shared`   | `level`, `score`                        | share feature (#56)                    |

## Gate — nothing is sent when

`__DEV__`; `Platform.OS === 'web'` (covers `npm run shots*`, which captures
the web build); telemetry disabled; no install ID; empty App ID; no
`TextEncoder`.

## Tradeoffs

- Offline signals are dropped, not queued. Slight undercount; zero added
  complexity and no effect on offline play.
- Until #54 lands, `release-1.1.0` sends telemetry while the About privacy text
  says otherwise. Acceptable on an unreleased branch; #60 gates the release on
  #54/#55.
- `expo-crypto` is native: the fingerprint moves. Expected — 1.1.0 is a store
  build.

## Testing

Vitest over `lib/telemetryEvents.ts`: allowlist coverage, payload stringifying
and property filtering, every gate condition, test-mode mapping. Screens are
verified on device/simulator, per the repo's existing convention.
