# App Store release — design

Date: 2026-09-10
Status: approved

## Context

Escuadra's v0 feature work is done: 7 screens, light and dark themes, 141 squads
(96 clubs, 45 nations), all `verified: true`, and no network calls anywhere in
`app/`, `components/`, `lib/`, `stores/` or `theme/`. What is missing is not
product — it is everything between a working Expo Go app and a listing someone
can download.

This spec covers that gap, and only that gap. It does not add features.

**Scope change from CLAUDE.md:** v0's definition of done says "Ships to the App
Store and Play Store". The Play Store half is deferred. v0 is **App Store
only**. The reason is Google's testing gate: a personal Play Console account
created after 13 Nov 2023 must run a closed test with at least 12 testers opted
in continuously for 14 days, then apply for production access, which is itself a
reviewed application taking a further 2–7 business days. That was the entire
critical path. Dropping it takes the release from roughly four weeks to under
two. Android moves to its own milestone with no due date.

## Decisions

| Decision              | Choice                                                    | Why                                                                                                                  |
| --------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Developer account     | Apple individual                                          | ~24–48h enrolment vs 1–2 weeks for the D-U-N-S number an organisation needs. Trade-off: seller name is a legal name. |
| Platforms in v0       | App Store only                                            | See above. Play Store deferred to its own milestone.                                                                 |
| Bundle ID             | `com.tovmassian.escuadra`                                 | Permanent and unchangeable after first publish. No domain required; same string serves as the Android package.       |
| Build pipeline        | EAS cloud build + EAS Submit, run manually                | No Xcode on this machine, and none needed. Free tier covers 15 iOS builds/month with no overage charges.             |
| Over-the-air updates  | None                                                      | Hard constraint #4 stands. See "Constraint #4" below.                                                                |
| Crash reporting       | App Store Connect's built-in reports                      | Zero SDK, zero code, zero network call from the app. Partial coverage, but free and real.                            |
| iPad                  | `supportsTablet: false`                                   | No `maxWidth` or `useWindowDimensions` anywhere; every layout is pure flex and would stretch on a 13" iPad.          |
| Privacy/support pages | GitHub Pages from a dedicated `gh-pages` branch           | `docs/` holds internal specs and plans; publishing from it would put them on a public website.                       |
| Screenshots           | Extend `scripts/capture-screens.mjs` with a store profile | Reuses infrastructure already trusted; regenerates in one command when a screen changes.                             |
| Nation count          | Ship 45                                                   | Six nations are registered but unwritten. Deregister them rather than block the release.                             |

## Constraint #4 holds

CLAUDE.md hard constraint #4 — "no auth, no accounts, no analytics SDKs, no
network calls; v0 is fully offline" — survives this release intact. Two
pressures were considered and both were resolved in the constraint's favour.

**Over-the-air updates.** `expo-updates` would ship squad corrections and
JS-level crash fixes in minutes instead of days. It also makes the app contact
a server on every launch, transmitting IP, platform and runtime version. That
would end "fully offline" as a true statement and complicate the App Privacy
answers. Rejected for v0. Squad files already carry `season`, so seasonal data
drift is the natural cadence. Adding it in v1 requires no redesign.

**Crash reporting.** Any SDK is out on the same grounds. App Store Connect
surfaces crash reports from users who have opted into sharing diagnostics with
Apple, requiring nothing from the app. Coverage is partial — native crashes yes,
some JS-only errors no — but it costs nothing and violates nothing.

**Privacy policy delivery.** The stores require a reachable URL, which
GitHub Pages supplies. The app itself does **not** link out: the policy text is
embedded in the About screen. The app therefore still makes no network call
under any user action.

## Work in the repo

### Build configuration

`app.json`:

- `ios.bundleIdentifier` and `android.package` → `com.tovmassian.escuadra`.
  Android is out of v0, but the package name is permanent and free to decide now.
- `ios.supportsTablet` → `false`
- `ios.infoPlist.ITSAppUsesNonExemptEncryption` → `false`, which suppresses the
  export-compliance prompt on every subsequent upload
- `userInterfaceStyle` stays `"automatic"` — see the CLAUDE.md warning

New `eas.json` with three profiles: `development`, `preview` (internal
distribution for device checks) and `production` (store builds with
`autoIncrement`, so build numbers are never hand-maintained). `eas-cli` is added
as a devDependency so its version is pinned in the repo rather than floating on
one machine.

### About screen

New route `app/about.tsx`, reachable from Home. It carries:

- the unofficial-and-unaffiliated disclaimer
- attribution for squad data (Wikipedia) and flags (flagpedia, public domain)
- the privacy policy text, inline
- app version and build number, via `expo-constants`

Tokens only, both palettes, per hard constraint #5.

### Show `squad.season`

`season` is present on every squad file and rendered nowhere. Surfacing it on
the team picker and the results screen is the cheapest available defence against
"these shirt numbers are wrong" reviews after a transfer window.

### Store screenshots

`scripts/capture-screens.mjs` renders at 390×844 @2x = 780×1688. Apple's 6.9"
class needs 1320×2868. Add a store profile at 440×956 @3x, plus a caption and
device-frame composition pass, writing to `design/store/`. `design/screens/`
keeps its current job unchanged.

Web rendering can differ from native, so the output is verified against a real
TestFlight build before submission.

### Legal pages

A `gh-pages` branch with `index.html`, `privacy.html` and `support.html`.

### Nation data

`data/teams.json` registers 51 nations; only 45 squad files exist. The six
without files are `cro`, `uru`, `rus`, `hun`, `cmr` and `ven`. They are
deregistered from `data/teams.json` so the registry matches what ships, the
milestone description is corrected from 51 to 45, and a follow-up issue tracks
adding them after launch.

### Documentation

`README.md` currently says Escuadra is "for iOS", "Dark-only", and needs "no
Apple Developer account". The first is now a deliberate v0 scope decision rather
than a limitation, and the other two are false. CLAUDE.md gets the v0 checklist
ticked, the Play Store deferral recorded, and these decisions noted.

## Work in App Store Connect

Enrolment, then: reserve the name "Escuadra" (a store search found no exact
match, but only reservation settles it), create the app record, set a 4+ age
rating, and complete App Privacy as **no data collected** — which is true, and
verifiable by grep.

Category is **primary Education, secondary Sports**. Education matches the
product thesis in CLAUDE.md — a study tool, not a party game — and consistency
between the listing and the app is what a reviewer checks. It also sits furthest
from Games › Trivia, where guideline 4.3 "spam" rejections concentrate for quiz
apps from new individual developers. Sports as secondary still surfaces the app
to football fans browsing.

Listing content: subtitle (30 chars), keywords (100 chars), description,
promotional text, support URL, privacy URL, and 6.9" screenshots. No iPad
screenshots, because `supportsTablet` is false.

## Schedule

Day 0 is Thursday 2026-09-10. Estimate is days of **focused work**, excluding
waiting. Priority: **P0** means on the critical path, so slipping it slips the
launch; **P1** means required for launch but carrying slack.

| Issue                              | Pri | Size | Est  | Start      | Target     |
| ---------------------------------- | --- | ---- | ---- | ---------- | ---------- |
| #24 Apple enrolment + reserve name | P0  | S    | 0.5  | Thu 10 Sep | Sat 12 Sep |
| #25 app.json + eas.json + eas-cli  | P0  | S    | 0.5  | Thu 10 Sep | Fri 11 Sep |
| #30 deregister 6 nations           | P1  | XS   | 0.25 | Thu 10 Sep | Thu 10 Sep |
| #26 About screen + `season`        | P0  | M    | 1.5  | Fri 11 Sep | Sun 13 Sep |
| #27 privacy + support on gh-pages  | P1  | S    | 0.5  | Fri 11 Sep | Sun 13 Sep |
| #28 store screenshots              | P0  | M    | 1.0  | Mon 14 Sep | Tue 15 Sep |
| #29 listing, submission, review    | P0  | M    | 1.0  | Tue 15 Sep | Tue 22 Sep |

Roughly 5.25 days of real work across 14 calendar days. The gap is waiting —
Apple's enrolment approval and Apple's review queue — not effort.

`#24` is P0 despite being among the smallest tasks: nothing in App Store Connect
can start until it clears, and there is no lever to speed it up.

`#26` and `#27` share a start date deliberately. The privacy wording is authored
once and used in both, embedded in the About screen and published to Pages.
Doing them apart is how the two copies diverge.

`#28` cannot start before Sunday 13th, because screenshots must show the
finished app and `#26` changes two of the screens captured.

`#29` targets Tuesday 22nd rather than the 15th: one day of work, then three to
four days in Apple's queue.

Milestone `First release` is due 2026-09-24, leaving two days of slack. That is
enough for a slow review. It is not enough for a rejection and resubmission.

These five fields — priority, size, estimate, start date and target date — exist
only as GitHub Projects v2 fields, which need the `project` auth scope
(`gh auth refresh -s project`). Until that board exists, this table and the one
in `#7` are the record.

## Risks

**Apple rejection.** Ranked by likelihood for this app: guideline 2.1 for a
crash or incomplete metadata; 4.3 for "spam", which quiz and trivia apps draw
disproportionately; 5.2.2 for third-party intellectual property, given club and
competition names appear as text. The 5.2.2 exposure is already minimised by
hard constraint #2 — no crests, badges, logos or shield shapes anywhere — and
the About screen's disclaimer addresses it directly. The 4.3 risk is mitigated
by the listing positioning Escuadra as a study tool rather than a trivia game.

**Data accuracy.** All 141 squads are `verified: true`, which asserts fidelity to
the Wikipedia source, not that the source is right. Surfacing `season` sets the
right expectation. Without OTA, corrections wait on a store release.

**Web-rendered screenshots drifting from native.** Mitigated by checking against
the TestFlight build before submitting.

**Seller name.** An Apple individual account publishes under a legal name,
publicly, on every listing. There is no way around this on the individual tier.

## Issue tree

`#7` becomes the epic, holding the calendar and these decisions. Its sub-issues:

1. `ops(release): Apple Developer enrolment + reserve "Escuadra"` — day 0, blocks all
2. `build(release): app.json + eas.json + eas-cli`
3. `feat: About screen — disclaimer, attribution, privacy text, version`
4. `docs(release): privacy + support pages on a gh-pages branch`
5. `design(release): store screenshots at 1320×2868`
6. `ops(release): App Store listing, submission and review`

Standalone, because it blocks listing copy rather than release plumbing:

- `data: deregister 6 nations with no squad file`

`#8` moves out of `First release` into a new `Play Store release` milestone with
no due date.

Concrete steps live as task-list checkboxes inside each sub-issue, not as a third
tier of issues. A checkbox costs nothing; a sub-issue costs a title, a label, a
milestone and a close action. A checkbox is promoted to a real sub-issue only if
it grows a discussion or turns out to block something.

GitHub sub-issues carry no dependency semantics, so ordering and the two
wall-clock waits — Apple's review queue, and enrolment approval — live in the
epic body as prose.
