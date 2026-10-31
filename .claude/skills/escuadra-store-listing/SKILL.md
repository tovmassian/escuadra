---
name: escuadra-store-listing
description: "Use when drafting, translating, reviewing or entering Escuadra's App Store or Google Play listing: a version's What's new, the subtitle, description, keywords or promotional text, the listing screenshots or feature graphic, the App Privacy and Data safety answers in store/declarations.md, or the paste sheet at release. Also when a release issue asks for its store listing. Not for About or the privacy pages themselves."
---

# Escuadra store listing

Escuadra's App Store and Google Play listings live in `store/` and reach the consoles by
hand, from a paste sheet. This skill drafts a version's listing with the owner (draft
mode) and walks the owner through entering it (ship mode). First Read
`.claude/rules/store-listing.md` (with Read, so it loads) and `docs/release.md`, Cut a
release: this file says what to do and in what order, they say how each piece works.

## The chain

Every version's listing takes this path, numbered as `docs/release.md`'s Cut a release.
Steps 4 and 7, and the images in 8, are this skill's.

```
main                           release/X.Y.Z                  GitHub, the stores
1 app.json -> X.Y.Z (PR)
2 cut ------------------------> branch = copy of main
3 CHANGELOG [X.Y.Z] ---pick---> CHANGELOG [X.Y.Z]
4 listing PR (draft) --pick---> store/listing/*.md
                               5 privacy pages, if data changed
                               6 store-build ---------------> binaries uploaded
                               7 bundle (ship) -------------> paste sheet; owner enters it
                               8 submit, tag vX.Y.Z ---------> GitHub Release + images
```

- The text is written on `main` and picked to the release branch, like docs.
- The images are captured on the release branch, because they show the code that ships.
- The paste sheet compares with the listing that is live: the highest `vX.Y.Z` tag at or
  below `app.json`'s version. With no tag yet, everything is entered. Step 8's tag is the
  next version's baseline.

## Which mode

| The owner asks to…                                                                         | Mode              | Where                                                                        |
| ------------------------------------------------------------------------------------------ | ----------------- | ---------------------------------------------------------------------------- |
| draft the listing for X.Y.Z, write What's new, change a field                              | Draft             | `main`, after the cut and the CHANGELOG section (steps 2–3; this is step 4)  |
| draft the What's new for a fix release X.Y.Z (a runtime-changing fix to a shipped version) | Draft             | a branch from `release/X.Y.Z`, PR into it; `pick-to-main` takes it to `main` |
| change the listing between versions, e.g. a tournament promotion                           | Draft, no version | `main`                                                                       |
| enter, paste or submit the listing for X.Y.Z                                               | Ship              | `release/X.Y.Z`, after `store-build` (step 6); this is step 7                |

## Draft mode

1. **Read what changed.**

   ```bash
   v=$(node -p "require('./app.json').expo.version")
   awk "/^## \[$v\]/{f=1;next} /^## \[/{f=0} f" CHANGELOG.md
   gh pr list --state merged --search "milestone:v$v" --json number,title --limit 200
   git fetch --tags --quiet && git tag --list 'v*' --sort=-v:refname   # newest first
   t=<the first tag at or below $v, or none>   # the baseline
   ```

   Read the five `store/listing/<lang>.md`, `store/screenshots.json`,
   `store/declarations.md` and `store/app-review-notes.txt`. With a baseline `t`, look at
   what moved since it: `git diff "$t" -- lib/telemetryEvents.ts` and the `about` block of
   `git diff "$t" -- i18n/en.ts` (what leaves the device), the `@telemetrydeck/sdk` and
   `expo-updates` lines of `git diff "$t" -- package.json`, and
   `git diff --stat "$t" -- store/screenshots.json design/screens/ app/store/ i18n/`
   for the images. The bundle marks them _paste_ when `store/screenshots.json`, a listed
   shot, `app/store/feature-graphic.tsx` or anything under `i18n/` changed since the tag,
   so a change to one of those means the images are entered again.

2. **Ask the owner, one question at a time**, with AskUserQuestion: a draft, the
   CHANGELOG line it comes from, your recommendation first, and what each option changes.
   In this order:
   1. What's new, for a version: English, at most 500 characters, from the section's
      user-facing lines, without PR numbers.
   2. Each other field, and the feature graphic's tagline (`store.tagline` in
      `i18n/en.ts`): keep it, or an edit for a named CHANGELOG line. Most versions keep
      them.
   3. The screenshot set: keep it, or swap in a screen the version added
      (`design/SCREENS.md` says what each capture shows; at most 8). To show a different
      team, player or state, restage the listed capture in place in
      `scripts/capture-screens.mjs`: another seed (find one with `buildRound` in a
      throwaway test), or other seeded progress. Then run `npm run shots`, commit only
      the restaged PNGs (the rest move by a few pixels of noise) and update
      `design/SCREENS.md`. Settle the set before Play's submission: a change made
      after the submission reaches Play only as a listing edit, once the release is
      approved.
   4. The declarations and `store/app-review-notes.txt`, only when step 1 shows that what
      leaves the device or how the app is used changed. The PR that changed what leaves
      the device should have updated both (`.claude/rules/privacy-telemetry.md`); a PR
      that changed how the app is used, which the CHANGELOG section shows, should have
      updated the notes (`.claude/rules/store-listing.md`). Say so if the PR did not.
      Draft a declarations change from About's text and a notes change from the
      CHANGELOG section. What a declaration means is the owner's (guardrail 7).

3. **Write the English** into `store/listing/en.md`, then
   `npx vitest run scripts/__tests__/store-listing.test.ts`.

4. **Translate the changed fields** into `es.md`, `fr.md`, `it.md` and `de.md`:
   - a screen or control the text names is that catalog's label for it
     (`i18n/<lang>.ts`), so the listing says what the app shows;
   - when the tagline changed, `store.tagline` in each `i18n/<lang>.ts` too;
   - the catalog's form of address, and France's usage for French;
   - _Escuadra_ and _a la escuadra_ stay as they are.

5. **Run the language-expert loop.** For each language, dispatch a fresh subagent as a
   native-speaker app-store editor. Give it each changed field's English and translation,
   the limits, the catalog labels the text names and the fixed terms, and ask it to
   back-translate and report only what would block publication. Apply wording findings;
   bring meaning findings to the owner. Dispatch a fresh one until it returns "No
   findings", at most five rounds; if the fifth still finds something, apply it and run
   one last check of only what that round changed.

6. **Write the review sheets:** `node scripts/store-bundle.ts --review` writes
   `dist/store-listing/review/<lang>.md`, changed fields only. The owner sends them to
   the native reviewers (#145). The PR merges only after every language with a review
   sheet is signed off. When the tagline changed, after the last `--review` run (it
   rewrites the sheets) append to each language's sheet, creating it if none was written,
   a `## Feature graphic tagline` section with the English and that language's
   `store.tagline`.

7. **Open the PR.** `npm run check`, then a PR into `main` titled
   `docs(store): the X.Y.Z listing (#N)`, N being the issue the listing work runs under,
   recording each reviewer and date in its body.
   Once it is merged, pick it to the branch and open that PR into `release/X.Y.Z`:

   ```bash
   git switch -c pick/listing-X.Y.Z origin/release/X.Y.Z
   git cherry-pick -x <squash commit>
   ```

   `release-gate` checks the pick's fingerprint, as it does every PR; a listing pick passes,
   because nothing under `store/` or `i18n/` feeds the fingerprint. For a fix release, the
   PR goes into `release/X.Y.Z` instead, from a branch cut from it, and `pick-to-main`
   opens its pick to `main`.

### Between versions

An off-cycle change, such as promotional text for a tournament, has no version: skip step 1's
CHANGELOG section and milestone and step 2's What's new, and ask only which fields change. On
the App Store only Promotional text can change between versions; any other App Store field
waits for the next version, whose sheet marks it _paste_ again. Steps 3–6 run as above (the
review sheets compare with the live version's tag). Title the PR
`docs(store): <the change> in the listing (#N)` and pick nothing. Once it is merged, run
`node scripts/store-bundle.ts` on `main`: its sheet holds text only: no images and no
declarations, which must match the binary and so come from a release branch. Walk it with the owner, who enters only Promotional text in App Store Connect and
the Play listing fields in Play Console (Play reviews a listing edit without a release).
Make the change before the next version's `app.json` bump lands on `main`: after it, the
sheet and the review sheets also show What's new and that version's edits, so the owner
enters, and the reviewers review, only the field this change edits.

## Ship mode

Only after `store-build` has run on the branch (step 6). Never trigger `store-build`
yourself.

1. From a checkout of `release/X.Y.Z` with no uncommitted changes: `npm ci`, then
   `node scripts/store-bundle.ts`. Run it before the owner tags `vX.Y.Z` (step 8): when
   the tag exists it becomes the baseline, so a re-run marks everything _skip_ and empties
   `dist/store-listing/app-store/` and `play/`, leaving this mode's step 6 nothing to
   attach.
2. If the first run marks the images _paste_, or stops for missing captures, capture
   every language once with the loop the stop message prints (also in `docs/release.md`,
   step 7), then run the bundle again; the second run copies the fresh captures. The
   captures are gitignored, so ones left from an earlier run would otherwise be handed
   over. The loop shoots every screen in both themes, about an hour for five languages:
   run it in the background. Then look at every listed shot in every language and both
   stores (`design/store/<code>/`, `design/play/<code>/`), with each language's shots side
   by side on one sheet: a page of `<img>` tags, opened in Playwright and screenshotted,
   gives one. Retake the affected language (and store), then bundle again, when a shot
   has caught Metro's "Bundling…" toast or shows the team's colours where the other languages
   show a player photo (usually because Wikimedia did not answer in time). The captures
   are web renders, so a layout that breaks only in one language shows here first.
   Captures taken from a local checkout before the PR that picks a change into
   `release/X.Y.Z` has merged stay valid only if the merged branch holds the same files:
   compare the output of `git rev-parse HEAD^{tree}` on that checkout with that of
   `git rev-parse origin/release/X.Y.Z^{tree}` after the merge.
3. Before the walk, check both freezes (`gh issue list --label ota-freeze`). `store-build`
   opened them, but a freeze closed to send an update to the test installs must be
   reopened (`gh issue reopen <number>`) before that store's submission, either before
   the walk or at any later point in the walk. `docs/release.md`, Freeze during store
   review, also has the command that creates one.
4. Walk `dist/store-listing/paste-sheet.md` with the owner, one store at a time, noting in
   the conversation what they confirm entered. The submit, send-for-review and publish
   buttons are the owner's. A language entered for the first time also needs, in App
   Store Connect, its Name (_Escuadra_), Privacy Policy URL and Support URL, and in Play
   Console its App name (_Escuadra_): take them from `store/declarations.md`.

   **Play Console**, when the build is uploaded:
   1. Each language's listing: short and full description, screenshots, feature graphic;
      the app icon in the default listing.
   2. App content, from `store/declarations.md`: Data safety, the privacy URL, target
      audience, the AI asset answer.
   3. The production release: promote the internal-track build and paste the release
      notes, every language in one box.
   4. Publishing overview: the owner sends the changes for review. With managed
      publishing nothing goes live until the owner publishes after approval. A change
      sent while the review runs can push the app to the back of the queue, so a late
      listing change waits for the approval and goes in as a listing edit.

   **App Store Connect**, before Submit for Review:
   1. The new version (Distribution, + beside iOS App), with the build from `store-build`.
   2. App Information, per language: Name and Subtitle.
   3. The version page, per language: Promotional Text, Description, Keywords, What's New,
      Support URL, and the screenshots. Apple requires the iPhone "Dynamic Island (medium)"
      size (1206 × 2622) but scales the "large" size down to it, and the captures are the
      large size (1320 × 2868). So in the media manager's large slot, delete the shots
      carried over from the last version and upload the whole set (`01` onwards, at most
      8). An uploaded shot shows a cloud icon while Apple processes it, for a few
      minutes. The media manager's "iPhone Duo" slot, for Apple's two-display iPhone, and
      the version page's header component are optional.
   4. The version page, once per version (not per language): App Review Information's
      notes, which App Store Connect carries over from the last version. Replace them with
      `store/app-review-notes.txt` when there is no baseline tag, or when
      `git diff "$t" -- store/app-review-notes.txt` shows a change (set `t` as in draft
      mode's step 1); the paste sheet does not cover them. Leave "Sign-in required"
      unticked (the app has no accounts). Version Release is the owner's pick (the
      automatic option goes live on approval).
   5. The age rating: Apple's questionnaire keeps its answers, so it is checked against
      `store/declarations.md`, not refilled.
   6. App Privacy, last before submitting: the privacy URL per language, then the data
      types, published with the page's own Publish button before the submission
      (`store/declarations.md` says why).

   Do not publish Accessibility Nutrition Labels before the submission. If the owner
   declares any, publish them only once the version is live, since they go live on the
   product page as soon as they are published.

5. After each approval, close that store's freeze. On Play, with managed publishing, the
   owner then publishes, and enters any listing edit held during the review.
6. After the owner has tagged `vX.Y.Z` and published its GitHub Release (step 8), and
   only when the sheet marked the images _paste_, offer to attach them to its GitHub
   Release, and do it on the owner's OK:

   ```bash
   (cd dist/store-listing && rm -f app-store.zip play.zip && zip -qr app-store.zip app-store && zip -qr play.zip play)
   gh release upload vX.Y.Z dist/store-listing/app-store.zip dist/store-listing/play.zip
   ```

## Never

- Trigger `store-build` or any EAS build: each spends the Free plan's quota, and it is the
  owner's call.
- Decide what a declaration means, or merge a translation without its native reviewer's
  sign-off.
- Enter anything in a console unless the owner, watching, asks you to do that step. The
  owner enters the rest from the sheet, and always presses submit, send for review and
  publish.
- Push `gh-pages`, or upload to a GitHub Release, without the owner's OK.
- Translate _Escuadra_ or _a la escuadra_, or call the product anything else (guardrail 6).
