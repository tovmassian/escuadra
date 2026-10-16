# Escuadra 2.0 redesign — handoff

> **Temporary. Delete this file when 2.0.0 ships (#116).** It carries forward what the build
> sessions decided and learned, which would otherwise live only in deleted scratch ledgers
> and PR descriptions.
>
> Spec: [`docs/superpowers/specs/2026-10-15-play-redesign-2-0-design.md`](../specs/2026-10-15-play-redesign-2-0-design.md).
> Plans: [`docs/superpowers/plans/`](../plans/) (the `2026-10-15-2-0-*` and `2026-10-16-2-0-*` files).
> Milestone: [v2.0.0](https://github.com/tovmassian/escuadra/milestone/5).

## Where it stands

| Issue | What                                                      | State                                                                                                                                    |
| ----- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| #111  | Tokens, Archivo, `textMuted` contrast                     | merged, [#118](https://github.com/tovmassian/escuadra/pull/118)                                                                          |
| #112  | 960 px photos, original size in `PhotoCredit`             | merged, [#119](https://github.com/tovmassian/escuadra/pull/119)                                                                          |
| #113  | The Spotlight question screen                             | merged: logic [#120](https://github.com/tovmassian/escuadra/pull/120), screen [#121](https://github.com/tovmassian/escuadra/pull/121)    |
| #114  | Results and sharing                                       | merged: Results [#123](https://github.com/tovmassian/escuadra/pull/123), sharing [#127](https://github.com/tovmassian/escuadra/pull/127) |
| #115  | Study                                                     | **Not started, by the owner's instruction (2026-10-16).** Its notes are below.                                                           |
| #116  | Docs pass, store assets, version, release branch          | Not started. Its notes are below.                                                                                                        |
| #117  | Android: bold Inter/Plex styles probably render in Roboto | Open. Found in #111's review; needs a device check.                                                                                      |

`main` now carries most of 2.0. Whichever release branch is cut from `main` next (the photo build, #60, or 2.0.0) ships it. #114 part 2 moved the fingerprint: it adds `react-native-view-shot` and `expo-sharing`. So none of 2.0 can reach a 1.x binary over the air.

## The owner's decisions (2026-10-16, #128)

Both questions touched the legal asset-licensing guardrail, so no session decided them.

1. **How photos are shown.** About said each photo is "shown cropped to fit, and otherwise unchanged", which was untrue once the screens shaded photos. The owner asked for the text to be adjusted. About now says:
   - photos are cropped to fit;
   - they are shaded where text sits over them and dimmed after a miss;
   - a photo too small to fill the screen sits whole over a darkened copy;
   - the files themselves are not edited.

   The credit line's change note stays "cropped".

2. **Crests in photos.** About now says Escuadra never shows crests itself, but a photo can show one, on a shirt or in the background. Those marks belong to their owners and imply no endorsement. `CLAUDE.md` guardrail 2 and `docs/license.md` say the same, and forbid cropping to, enlarging or isolating a crest.
3. **A new rule, `CLAUDE.md` guardrail 7.** A change that could make About untrue is flagged and fixed in the same PR: directly when the wording is plain, and after discussing it with the owner when it needs a judgement.

## Decisions taken on the owner's behalf

Each one has a cheap reversal.

**Delivery**

- #113 shipped as two PRs (logic, then screen) and #114 as two (Results, then sharing), so each keeps `main` working. #118, #120 and #121 already changed the About text (the Archivo credit; Vibration and the stored-data list; photo loading); the sharing PR carries the rest (the sharing paragraph and telemetry's `format` property).
- PRs were merged after CI passed, by the owner's standing authorisation (2026-10-15). Nothing was published: no OTA, no store build, no `gh-pages`.

**Design and tokens: deviations from the spec**

- **Archivo ExtraCondensed** is cut at `wdth=62.5`, not 62. That is the width STAT names, and fontTools needs it to give each cut its own PostScript name; otherwise iOS registers only the first cut.
- **No `fontWeight` on the new 2.0 Archivo or Inter-Bold styles.** On Android a runtime font plus a weight of 700 or more falls back to the system font (#117). Older styles (`screenTitle`, `badgeNumber` and others) keep theirs and are #117's to check; Results' photo-less circles use `badgeNumber`.
- **`stageGradients`** is its own token, not `gradients.stage`. The dark ground is solid at 0.68, where the stage ends, not 0.74; that removes a seam.
- **The hero carries its own ground** (`stage.heroBacking`). The number and chips stay legible over any photo, at any size. The window-fraction gradient alone measured 2–2.5:1 on short screens and bright shirts.
- **Light-theme text is darkened to pass AA** where the board's value fell short:
  - `nextText`, `stageSuccessText` and `successText` (small green text on Results): `#24702f`;
  - `chipPendingText` and `onStageMuted`: `#5f636a`.
  - The pass strike on Results uses `accentLine`, since `accent` is 2.27:1 on dark.
- **Auto-advance:** the bar fills over the same 1.2 s as the pause, with no 300 ms bar delay.
- **The round prefetch** lives in the screen, not `stores/session.ts`, so the store stays free of I/O.
- **Fill or frame** goes by the width Commons actually served. Four sub-960 originals come back as 500/250 px thumbnails.
- **`MOTION_TIME_SCALE`** is 1 (it was a 1.8 preview). `MOTION_DISTANCE_SCALE` stays 1.5.
- **No icon library.** The ×, the flame, share and retry are drawn from Views. The share sheet's Image/Text switch drops the board's two icons; the labels carry it.
- **The share picture is always dark** (`ShareCard` reads `palettes.dark`), as on the board, so it looks the same whichever theme it is shared from. CLAUDE.md guardrail 5 names the exception.
- **The share sheet stays open after a share.** Expo can't tell a sent picture from a cancelled one, and the other format is one tap away.
- **Image shares are counted when `shareAsync` resolves** (spec §10.3), so `result.shared` with `format: 'image'` counts share menus opened and closed, not pictures sent. Text shares are counted when the OS reports them sent, which iOS does honestly. On Android, React Native's `Share.share` reports every opened chooser as sent, so there both formats count menus opened.
- **The share picture is captured at its native size.** The off-screen copy is laid out at `1080 / PixelRatio` pt, and `captureRef` gets no `width` or `height`. Those options are points on iOS but raw pixels on Android, so spec §4.2's original snippet would have given about 411×731 px on Android. The spec snippet is corrected.
- **The captured PNG is released when the sheet closes** (`releaseShareImage`), so About's "does not … keep" holds. It is not released straight after `shareAsync`, because an Android target can read the file after the chooser returns.
- **About gives sharing its own "Sharing" heading.** Under "Player photos" it would read as being about photos.
- **The `expo-sharing` config plugin is left out.** `npx expo install` adds it, but it only sets up receiving shares (`withShareExtension`, off by default); outgoing shares need nothing in `app.json`.
- **`fontScaleCap.display` (1.2)** caps the shirt number and the prompt at large text sizes; the boxes use `minHeight` so they can grow.

**Data**

- Photo integrity accepts Commons' own answer for originals under 960 px.
- `enrich` was re-run live on 2026-10-15: 2,199 photos, 18 non-size changes, all listed in #119.

## Device checklist before the 2.0 store build

Web can't show any of this. It runs on simulators or devices.

- **Fit:** 360×640 Android, iPhone SE and iPhone 17, at every level and part, in both themes. On Results, a failed round's main button and "Photo credits" sit below the fold on the small phones; the spec requires no scrolling only on the question screen, so check that it reads well.
- **Largest text size:**
  - every answer is still reachable;
  - the question's top bar (fixed 52/32 pt) is a known residual;
  - Results' strip and card numbers are capped at 1.2×; check that the names and lines inside the fixed cards still read. From about 1.4× the card's line rises into the gradient's ramp, where `cardLine` drops under 4.5:1 on a white photo.
- **Accessibility:**
  - VoiceOver/TalkBack: the round never moves on by itself;
  - the progress bar reads "Question n of 10";
  - no slot or tile speaks an answer early.
- **Reduce Motion:** no shake, bounce, slide or scale anywhere, including Results' strike. The strike lands at once only because `EscuadraStrike` relies on Reanimated's default `ReduceMotion.System`.
- **Vibration off:** no haptic anywhere.
- **Android haptics:** the native constants on API ≥ 30/34, and the vibrator below.
- **Offline:** team colours everywhere (stage, cards, circles), and nothing errors.
- **Android:**
  - the shirt number's line height (119 at 152 pt) does not clip its digits; the same goes for Results' `scoreDisplay` (120 at 150 pt), `scoreTail` and `cardNumber`, and for the share picture's `shareScore` (160 at 200 pt), `shareScoreTail` (62 at 78) and `shareSquare` (26 at 26). The picture is where a clip would show. iPhones clip these too: see [#124](https://github.com/tovmassian/escuadra/issues/124), which covers the share tokens in a comment;
  - the bold Inter/Plex styles, for #117.
- **Results on native:**
  - the score sits on the "/10" baseline and the corner sits where the web capture puts it;
  - retry and "Play level n+1" do not flash the next round's empty state (red strip, grey corner) before Results unmounts. `startRound` resets the session while Results is still mounted; if it shows, snapshot `session.results` once on mount rather than reordering the calls.
- **Native motion:**
  - the rise and slide Keyframes (web only fades);
  - the framed-photo fade;
  - the streak chip's exit;
  - Results' card snapping (web ignores `snapToInterval`);
  - the circle pop;
  - the share sheet's scrim fade and slide up, with no overshoot.
- **Sharing (spec §13):**
  - "Share image" opens the share menu on both platforms with a 1,080×1,920 PNG. Check the file's size on a 2× iPhone and on an Android phone that isn't 3×, since those are where a scale mistake shows.
  - The picture is not blank. The captured card is a second copy laid out off screen (left of the window by twice its width), and `react-native-view-shot` does not document off-screen capture. If it comes out blank on iOS, try `captureRef`'s `useRenderInContext: true` first; the card has no images or gradients, so that suits it. Failing that, move the copy on screen under the sheet.
  - Its fonts are Archivo, Inter and Plex, not the system font, on Android (#117).
  - "Share text" is unchanged from 1.x.
  - Android back and a tap on the scrim close the sheet.
  - VoiceOver and TalkBack stay inside the sheet while it is open, and read the preview as one element.
  - A quick double tap on the button opens one menu, not two.
  - On a small phone or at large text, the sheet stops below the status bar and its body scrolls. The top-inset part of the cap can't be seen on web.
  - On Android, the × and the switch segments still take a tap at 44 pt. Their `hitSlop` reaches past their row, which Android may ignore.
  - The preview's shadow shows on iOS. It is a separate view from the clip, since iOS clips a view's own shadow.

## Notes for #115 (Study)

- **Reuse `components/PlayerCard.tsx`.**
  - It has no slot yet for the position chip (top right) or the "Tap to reveal" pill. Give it a `badge`/`overlay` prop.
  - Its root `accessible` would swallow a tappable child, so make the reveal pill its own accessible element.
  - Its label speaks the name, so Hide names needs a variant without it.
  - The line's colour is hard-wired to `cardLine` (`#ffa19e`, an error tint), so Study's club or nationality line would come out pink. Add a tone prop.
  - It builds `stageVeil` and a `StyleSheet` per render. That is fine in Results' virtualised list but a cost in a grid.
- **The About texts.**
  - The stored-on-device list becomes **eight** things with `studyView`, under spec §10 item 4.
  - The "Player photos" paragraph needs Study's clause: "…and a squad's photos on the Study screen as you scroll".
- **The missed view has no caller.** Nothing links to Study's `players`/`level` params any more, since Results no longer has "Study these N". Remove them, `parsePlayerIds`/`parseLevel` and `StudyRow`.
- **Contrast tests.** The tokens tests have composite checks (text over translucent backgrounds); add Study's new roles to them.

## Notes for #116 (release)

- **`privacy.html`** on `gh-pages` must match the About text word for word. It has changed in several PRs: the Archivo credit, photo loading, the stored-data list, Vibration, and #114 part 2's new "Sharing" section and telemetry sentence. Publish it when the first build containing that text reaches users.
- **Store declarations.** Re-confirm App Privacy and Data safety (#55). #114 part 2 added the `format` property to `result.shared`, in the category already declared (App Privacy "Product Interaction", Data safety "App interactions"). No change is expected, but re-confirm it.
- **CLAUDE.md guardrail 1** describes the question screen's photo only. Extend it to Results' cards (credits behind the "Photo credits · N" toggle) and Study.
- **Store assets.** Regenerate `npm run shots:store`, `shots:play` and `gen:play-assets` for the 2.0 listing. Set CLAUDE.md "Current state" to 2.0.
- **The release itself.**
  - Bump `app.json` to 2.0.0 by PR, then cut `release/2.0.0` (`docs/release.md`).
  - Ask the owner before any store build (EAS Free quota).
  - Decide the order relative to #60's photo build.
- **Delete this file.**

## Known gaps worth a follow-up

None of these blocks 2.0.

- **Photos:**
  - Three photos with originals of at least 720 px are served at a 500 px step and are framed. Storing the unscaled original would sharpen them.
- **The question screen:**
  - The top bar's fixed heights at the largest text sizes.
  - The tile has no vertical padding for a grown two-line label.
  - iOS gets no spoken verdict (`announceForAccessibility`).
- **Contrast:**
  - Dark `textMuted` is 4.30:1 on `surfaceRaised`; no screen puts it there today.
  - Small "cleared" text in `success` on the picker and difficulty rows is 3.83:1 in light: [#122](https://github.com/tovmassian/escuadra/issues/122).
- **Results:**
  - On a 10/10, the actions rise before the last circles finish (spec §6 says "last").
  - `resultCopy` hard-codes level 3 as the last level rather than taking `hasNextLevel`.
- **Sharing:**
  - Closing the sheet during the brief capture (about 100–300 ms) leaves that one PNG in the cache until the next image share or the OS clears it.
  - When a device can't share a file (`Sharing.isAvailableAsync()` is false), "Share image" does nothing and says nothing.
  - The sheet has no exit animation. Spec §6 times only its entry.
- **Telemetry (pre-existing on `main`):**
  - Retry and "Play level n+1" never emit `round.started`. Results calls `startRound`, and the question screen's guard then skips its own call.
- **Unused tokens:**
  - `opacity.dimmed` (only `VerdictGlyph` uses it).
- **Docs and fonts:**
  - The Archivo credit line on About sits below the captured viewport, so `design/screens` never shows it.
  - The static Archivo cuts keep a small `STAT` table.

## Process notes

- `gh issue develop` links a branch to its issue, and merging that branch's PR **closes the issue**. #113 had to be reopened after part 1. Later parts used unlinked branches with "Part of #N" or "Closes #N" in the PR body.
- Each PR description has a "Decisions to check" section: #118, #119, #120 and #121 hold the full rationale for each merged step.
- Reviews ran per task, and then once over the whole branch: on Opus for #111–#113, on Sonnet for #114 because Opus hit its weekly limit (it resets 2026-10-19). **A deeper Opus review of #114 is owed before the 2.0 store build.** The findings and their fixes are in each PR's commits (`fix(…): final-review fixes …`).
