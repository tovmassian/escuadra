# Store listings as files, drafted with a skill, pasted from a sheet

## Goal

Each store build needs its App Store and Google Play listings in five languages: text,
screenshots, a feature graphic, and the App Privacy and Data safety answers. Today the
text lives only in the consoles, nothing chooses which of the ~40 captures go in the
listing, the feature graphic is English only, and each release issue (#55, #116, #147)
writes its console checklist out again by hand.

This design makes the repo the source of the listing, checks it in `npm run check`, lets
a skill draft each version's changes with the owner, and turns it into a paste sheet and
per-locale image folders at release. This design's implementation is the tooling; its
first use, writing the 2.0.0 listing, is #147's work. Pushing to the consoles through
their APIs is a later issue that reuses the same files.

## Decisions

Owner, 2026-10-24:

- **Phased automation.** Paste by hand from a generated sheet now; a push from CI later,
  as its own issue.
- **The LLM part is a local skill**, `escuadra-store-listing`, run in a Claude Code
  session. No LLM runs in CI.
- **One Markdown file per language**, both stores in it.
- **Raw screenshots, a curated set**, the same for both stores. No captions or frames.
- **One English `store/declarations.md`** for what is entered once per app: the name,
  category, age rating, URLs, and the App Privacy and Data safety answers.
- **One Description for both stores, and one What's new written to Play's 500.**
  Splitting either later is one more heading.
- **One store locale per language.** Regional variants (es-MX or es-419, fr-CA, en-GB)
  stay empty; adding one is a line in the locale map.
- **The paste baseline is found from the tags**, with no flag (see
  [Changed since the last version](#changed-since-the-last-version)).

Owner, 2026-10-24, after the final review:

- **The listing shots may show Commons player photos** (guardrail 2's asset licensing):
  the proposed set stays, and `docs/license.md` records what that leaves uncovered.
- **Each App Store locale links its own language's privacy page**; Play, which takes one
  URL per app, links the English one.
- **The declarations:** the EAS Update installation ID joins the Device ID answer;
  Data safety states, per data type, whether collection is optional or required; the
  requests' technical details are listed as not declared, with why.
- **The capture scripts refuse a port another server holds**, so no capture shoots
  another worktree's code.

## Files

```
store/
  listing/en.md es.md fr.md it.md de.md   the words, one file per language
  screenshots.json                        the ordered listing set, capture base names
  declarations.md                         English, entered once per app
scripts/store-listing.ts                  pure: parse, check, compare, render the sheet
scripts/store-bundle.ts                   thin CLI: copy images, write the sheet
scripts/__tests__/store-listing.test.ts   runs in npm run check
.claude/skills/escuadra-store-listing/SKILL.md
.claude/rules/store-listing.md
```

The Markdown holds only words people review. The locale map is a constant in
`scripts/store-listing.ts`:

| Language | App Store Connect | Play Console |
| -------- | ----------------- | ------------ |
| en       | en-US             | en-US        |
| es       | es-ES             | es-ES        |
| fr       | fr-FR             | fr-FR        |
| it       | it                | it-IT        |
| de       | de-DE             | de-DE        |

`scripts/store-listing.ts` imports nothing from `i18n/`, so plain Node 24 runs it and
`store-bundle.ts`; the test, under Vitest, checks the map's keys against
`SUPPORTED_LANGUAGES`. No npm script is added: one would move the fingerprint
(`fingerprint.config.js` sets no `sourceSkips`) and could not be added after a cut. The
feature graphic's tagline stays in the catalogs (`store.tagline`), because the graphic is
a rendered route that reads `useT()`.

## A listing file

```markdown
# English

## Subtitle (App Store, 30)

Learn every football squad

## Promotional text (App Store, 170)

…

## Keywords (App Store, 100)

football,squad,quiz,…

## Short description (Google Play, 80)

…

## Description (both, 4000)

…

## What's new (both, 500)

…
```

- Each `##` heading opens a field; its body runs to the next heading, trimmed.
- The body is pasted as written. The consoles take plain text, so a bullet is a typed
  character and Markdown formatting is not used. Prettier skips `store/listing/`, so a
  reformat never changes what is pasted.
- Limits count characters (Unicode code points). The console's own counter is the final
  word, so a field written to the brim is worth a look there.
- The App Store name and the Play title are _Escuadra_, never translated, so they live in
  `declarations.md`, not here.

## Checks

`scripts/__tests__/store-listing.test.ts` fails when:

- a language file's headings are not exactly the field list in `scripts/store-listing.ts`,
  in order, limits included, or a field is empty;
- a field runs over its limit;
- a translated field equals the English one (left in English, as `catalogs.test.ts`
  checks the catalogs);
- an English field contains _Escuadra_ or _a la escuadra_ and its translation does not;
- a stale product name appears: "Squad Trainer", "Squad Game" and the like (guardrail 6);
  category words such as "football squad quiz" pass;
- keywords repeat, or have spaces around their commas;
- `store/screenshots.json` lists more than 8 shots (Play's cap; Apple's is 10) or repeats
  one;
- a privacy policy URL in `declarations.md` is not `pageUrl` from
  `scripts/privacy-pages.ts` (each App Store locale its own language's page, Play the
  English one), so a new policy folder cannot leave a declared URL behind.

## The bundle

Run from a checkout of the release branch after `store-build`:

1. Capture each language, when the images changed:
   `npm run shots:store -- --lang=<code>`, `npm run shots:play -- --lang=<code>` and
   `npm run gen:play-assets -- --lang=<code>`. `--lang` on `gen:play-assets` is new: it
   seeds `languagePreference` and checks it took as `capture-screens.mjs` does, and writes
   `design/play/<code>/feature-graphic.jpg`. The icon stays one file.
2. `node scripts/store-bundle.ts` writes `dist/store-listing/` (`dist/` is already
   ignored, so no `.gitignore` line):
   - `app-store/<locale>/01.png…` and `play/<locale>/01.jpg…`, the listed shots in order,
     plus each language's feature graphic and the icon for Play;
   - `paste-sheet.md`: store, then locale, then field, the order the consoles take them.
     Each _paste_ field is a fenced block (VS Code's preview and GitHub give each a copy
     button) with its character count; a _skip_ field is one line. Play's release notes
     are one block for all five languages, in the `<en-US>…</en-US>` form its single box
     takes. The images are marked the same way, and the declarations follow when they
     changed.
   - Images are handled only on a `release/X.Y.Z` checkout, because they must show the
     code that ships. Run elsewhere (an off-cycle edit on `main`), the sheet holds text
     and declarations only.
   - When the images are _paste_, it stops on a listed image that is missing for any
     language, naming the file and the command that makes it. When they are _skip_, it
     copies none.
3. Zip `app-store/` and `play/` and attach them to the version's GitHub Release, as Cut a
   release does with the store assets today.

### Changed since the last version

The baseline is the highest `v*` tag at or below `app.json`'s version, found by name: the
version whose listing is live. While X.Y.Z is prepared it is the previous version's tag;
for an off-cycle edit on `main`, whose `app.json` still names the live version, it is that
version's own. A version tag sits on a commit of its release branch, which `main` and the
next release branch hold only as cherry-picked copies, so walking the history would never
reach it. With no such tag, everything is _paste_.

- **A text field** is _skip_ when it equals the same field in
  `git show <tag>:store/listing/<lang>.md`. A translation's field is also _paste_ when its
  English changed, so a translation left behind reaches the reviewer and the sheet.
- **What's new** belongs to a version, not to the listing: it is _paste_ for every new
  version, even if its text repeats, and _skip_ for an off-cycle edit, which has no
  version to carry it.
- **The images** are _skip_ when `store/screenshots.json`, the listed shots in
  `design/screens/` (committed, and deterministic), `app/store/feature-graphic.tsx` and
  the catalogs in `i18n/` all equal the tag's. Any catalog change marks them _paste_, so a
  translated screen or tagline is never left stale; the cost is a recapture a version did
  not strictly need.
- **The declarations** are _skip_ when `store/declarations.md` equals the tag's. Like the
  images, they appear only on a `release/X.Y.Z` checkout's sheet: `main`'s file can run
  ahead of the live binary, and the declarations must match the binary (guardrail 4).

An off-cycle paste between versions shows as _paste_ again at the next version, which
costs a repeated paste and nothing else.

## The skill

`escuadra-store-listing`, one `SKILL.md` that points at the rule and `docs/release.md`
rather than repeating them. Two modes.

**Draft**, on `main`, after a cut or for an off-cycle edit:

1. Gather the version's `CHANGELOG.md` section, its milestone's merged PRs, the five
   listing files and the baseline (the same function the bundle uses). Since the baseline,
   check whether `en.about.privacy`, `TELEMETRY_EVENTS` or the SDKs About describes
   (`@telemetrydeck/sdk`, `expo-updates`) changed, and whether the listed shots did.
2. Walk the owner through it, one question at a time, each with a draft and a
   recommendation: What's new (always, for a version, from the changelog's user-facing
   lines); each other field, kept or edited for a named changelog line; the screenshot
   set; the declarations, only when the evidence says what leaves the device changed.
   Their meaning is the owner's (guardrail 7).
3. Translate the changed fields only. A screen or control the text names uses that
   catalog's own label; French follows France usage; _Escuadra_ and _a la escuadra_ are
   never translated.
4. Run a fresh native-language expert subagent per language until it returns "No
   findings". Wording findings are applied; meaning findings go to the owner.
5. Write one review sheet per language (English, translation, limit; changed fields
   only) with `node scripts/store-bundle.ts --review`, into `dist/store-listing/review/`,
   for the native reviewers of #145. Their sign-off is the gate and is recorded in the PR
   body.
6. Run `npm run check`, open the PR into `main`, and once it is merged, pick it to the
   release branch. `release-gate` checks the pick's fingerprint, as it does every PR; a
   listing pick passes, because nothing under `store/` or `i18n/` feeds the fingerprint
   (the tooling issue measures this).

**Ship**, on the release branch, after `store-build`:

1. Capture the five languages when the images changed, then run the bundle.
2. Walk the paste sheet with the owner one store at a time. The declarations and the
   privacy URL go in at their moments: Apple before Submit for Review, Play when the
   build is uploaded.
3. After the tag, attach the zips to the GitHub Release.

It never triggers `store-build` (EAS quota), decides what a declaration means, skips a
native sign-off or pushes `gh-pages` on its own.

## The release flow

The diagram numbers its own steps, not Cut a release's. Its steps 1–3 and 5–9 are in
`docs/release.md` today; this design adds 4, the bundle in 6 and the zips in 7.

```
main                           release/2.0.0                  GitHub, the stores
-----------------------------  -----------------------------  ------------------------
1 app.json -> 2.0.0 (PR)
2 cut ------------------------> branch = copy of main
3 CHANGELOG [2.0.0] ---pick---> CHANGELOG [2.0.0]
4 listing PR (skill) --pick---> store/listing/*.md
                               5 store-build ---------------> binaries uploaded
                                 (branch now locked)
                               6 captures + bundle ---------> paste sheet; owner pastes
                               7 tag v2.0.0 on the ---------> GitHub Release v2.0.0:
                                 built commit                   notes = CHANGELOG [2.0.0]
                                                                files = store zips
                               8 OTA fix (PR) --------------> devices
9 the fix, picked <------------- pick-to-main
  + its CHANGELOG line
```

### 2.0.0, the first run

1. The tooling lands on `main` before the cut: the module, CLI and test, `--lang` on
   `gen:play-assets`, the skill, the rule and the docs. It also writes
   `store/declarations.md` from #55's agreed answers, the consoles' category and age
   rating, and the support and `privacy/2/` URLs, all already decided, and proposes
   `store/screenshots.json`. If the cut comes first, a pick takes it to `release/2.0.0`;
   it moves no fingerprint, so a locked branch takes it too.
2. The skill seeds `en.md` on `main` from the live 1.x App Store listing (the public page
   shows the subtitle and description; the owner pastes the keywords and promotional text
   from App Store Connect), and the owner confirms or changes the screenshot set.
3. After the cut, the draft runs against the 2.0.0 changelog. Expect a near-full rewrite;
   the #145 reviewers sign off whole files.
4. No `v*` tag exists, so the sheet marks everything _paste_: six fields in five
   languages on both stores, every image, and the declarations with the privacy URL
   (#55's moment).
5. Tagging `v2.0.0` gives every later version its baseline.

### Every later version

Usually only What's new changes, so review covers five short texts and the sheet about
ten pastes. The declarations come back only when what leaves the device changed, and the
images only when a listed screen did; a patch release usually skips captures. An
off-cycle edit, such as promotional text for a tournament, is a draft run without a
version, a PR on `main` and one paste.

## What else changes

- **`docs/release.md`**: Cut a release gains a step after writing the changelog (draft
  the listing, merge after sign-off, pick to the branch). Its App Privacy and Data safety
  bullets point at the paste sheet, and its asset paragraph becomes the capture loop, the
  bundle and the upload. "What the fingerprint can't see" and Start here point at
  `store/`, and a short procedure covers an off-cycle listing change.
- **`.claude/rules/store-listing.md`** (paths `store/**` and the two scripts): the fields
  and where their limits are tested, the untranslated names, labels quoted from the
  catalogs, declarations' meaning as the owner's, and pointers to the skill and
  `docs/release.md`. Listed in `CLAUDE.md`'s index.
- **`.claude/rules/privacy-telemetry.md`**: a change to what leaves the device updates
  `store/declarations.md` in the same PR, as it does the About text. The skill's evidence
  check is the safety net, not the mechanism.
- **`.claude/rules/design-handoff.md`**: per-language feature graphics, and the listing
  set handled by the bundle.
- **Issues, on the owner's OK:** a new issue for the tooling; #147 becomes 2.0.0's first
  run and depends on it; #55's answers move into `declarations.md` with the tooling, and
  #55 stays open until they are entered; #116's asset line points at the bundle; a
  backlog issue for the push.

## Later: the push

A manually dispatched workflow on `release/*` that shows a dry-run diff, then uploads the
text and images of the same `store/` files to both consoles, with an App Store Connect API
key and a Play service account in the `production-<platform>` environments. Its issue
chooses the tool (fastlane's deliver and supply, or the stores' APIs from Node) and what
stays hand-entered. Nothing in this design is built for it beyond keeping the files
machine-readable.

## Testing

- Vitest, in `npm run check`: every check above against the real files, and the pure
  parts against fixtures (a missing heading, a field over its limit, an untranslated
  field, keywords with spaces, an out-of-date privacy URL; `baselineTag` across versions
  with and without tags; _paste_ and _skip_ per field; the rendered sheet).
- `store-bundle.ts` stays thin: it reads files and calls the tested module.
- The skill's first real use is 2.0.0. Evals through `scripts/evals/` can follow as their
  own issue.

## Out of scope

Pushing to the consoles; captioned or framed screenshots; regional locale variants;
iPad screenshots (`supportsTablet` is false); separate Apple and Play descriptions;
Play custom store listings and listing experiments; keyword research.
