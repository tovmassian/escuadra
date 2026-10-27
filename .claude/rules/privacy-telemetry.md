---
paths:
  - "lib/telemetry*.ts"
  - "lib/__tests__/telemetry*.ts"
  - "app/about.tsx"
  - "app/settings.tsx"
  - "lib/settingsView.ts"
  - "scripts/privacy-pages.ts"
  - "i18n/en.ts"
  - "i18n/translationNotice.ts"
  - "package.json"
  - "package-lock.json"
---

# Privacy, About and telemetry

## What leaves the device (guardrail 4)

**Offline-first, and privacy disclosures always match the binary.** Core
gameplay must work with no connection; squad data stays bundled. Network
features are allowed when an issue asks for them. The rule is honesty,
not abstinence: any change that alters what leaves the device (analytics,
crash reporting, a backend call, a new SDK) ships **together** with the
updated privacy policy (the privacy pages and the About screen text,
word for word), Apple's App Privacy answers and Google Play's Data safety
form — in a store build, never over the air.

The app's traffic is `expo-updates` checking EAS Update on launch, TelemetryDeck's opt-out usage signals, and player-photo thumbnails from Wikimedia Commons (`upload.`/`thumb.wikimedia.org`). Settings' Rate hands a store URL to the OS (`Linking`, `lib/storeReview.ts`); the store app loads it, so it is not app traffic and needs no disclosure. `en.about.privacy` (`i18n/en.ts`) is the complete statement of what each service receives. Apple's App Privacy and Play's Data safety answers are `store/declarations.md` (`.claude/rules/store-listing.md`): a change to what leaves the device updates it in the same PR, as it does About.

## About stays true (guardrail 7)

About's Privacy section also reaches the privacy pages
that `scripts/privacy-pages.ts` renders, word for word (guardrail 4).

The web policy is versioned, one folder per policy version: `docs/release.md`, Cut a release.

## Telemetry

**Telemetry** is TelemetryDeck, anonymous and opt-out. The event allowlist
— every event name and property that may leave the device — is
`TELEMETRY_EVENTS` in `lib/telemetryEvents.ts`, with `TELEMETRY_CONTEXT`, the
keys every signal carries (the app's version, build, platform, system and
update, and the language), and the pure gate that keeps it inert in `__DEV__`,
on web (so `npm run shots*` never sends), when opted out, and with no App ID
(`app.json` → `extra.telemetryDeckAppId`). What each event means and answers is
the data dictionary, `docs/superpowers/specs/2026-10-26-telemetry-2-0-design.md`.
`lib/telemetry.ts` is the only app module that imports the SDK; screens call
its `track()`. The anonymous `clientUser` is a random `installId` persisted in
`stores/progress.ts`, next to the Settings-screen opt-out. Non-`production`
channels send TelemetryDeck test signals.

- **Queued, not sent at once.** `track()` queues each signal, with the time it
  was made, in `stores/progress.ts` (`telemetryQueue`), and flushes it, 100 at a
  time. A batch leaves the queue only when the response says sent or refused, and
  one with no answer in 30 s is kept (`lib/telemetryQueue.ts`): at least once,
  never lost to a hang. Switching usage statistics off and Reset Escuadra
  empty it, and a signal still being built for a replaced identifier is never
  queued. `trackNow()` skips the queue for Reset Escuadra's own signal
  (`lib/__tests__/telemetryQueueing.test.ts`).
- **Sessions.** A session starts on a cold start, on a return after 5 minutes in
  the background (`nextAppPhase`, `SESSION_GAP_MS`: Android reports the share
  menu as the background), and when usage statistics are switched back on. The
  client takes a new session code, and `TelemetryDeck.Session.started` is sent.
  `startLaunch` sends the cold start's session and `app.launched` once per JS start,
  and watches `AppState` from then on: Android mounts the root again when Escuadra is
  reopened after Back (`lib/__tests__/telemetryLaunch.test.ts`). The
  build number is iOS's only (spec, Decisions). Reset Escuadra replaces `installId`
  but starts no session: the one client points at the current id
  (`lib/__tests__/telemetryIdentifier.test.ts` pins it).
- **The contract.** From 2.0.0 on, event names, property names and value sets
  are kept: add, never rename; a changed meaning gets a new name, so a series
  stays comparable across versions. `lib/__tests__/telemetryEvents.test.ts` pins
  the whole allowlist and the context.

**A new event or property is a disclosure review** (guardrail 4):
the privacy policy, About text, App Privacy and Data safety answers change
with it, in a store build. So is an upgrade of `@telemetrydeck/sdk` (or of
`expo-updates`), because About states what those SDKs put in each request.
For TelemetryDeck, `lib/__tests__/telemetrySdk.test.ts` pins the request, a sent
one and a queued one, and a failure there means About no longer describes it;
`expo-updates` has no such test, so read its changelog. Never put names, free
text or player data in a payload; a team travels only as its squad id.
