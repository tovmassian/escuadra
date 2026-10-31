# Store declarations

What Escuadra declares in App Store Connect and Play Console: set once per app and changed
only when the app changes. What each answer means is the owner's call (guardrail 7), and
every answer agrees with `en.about.privacy` in `i18n/en.ts`, the complete statement of
what leaves the device. A change to what leaves the device updates this file in the same
PR. The paste sheet marks it _paste_ when it changed since the last version.

## Both stores

- Name: Escuadra
- Support URL: https://tovmassian.github.io/escuadra/support.html

## App Store Connect

- Category: Education, then Sports
- Age rating: 4+
- Privacy policy URL, each locale its own language's page:
  - en: https://tovmassian.github.io/escuadra/privacy/2/
  - es: https://tovmassian.github.io/escuadra/privacy/2/es.html
  - fr: https://tovmassian.github.io/escuadra/privacy/2/fr.html
  - it: https://tovmassian.github.io/escuadra/privacy/2/it.html
  - de: https://tovmassian.github.io/escuadra/privacy/2/de.html

### App Privacy

Entered before Submit for Review, with the privacy policy URLs.

- Identifiers, Device ID: not linked to the user, not used for tracking, purposes Analytics
  and App Functionality (TelemetryDeck's hashed form of a random identifier made for the
  statistics, and a random session code; the EAS Update check's installation ID).
- Usage Data, Product Interaction: not linked, not tracking, purpose Analytics (the events
  with their details, the appearance, vibration, Reduce Motion and text-size settings among
  them, and the context each carries: the app's version, update and, on iOS, build, the
  platform and the system's main version, and the app language). TelemetryDeck's App Privacy
  guidance lists no other data type for these (#221).
- Diagnostics, Crash Data: not linked, not tracking, purpose App Functionality (the
  expo-updates error message after a failed start).

## Play Console

- Category: Education
- Content rating: Everyone (IARC)
- Target audience: 13–15, 16–17 and 18 and over (owner, 2026-10-31). With children in the
  audience, the Families Policy forbids any SDK not approved for child-directed services,
  and TelemetryDeck states no such approval. Because 13–15-year-olds count as children in
  some countries, Play still asks for Families compliance whenever a child uses the app:
  suitable content, no ads from uncertified networks, COPPA and GDPR.
- AI asset declaration: no store image or video is labelled AI-generated (owner,
  2026-10-31). The screenshots are captures of the app, with Wikimedia Commons
  photographs; the feature graphic and the icon are vector art rendered from code,
  designed with Claude's help but not AI-generated images.
- Privacy policy URL, one for the app: https://tovmassian.github.io/escuadra/privacy/2/

### Data safety

Entered when the build is uploaded, with the privacy policy URL.

- App activity, App interactions: collected, not shared, optional (the "Usage statistics"
  switch), purpose Analytics (the events and the context each carries, as under App
  Privacy's Product Interaction).
- Device or other IDs: collected, not shared, required (the update check's ID is always
  sent; the statistics ID stops with the switch), purposes Analytics and App functionality.
- App info and performance, Crash logs: collected, not shared, required (the update check's
  error report after a failed start), purpose App functionality (the expo-updates error
  message).
- Processed ephemerally: no, for every data type.
- Encrypted in transit: yes.
- Deletion requests: none offered. The statistics carry a hashed random identifier (not
  the update check's) and a random session code, not linked to the user, and switching off
  "Usage statistics" in Settings stops the usage statistics; the app-update check keeps
  running.

## Not declared

- Wikimedia Commons photo loading (owner, 2026-10-20). Wikimedia is not a partner or an
  integrated SDK: the app fetches public files from its CDN as a browser would, and
  neither the developer nor a partner can access what Wikimedia receives. About still says
  what Wikimedia receives.
- The technical details of each request (owner, 2026-10-24): the app's build and the
  system version TelemetryDeck receives on iOS, and the operating system and the app's
  version and project the update check sends to Expo. They travel with each statistic or
  update check, and TelemetryDeck's App Privacy guidance lists no separate data type for
  them. About still states them. The version, build and system version a statistic also
  carries in its own content are its context, declared above under Product Interaction.
