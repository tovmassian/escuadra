# Store declarations

What Escuadra declares in App Store Connect and Play Console: set once per app and changed
only when the app changes. What each answer means is the owner's call (guardrail 7), and
every answer agrees with `en.about.privacy` in `i18n/en.ts`, the complete statement of
what leaves the device. A change to what leaves the device updates this file in the same
PR. The paste sheet lists it when it changed since the last version.

## Both stores

- Name: Escuadra
- Privacy policy URL: https://tovmassian.github.io/escuadra/privacy/2/
- Support URL: https://tovmassian.github.io/escuadra/support.html

## App Store Connect

- Category: Education, then Sports
- Age rating: 4+

### App Privacy

Entered before Submit for Review, with the privacy policy URL.

- Identifiers, Device ID: not linked to the user, not used for tracking, purpose Analytics
  (TelemetryDeck's hashed install ID and session code).
- Usage Data, Product Interaction: not linked, not tracking, purpose Analytics (the events,
  the app language among them).
- Diagnostics, Crash Data: not linked, not tracking, purpose App Functionality (the
  expo-updates error message after a failed start).
- The EAS Update check's installation ID, for App Functionality, as the 1.0.0 correction
  (#61) answered it.

## Play Console

- Category: Education
- Content rating: Everyone (IARC)

### Data safety

Entered when the build is uploaded, with the privacy policy URL.

- App activity, App interactions: collected, not shared, purpose Analytics.
- Device or other IDs: collected, not shared, purposes Analytics and App functionality.
- App info and performance, Crash logs: collected, not shared, purpose App functionality
  (the expo-updates error message).
- Encrypted in transit: yes.
- Deletion requests: none offered. The statistics carry only a hashed random installation
  ID and cannot be traced to a person, and switching off "Usage statistics" in Settings
  stops all sending.
- Consistent with the EAS Update answer in the Android 1.0 listing.

## Not declared

- Wikimedia Commons photo loading (owner, 2026-10-20). Wikimedia is not a partner or an
  integrated SDK: the app fetches public files from its CDN as a browser would, and
  neither the developer nor a partner can access what Wikimedia receives. About still says
  what Wikimedia receives.
