# Testing on devices

How Escuadra is tested on a real iPhone and a real Android phone: what needs a device, what
to set up, the builds, how a session drives each phone, and the traps a pass runs into. Read
it before a device pass, or before any check a PR's device checklist asks for.

## What needs a device

`npm run shots` covers the default-size layout on the web build (`design-handoff`). The rest
needs a native build on a phone:

- screen readers (VoiceOver, TalkBack): labels, reading order, where focus lands;
- the system text size (Dynamic Type, Android's font and display size);
- Reduce Motion, read live (`hooks/useReduceMotion.ts`);
- the native splash, a cold launch, haptics, the share sheet, the rating dialog;
- telemetry, which is off in `__DEV__` and on web.

## Ground rules

These are the owner's, and hold in every session:

- **The phones' system settings are the owner's.** Text size, VoiceOver or TalkBack, Reduce
  Motion, animation scales, the text-to-speech language: read them, never change them. The
  tools below can set some of them; don't. Your own emulators are yours to set.
- **Only Escuadra's data.** Resetting, wiping or reinstalling Escuadra needs the owner's OK
  for the pass. Never touch another app or a personal file.
- **Capture the iPhone only while Escuadra is in front.** Check the front app before every
  screenshot (WebDriverAgent's `/wda/activeAppInfo`). A frame that may show another app,
  such as one recorded before Escuadra launched, is deleted without being opened. Tell the
  owner if it happens.
- **Leave another app's alert alone** (a health alarm, a call). Pause until it clears.
- **Builds and publishing:** an EAS build uses the Expo plan's build quota, so ask first.
  Never merge, publish an OTA or start a store build (`docs/release.md`).
- **The owner ticks the test plan's boxes.** A PR's device checklist you may tick.
- For a long unattended run, keep the Mac awake with `caffeinate -dimsu -t 21600` (six
  hours).

## Prerequisites

**On the Mac:**

- Node 24 (`nvm use`) and `npm ci` in the checkout under test.
- Android Studio, for the SDK (`~/Library/Android/sdk`: `adb`, `emulator`) and its JDK
  (`jbr`).
- Xcode in `/Applications`, signed in to the Apple developer account (Xcode › Settings ›
  Accounts). Only iOS taps need it.
- Python 3 (macOS's own) for pymobiledevice3.
- An Expo login for EAS builds (`npx eas-cli whoami`).
- For usage statistics: Chrome with Claude in Chrome, signed in to TelemetryDeck.

**On the phones, by the owner, once:**

- iPhone: Developer Mode on, and Settings › Developer › **Enable UI Automation** on. The
  phone registered for ad hoc installs, and the development build installed (Builds).
- Android: Developer options › USB debugging on, and the Mac's key accepted.
- Both: unlocked, Auto-Lock (iOS) or Screen timeout (Android) at its longest, and charged.
- An OK to download WebDriverAgent, Appium's open-source test runner
  (github.com/appium/WebDriverAgent).

## The test plan

A device pass is an issue; #187 is the model. Each **journey** has one setup: one platform,
one assistive setting, one language, one starting state. Its steps are numbered, so a
failure is reported as `J3.12 iOS: …`. A run log of boxes, one per journey and platform,
sits at the top.

- **Languages.** German has the longest strings, so large text runs in Deutsch; French
  catches the rest.
- **States:**
  - **Fresh:** Settings › Your data › Reset Escuadra. It clears scores, stars and the How to
    play tips. A tip shows once, so re-testing one needs a fresh state.
  - **Played-in:** a few squads at different levels, one starred and unplayed, one
    outdated. It takes longest to make, so the order of journeys keeps it as long as it's
    needed.
  - **An outdated squad:** set its `lastUpdated` to today in both `data/index.json` and its
    squad file (`data/squads/…`): the screens read the squad file. Restore both files
    afterwards (see Gotchas).
- **Findings** go in one status comment on the issue, edited as it grows. Fixes go in one
  PR, each in its own commit, with a device checklist.

## Builds

### iOS: a development build and Metro

The `development` profile in `eas.json` builds the dev client, a native shell that loads
JavaScript from Metro. A JavaScript change arrives with a reload; a native change needs a
new build, and the owner's OK. It has the App Store app's bundle ID, so it replaces an App
Store install.

```bash
npx eas-cli device:create                                # once: register the iPhone
npx eas-cli build --profile development --platform ios   # the owner's OK first
npx expo start --dev-client --no-dev --minify            # every session
```

- **`--no-dev --minify`** serves a production bundle, so `__DEV__` is false and telemetry
  runs, as in a store build. A plain `npx expo start` turns telemetry off.
- **Metro serves its own checkout, as it is on disk.** Run it from the checkout under
  test. Its working directory shows with `ps -Aww -o pid,command | grep "expo start"`, then
  `lsof -a -p <pid> -d cwd`.
- **A reload is the cold launch.** Use Metro's `r`, or the dev menu: the floating gear,
  then Reload (shake the phone if the gear is hidden). It plays the intro again but shows
  the dev client's loading screen, not the native splash. The native splash and the first
  focus after a cold launch are checked on TestFlight.

### Android: a local release APK

A release build bundles the JavaScript, with `__DEV__` false, R8 and the native splash, so
every Android check runs on it, cold launches included. Build in a separate, detached
worktree (`git worktree add --detach ../escuadra-android <sha>`), so `android/` and Gradle's
edits stay out of your branch:

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk" CI=1
npm ci && npx expo prebuild --platform android --no-install
(cd android && ./gradlew assembleRelease)    # → android/app/build/outputs/apk/release/app-release.apk
```

- **Name each APK after its commit**, for example `escuadra-2.0-pr225-<sha>.apk`, in a
  folder outside the repo.
- **A JavaScript-only change** skips `npm ci` and `prebuild`. Make Gradle rebuild the
  bundle with `./gradlew :app:createBundleReleaseJsAndAssets --rerun assembleRelease`: it
  doesn't see a change under `data/`.
- **Install** with `adb install -r`, which keeps Escuadra's data. A local build has version
  code 1 and React Native's debug key, so it won't install over a Play install. Uninstalling
  wipes the data: the owner's OK first (`docs/release.md`, Cut preview builds).
- **Gradle edits a library's `AndroidManifest.xml` in `node_modules`,** which moves the iOS
  fingerprint. Run `npm ci` before an EAS build in a checkout that has built Android.
- **An older version** (an upgrade test) builds in its own worktree at its release branch,
  with its own `node_modules` and the JDK its Android Gradle plugin accepts.

### Android emulators

For the sizes the phones don't cover: a 360 × 640 dp phone, a tablet. List them with
`emulator -list-avds`. Start one headless, then wait for `sys.boot_completed`:

```bash
~/Library/Android/sdk/emulator/emulator -avd <name> -no-window -no-boot-anim -no-audio -gpu swiftshader_indirect
adb -s emulator-5554 shell getprop sys.boot_completed    # 1 once booted
```

On your own emulator you may change settings: `wm user-rotation lock 0|1` rotates it, and
`settings put secure enabled_accessibility_services
com.google.android.marvin.talkback/com.google.android.marvin.talkback.TalkBackService`
turns TalkBack on (`null` turns it off). An AVD that holds a Play install refuses local
builds.

## Driving the iPhone

### The tunnel: pymobiledevice3

Install it in a virtual environment in the session's scratchpad, with Pillow for contact
sheets:

```bash
python3 -m venv pmd3 && pmd3/bin/pip install pymobiledevice3 pillow
pmd3/bin/pymobiledevice3 remote start-tunnel --native --script-mode   # background; prints HOST PORT
pmd3/bin/pymobiledevice3 mounter auto-mount --rsd HOST PORT           # once per phone boot
```

The tunnel needs no `sudo` with `--native`, and works over the cable or over Wi-Fi (the
same network; `xcrun devicectl list devices` shows which). Keep `HOST PORT` in a file: every
command takes `--rsd HOST PORT`, and it changes with each tunnel. Without WebDriverAgent it
already gives:

| Command (each with `--rsd HOST PORT`)   | Gives                                                 |
| --------------------------------------- | ----------------------------------------------------- |
| `developer dvt screenshot OUT.png`      | a screenshot                                          |
| `developer accessibility list-items`    | each element's caption, in VoiceOver's swipe order    |
| `developer accessibility settings show` | `DYNAMIC_TYPE`, `REDUCE_MOTION` and the others (read) |

For a fast state, such as a tip's timing or a focus change, record a burst: the Python
API's `DvtProvider` and `Screenshot` (`pymobiledevice3.services.dvt.instruments`) in a
loop, keeping only frames that change. The accessibility audit's press doesn't work on the ad hoc dev
build; tapping needs WebDriverAgent.

### Taps: WebDriverAgent

Build it once, then run it in the background for the session. The phone's identifier is in
`xcrun devicectl list devices`, the team in Xcode's Accounts:

```bash
curl -sSL -o wda.tar.gz https://github.com/appium/WebDriverAgent/archive/refs/heads/master.tar.gz && tar xzf wda.tar.gz
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild test \
  -project WebDriverAgent-master/WebDriverAgent.xcodeproj -scheme WebDriverAgentRunner \
  -destination id=<device id> -derivedDataPath wda-dd -allowProvisioningUpdates \
  DEVELOPMENT_TEAM=<team> CODE_SIGN_STYLE=Automatic PRODUCT_BUNDLE_IDENTIFIER=com.tovmassian.WebDriverAgentRunner
```

It's up when its log prints `ServerURLHere`. Reach it at `http://[HOST]:8100`, the tunnel's
address. Over the cable, `pymobiledevice3 usbmux forward 8100 8100` serves it on
`localhost:8100` too. The endpoints a pass needs, all JSON:

| Request                                                                | Does                                                    |
| ---------------------------------------------------------------------- | ------------------------------------------------------- |
| `POST /session` `{"capabilities":{"alwaysMatch":{}}}`                  | opens a session; keep its `sessionId`                   |
| `GET /wda/activeAppInfo`                                               | the front app's `bundleId`: `com.tovmassian.escuadra`?  |
| `GET /source?format=json`                                              | the whole screen's tree, with labels and rects, at once |
| `POST /session/<id>/elements` `{"using":"predicate string","value":…}` | elements matching a predicate                           |
| `GET /session/<id>/element/<el>/rect`                                  | an element's frame, in points                           |
| `POST /session/<id>/wda/tap` `{"x":…,"y":…}`                           | a tap, in points                                        |
| `POST /session/<id>/wda/dragfromtoforduration`                         | a swipe (`fromX`, `fromY`, `toX`, `toY`, `duration`)    |
| `POST /session/<id>/url` `{"url":"escuadra://…"}`                      | a deep link                                             |
| `GET /screenshot`                                                      | a base64 PNG                                            |
| `POST /session/<id>/wda/apps/launch` or `…/terminate` `{"bundleId":…}` | launches or quits the app                               |

- **Read the screen with `/source`**, one request per look. A request per element takes
  seconds per screen.
- **Tap by label, never by fixed point**: a text size or a language moves everything. A
  predicate such as `label BEGINSWITH 'Weiter' AND visible == 1` survives both. Swipe a
  control below the screen into view before tapping it.

## Driving an Android phone

`adb` is in `~/Library/Android/sdk/platform-tools`. With an emulator running too, pass
`-s <serial>` (`adb devices`) on every call.

| Command (`adb -s <serial> …`)                                                          | Does                                                             |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `exec-out uiautomator dump /dev/tty`                                                   | the screen as XML: `text`, `content-desc`, `clickable`, `bounds` |
| `shell input tap X Y` · `swipe X1 Y1 X2 Y2 MS` · `keyevent KEYCODE_BACK`               | touch and keys, in pixels                                        |
| `shell input text 'a%sb'`                                                              | typing (`%s` is a space)                                         |
| `exec-out screencap -p > shot.png`                                                     | a screenshot                                                     |
| `shell monkey -p com.tovmassian.escuadra -c android.intent.category.LAUNCHER 1`        | a launch                                                         |
| `shell am force-stop com.tovmassian.escuadra`                                          | a kill, so the next launch is cold                               |
| `shell am start -a android.intent.action.VIEW -d escuadra://… com.tovmassian.escuadra` | a deep link                                                      |
| `shell settings get system font_scale` · `shell wm density` · `shell wm size`          | the text and display size (read)                                 |
| `shell dumpsys package com.tovmassian.escuadra`                                        | the installed version (`versionName`, `versionCode`)             |

A dump sometimes comes back cut: parse it, and retry on an error. Tap a node at the middle
of its `bounds`, found by its text or `content-desc`, as on iOS.

## Playing rounds

A pass plays dozens of rounds. Script them:

- **An answer key** from the data: each member of the squad's file (`data/squads/…`) with
  its shirt number, joined to `data/players.json` for name, position, nationality and club.
  Build it from the checkout under test.
- **A plan** such as `CCWCCCCCWC`, one letter per question, right or wrong.
- **Each question:** read the shirt number from its label ("Shirt number 7",
  "Rückennummer 7", "Dorsal 7"…), find the answer tiles (buttons), tap the right name or
  another, and after a wrong answer tap Next. A distractor can come from outside the squad,
  so look up only the right answer. Wait for the next question's progress label before
  reading again.

Level 1 is the simplest to script: one tap per question.

## Looking at the results

- **Contact sheets:** paste a step's screenshots side by side, each labelled, and look at
  one image instead of ten. Shrink full-size shots first (`sips -Z 1000`).
- **Before and after a change at the default size:** `npm run shots`, then compare
  `design/screens/` with git. Only the screens you meant to change should differ.
- **Screen readers without ears:** the iOS accessibility list and Android's dump give each
  element's label and the swipe order. Where focus lands after a change, and how a label
  sounds, needs the owner's ears. Numbers spoken in the wrong language come from the phone's
  text-to-speech language, not the app.
- **Large text:** iOS's `DYNAMIC_TYPE` is the slider's step out of 11, from 0 for the
  smallest: 0.545 is XXXL, the largest without Larger Accessibility Sizes, and 1.0 the
  largest accessibility size. React Native scales text by up to 3.6× there; the caps are in
  `design-tokens`, Text size. Android's largest font is 1.3× on Android 12 and 2× from
  Android 14, and the display size scales everything on top.

## Usage statistics

Development builds and local APKs send **test** signals: TelemetryDeck shows them with Test
Mode on. On the Free plan they can take hours to appear, and the dashboard rolls them up by
hour, so identical signals in the same hour show as one row. To count them, open the
Playground's JSON Editor, in the owner's signed-in browser, with a query that has
`groupBy`, `eventCount`, the app ID, `baseFilters: "thisApp"` and `testMode: true`. To see
that a signal left the phone at all, look for its request and status in the device log
(`pymobiledevice3 syslog live`, CFNetwork's lines).

## Gotchas

- **A temporary data edit blocks commits and pushes.** The pre-commit hook regenerates the
  squad index and fails on an edited `data/index.json`; the pre-push hook runs
  `npm run check`, which does the same. Copy the edited files aside, `git checkout` them,
  commit and push, then copy them back. Metro serves the files on disk, so the phone sees
  each change at its next reload.
- **The dev client's floating gear covers part of the screen.** Hide it from the dev menu.
- **The tunnel and WebDriverAgent drop** when the phone reboots or leaves the cable or the
  network, and a locked screen isn't captured. Check WebDriverAgent with `GET /status`;
  restart the tunnel first, then WebDriverAgent.
- **In a worktree session,** commands that compute values at runtime and also name git are
  refused. Use literal paths, and put any logic in a script file in the scratchpad. Run
  Python with `-I`.
- **The web build behind `npm run shots` doesn't watch files** (`scripts/dev-server.mjs`
  starts Metro with `CI=1`). For a before and after, restart it with `-c` for each.
