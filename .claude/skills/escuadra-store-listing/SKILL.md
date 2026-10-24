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

| The owner asks to…                                               | Mode              | Where                                         |
| ---------------------------------------------------------------- | ----------------- | --------------------------------------------- |
| draft the listing for X.Y.Z, write What's new, change a field    | Draft             | `main`, after the cut (step 4)                |
| change the listing between versions, e.g. a tournament promotion | Draft, no version | `main`                                        |
| enter, paste or submit the listing for X.Y.Z                     | Ship              | `release/X.Y.Z`, after `store-build` (step 7) |

## Draft mode

1. **Read what changed.**

   ```bash
   v=$(node -p "require('./app.json').expo.version")
   awk "/^## \[$v\]/{f=1;next} /^## \[/{f=0} f" CHANGELOG.md
   gh pr list --state merged --search "milestone:v$v" --json number,title --limit 200
   git tag --list 'v*'          # the baseline t: the highest at or below $v
   ```

   Read the five `store/listing/<lang>.md`, `store/screenshots.json` and
   `store/declarations.md`. With a baseline `t`, look at what moved since it:
   `git diff "$t" -- lib/telemetryEvents.ts` and the `about` block of
   `git diff "$t" -- i18n/en.ts` (what leaves the device), the `@telemetrydeck/sdk` and
   `expo-updates` lines of `git diff "$t" -- package.json`, and
   `git diff --stat "$t" -- design/screens/ app/store/ i18n/` for the listed shots. A
   change there means the images are entered again: the bundle marks them _paste_ when the
   listed shots, the feature graphic route or any catalog changed since the tag.

2. **Ask the owner, one question at a time**, with AskUserQuestion: a draft, the
   CHANGELOG line it comes from, your recommendation first, and what each option changes.
   In this order:
   1. What's new, for a version: English, at most 500 characters, from the section's
      user-facing lines, without PR numbers.
   2. Each other field: keep it, or an edit for a named CHANGELOG line. Most versions keep
      them.
   3. The screenshot set: keep it, or swap in a screen the version added
      (`design/SCREENS.md` says what each capture shows; at most 8).
   4. The declarations, only when step 1 shows that what leaves the device changed. The PR
      that changed it should have updated `store/declarations.md`
      (`.claude/rules/privacy-telemetry.md`); say so if it did not, and draft the change
      from About's text. What an answer means is the owner's (guardrail 7).

3. **Write the English** into `store/listing/en.md`, then
   `npx vitest run scripts/__tests__/store-listing.test.ts`.

4. **Translate the changed fields** into `es.md`, `fr.md`, `it.md` and `de.md`:
   - a screen or control the text names is that catalog's label for it
     (`i18n/<lang>.ts`), so the listing says what the app shows;
   - the catalog's form of address, and France's usage for French;
   - _Escuadra_ and _a la escuadra_ stay as they are.

5. **Run the language-expert loop.** For each language, dispatch a fresh subagent as a
   native-speaker app-store editor. Give it each changed field's English and translation,
   the limits, the catalog labels the text names and the fixed terms, and ask it to
   back-translate and report only what would block publication. Apply wording findings;
   bring meaning findings to the owner. Dispatch a fresh one until it returns "No
   findings": at most five rounds, then a final check scoped to what changed.

6. **Write the review sheets:** `node scripts/store-bundle.ts --review` writes
   `dist/store-listing/review/<lang>.md`, changed fields only. The owner sends them to
   the native reviewers (#145). The PR merges only after all four sign off.

7. **Open the PR.** `npm run check`, then a PR into `main` titled
   `docs(store): the X.Y.Z listing (#N)`, N being the issue the listing work runs under,
   recording each reviewer and date in its body.
   Once it is merged, pick it to the branch and open that PR into `release/X.Y.Z`:

   ```bash
   git switch -c pick/listing-X.Y.Z origin/release/X.Y.Z
   git cherry-pick -x <squash commit>
   ```

   `release-gate` checks the pick's fingerprint, as it does every PR; a listing pick passes,
   because nothing under `store/` or `i18n/` feeds the fingerprint.

### The first run

When `store/listing/` does not exist yet (2.0.0, #147), seed `en.md` before drafting.
The public App Store page (https://apps.apple.com/us/app/escuadra/id6810705505) shows the
live subtitle and description; ask the owner to paste the keywords and promotional text
from App Store Connect. Use the six headings `FIELDS` in `scripts/store-listing.ts` gives,
under `# English`; each translation's title is its language's name in itself
(`LANGUAGE_NAMES` in `i18n/names.ts`). Confirm or change the proposed
`store/screenshots.json` with the owner. The first run also translates the feature
graphic's tagline, `store.tagline` in `i18n/es.ts`, `fr.ts`, `it.ts` and `de.ts` (they hold
`store: en.store` until then), drops `'store.'` from each language's deferred list in
`i18n/leaves.ts`, and runs its translations through the same expert loop. Add each one,
with the English, at the end of that language's review sheet
(`dist/store-listing/review/<lang>.md`) under `## Feature graphic tagline`, so the reviewer
signs it off with the listing. It rides in the same PR and pick. Every field is new, so
every field is drafted, translated, reviewed and entered.

### Between versions

An off-cycle change, such as promotional text for a tournament, has no version: skip step 1's
CHANGELOG section and milestone and step 2's What's new, and ask only which fields change. On
the App Store only Promotional text can change between versions; any other App Store field
waits for the next version, whose sheet marks it _paste_ again. Steps 3–6 run as above (the
review sheets compare with the live version's tag). Title the PR
`docs(store): <the change> in the listing (#N)` and pick nothing. Once it is merged, run
`node scripts/store-bundle.ts` on `main`: its sheet holds text only, with no images and no
What's new, and you walk it with the owner as in ship mode, step 3.

## Ship mode

Only after `store-build` has run on the branch (step 6). Never trigger it.

1. From a clean checkout of `release/X.Y.Z`: `npm ci`, then `node scripts/store-bundle.ts`.
   Run it before the owner tags `vX.Y.Z` (step 8), once the captures are in: when the tag
   exists it becomes the baseline, so a re-run marks everything _skip_ and empties
   `dist/store-listing/app-store/` and `play/`, leaving step 4 nothing to attach.
2. If it stops, naming missing captures, capture every language and run it again:

   ```bash
   for code in en es fr it de; do npm run shots:store -- --lang=$code && npm run shots:play -- --lang=$code && npm run gen:play-assets -- --lang=$code || break; done
   ```

   Look at a few captures in each language before going on: they are web renders, so a
   layout that breaks only in one language shows here first.

3. Walk `dist/store-listing/paste-sheet.md` with the owner, one store at a time, ticking
   what they confirm entered. Apple's fields and App Privacy go in before Submit for
   Review; Play's listing, release notes and Data safety when the build is uploaded; each
   store's privacy URL together with its answers.
4. After the owner tags `vX.Y.Z` (step 8), and only when the sheet marked the images
   _paste_, offer to attach them to its GitHub Release, and do it on the owner's OK:

   ```bash
   (cd dist/store-listing && zip -qr app-store.zip app-store && zip -qr play.zip play)
   gh release upload vX.Y.Z dist/store-listing/app-store.zip dist/store-listing/play.zip
   ```

## Never

- Trigger `store-build` or any EAS build: each spends the Free plan's quota, and it is the
  owner's call.
- Decide what a declaration means, or merge a translation without its native reviewer's
  sign-off.
- Enter anything in a console: the owner does, from the sheet.
- Push `gh-pages`, or upload to a GitHub Release, without the owner's OK.
- Translate _Escuadra_ or _a la escuadra_, or call the product anything else (guardrail 6).
