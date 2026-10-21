---
paths:
  - "lib/telemetry*.ts"
  - "lib/telemetrySdk.test.ts"
  - "app/about.tsx"
  - "lib/aboutView.ts"
  - "scripts/privacy-pages.ts"
  - "i18n/en.ts"
  - "i18n/translationNotice.ts"
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

Today that is `expo-updates` checking EAS Update on launch, TelemetryDeck's opt-out usage signals, and player-photo thumbnails from Wikimedia Commons (`upload.`/`thumb.wikimedia.org`). `en.about.privacy` (`i18n/en.ts`) is the complete statement of what each service receives.

## About stays true (guardrail 7)

About's Privacy section also reaches the privacy pages
that `scripts/privacy-pages.ts` renders, word for word (guardrail 4).

The web policy is versioned, one folder per policy version: `docs/release.md`, Cut a release.

## Telemetry

**Telemetry** is TelemetryDeck, anonymous and opt-out. The event allowlist
— every event name and property that may leave the device — is
`TELEMETRY_EVENTS` in `lib/telemetryEvents.ts`, alongside the pure gate
that keeps it inert in `__DEV__`, on web (so `npm run shots*` never sends),
when opted out, and with no App ID (`app.json` →
`extra.telemetryDeckAppId`). `lib/telemetry.ts` is the only app module that
imports the SDK; screens call its `track()`. The anonymous `clientUser` is
a random `installId` persisted in `stores/progress.ts`, next to the
About-screen opt-out. Non-`production` channels send TelemetryDeck test
signals. **A new event or property is a disclosure review** (guardrail 4):
the privacy policy, About text, App Privacy and Data safety answers change
with it, in a store build. So is an upgrade of `@telemetrydeck/sdk` (or of
`expo-updates`), because About states what those SDKs put in each request.
For TelemetryDeck, `lib/telemetrySdk.test.ts` pins the request, and a failure
there means About no longer describes it; `expo-updates` has no such test, so
read its changelog. Never put names, free text or player data in a payload.
