# Wikimedia player photos — proof of concept

**Status:** POC concluded 2026-10-13; the production data pipeline and the
data were built 2026-10-14 (§10). This file is the front door for player
photos: the POC's design (§1–§7), what it measured (§9), the production plan
(§8) and what was built from it (§10). Mockups:
<https://claude.ai/artifact/3EQSqA9vHiWVEbzrGTdWAN> (private; the last version
shows the credit options, earlier versions the hero studies). Code: the POC on
branch `claude/festive-dijkstra-j9urcu`, the production pipeline on
`claude/player-photos`.

## Outcome

**Wikimedia hotlinking with machine-read credits is good enough to build
on.** Played on device, real photos in the hero were "a completely another
level of experience", and the licence data comes back complete for 99.6% of
players who have a free photo.

- **Spain:** 26 of 26 players usable.
- **All 3,335 players:** 1,559 usable (47%). The limit is our data, not
  Wikimedia: 1,227 players (37%) have no `wikiTitle` to look up. Of players
  who have one, 74% have a usable photo.
- **Birth dates come from the same lookup:** Wikidata gives a day-precise
  birth date for 98% of players with a `wikiTitle`.
- **Changes for production:** the credit must be visible during the question,
  not revealed after answering (§8.4), and thumbnails should be requested at
  500 px, not 512 (§8.2).

## 1. Question this POC answers

Can Escuadra get player photos from Wikipedia/Wikimedia Commons **automatically,
with licensing fully in place, and without storing copies** — and do they look
right in the question screen's hero?

Three measurements decide it:

1. **Coverage** — what share of a squad has a freely licensed lead image.
2. **Licence completeness** — what share of those come back with an author and
   licence in machine-readable form, needing no hand lookup.
3. **Fit** — whether real Commons portraits sit well in the square hero with a
   top-anchored crop and the number tab.

Scope: the **Spain** squad (`data/squads/nation/esp.json`, 26 members), all
three levels. Development builds only.

## 2. Decisions and rationale

| Decision         | Choice                                                                                                                                                                                                        | Why                                                                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hosting          | Hotlink Wikimedia's thumbnail (requested at 512 px; Commons snaps it to a standard width) from `upload.wikimedia.org` or `thumb.wikimedia.org` via `expo-image`, tracking query removed; store no copies      | The point of the evaluation. Hotlinking Commons is permitted; `expo-image` (already installed) caches.                                                              |
| Licensing        | Remote hosting does **not** remove attribution duties; every shown photo carries its licence and a Commons link (plus author when Commons gives one), and a photo with incomplete licence data is never shown | CC BY / BY-SA require attribution wherever the image is displayed, wherever it is hosted. CLAUDE.md's asset-licensing rule applies to remote images too.            |
| Resolution       | Build-time lookup script (not runtime API calls)                                                                                                                                                              | No extra network round trips per question; licences are validated before a build, not discovered by a user. This is also how production would work.                 |
| Hero treatment   | Option **A — corner tab**: photo fills the square, number sits in a bottom-left surface-coloured tab joined to the card by concave fillets                                                                    | Keeps the most photo while the number stays on a flat, always-legible surface; scales to the 68 pt minimum. Chosen over bottom band, side rail and number-on-photo. |
| Number minimum   | 14 pt floor for the tab number                                                                                                                                                                                | At 68 pt (level 3, short screen) the proportional size is ~11 pt — too small for a timed read.                                                                      |
| Credit placement | Option **C — after answering**: one-line credit when the question is fully answered, plus a full list on the results screen                                                                                   | Cleanest during play. See the release blocker in §7: this is the weakest of the three options on licence compliance.                                                |
| Gate             | `__DEV__` and `EXPO_PUBLIC_PHOTO_POC=1`, both required                                                                                                                                                        | Dead code in production builds, so it cannot ship over the air or in a store build even if merged.                                                                  |
| Engine           | `lib/questionEngine.ts` untouched                                                                                                                                                                             | Photos are a presentation concern looked up by `playerId`; the engine stays pure.                                                                                   |

Rejected approaches: **runtime lookup** (two API calls per question in a timed
game, licence checked on-device) and **runtime licence re-check** (complexity
the POC does not need).

## 3. Data and lookup

### 3.1 Script

`scripts/poc/fetch-photos.ts`, run locally with Node 24:

```bash
node scripts/poc/fetch-photos.ts esp
```

No npm script and no new dependency, so the fingerprint does not move.

It must run on a developer machine (where `squadctl fetch` already runs).
Wikimedia's APIs answered `429` to this project's cloud session after fewer
than ten requests — a throttle on the shared egress IP, not on our volume —
while `upload.wikimedia.org` (image serving) answered `200`.

Steps:

1. Read the squad file; for each member take the player's `wikiTitle`. A
   null title is reported `no-article`.
2. One batched Wikipedia request (≤ 50 titles each):
   `action=query&prop=pageimages&piprop=name&pilicense=free`. No free lead
   image is reported `no-free-image`.
3. One batched Commons request for the resulting files:
   `action=query&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=512`.
   Take `thumburl`, `descriptionurl`, and from `extmetadata`: `Artist`
   (HTML — stripped to text), `LicenseShortName`, `LicenseUrl`,
   `AttributionRequired`. A missing licence name, thumbnail or Commons page
   is reported `incomplete-licence`, with the missing field named in the
   report, and the entry is dropped — never shipped with a guessed credit.
   Author and licence deed URL are optional (revised 2026-10-13): the
   credit links the Commons file page, which names both — the click-through
   credit Wikipedia itself relies on. With no author the credit reads
   "Photo: Wikimedia Commons". A licence that is not CC BY / CC BY-SA / CC0 /
   public domain is reported `unexpected-licence` and dropped.
4. Etiquette: a User-Agent naming the repository (as
   `tools/squadctl/src/lib/wiki-fetch.ts` does), a delay between requests,
   exponential backoff on `429`. Reuse squadctl's conventions rather than
   inventing new ones.
5. Write to a temporary file and rename on success, so a failed run never
   leaves a partial data file.

Scale check: all 3,335 players is ~70 Wikipedia + ~70 Commons requests.

### 3.2 Output

`data/poc/photos.esp.json`:

```ts
type PhotoCredit = {
  url: string; // thumbnail on upload. or thumb.wikimedia.org, no query string
  author: string; // plain text
  licence: string; // e.g. "CC BY-SA 4.0"
  licenceUrl: string | null; // null only for public domain / CC0
  sourceUrl: string; // Commons file page
};
type PhotoFile = Record<string /* playerId */, PhotoCredit>;
```

`data/poc/photos.esp.report.md`: totals (members, with article, with free
image, with complete licence), counts per failure reason, the licence mix, and
one row per player with status.

Nothing in `data/players.json`, the squad files or the `photo` field changes.
The POC lives in `data/poc/`; removing it is deleting that folder and the flag.

## 4. App

### 4.1 Gate and data access — `lib/photoPoc.ts`

Same split as telemetry (`lib/telemetryEvents.ts` pure, `lib/telemetry.ts`
reads `__DEV__`), because Vitest runs in Node where `__DEV__` is undefined:

- `photoPocGate({ isDev, flag }): boolean` — pure; true only when
  `isDev && flag === '1'`.
- `getPhoto(playerId, enabled): PhotoCredit | null` — pure, imports the JSON
  statically, returns null when disabled or the player has no entry.
- The question and results screens call them with `__DEV__` and
  `process.env.EXPO_PUBLIC_PHOTO_POC`.

### 4.2 Hero — `components/HeroCard.tsx`

- New optional prop `photo?: PhotoCredit | null`. Absent → today's number card,
  byte-for-byte.
- Present → `expo-image` fills the square (`contentFit="cover"`,
  `contentPosition="top"`), fading in under 200 ms (the 300 ms animation rule).
  The number moves into the bottom-left tab. Until the image loads, and on
  `onError`, the number card shows instead — never a spinner, never a blocked
  question.
- The tab's concave fillets are built from plain Views (a bordered, rounded,
  clipped view) — no SVG dependency.
- Sizes come from a pure helper beside `fitHeroCard` in `lib/roundView.ts`:
  `heroTabMetrics(size)` → tab thickness, number size (≥ 14 pt floor), fillet
  radius. New constants go into `theme/tokens.ts`; colours via
  `useThemeColors()` (guardrail 5).
- Accessibility label stays "Shirt number N". Nothing derived from the Commons
  file name or caption, which usually contain the player's name, may reach
  any label or visible text during a question.

### 4.3 Credit — option C

- **Question screen:** once the question is fully answered (the last part on
  levels 2–3), one line appears under the answers:
  `Photo: {author} · {licence}`, the licence linking out via
  `expo-web-browser` (already installed). Shown only when that question had a
  photo.
- **Results screen:** a collapsed "Photo credits" section listing, for each
  question that showed a photo: player name, author, licence (linked), Commons
  page (linked), "cropped". Names are already revealed there.

### 4.4 Loading

On each question, `Image.prefetch` the next question's photo so it is normally
cached before it is needed.

## 5. Error handling

| Failure                                                         | Outcome                                                                 |
| --------------------------------------------------------------- | ----------------------------------------------------------------------- |
| No `wikiTitle`, no free image, incomplete or unexpected licence | Reported by the script; player has no entry; number card                |
| `429` / network error during lookup                             | Backoff and retry; then reported; atomic write keeps the previous file  |
| Image URL broken, offline, slow                                 | Number card; no telemetry (guardrail 4 untouched)                       |
| Entry without credit data                                       | Impossible by construction — the script drops it, and a test asserts it |

## 6. Testing

- `scripts/poc/__tests__/fetch-photos.test.ts` — recorded Wikipedia and Commons
  responses as fixtures, no live network: record building, HTML stripping of
  `Artist`, dropping incomplete and unexpected licences, report reasons,
  batching at 50.
- `lib/photoPoc.test.ts` (beside its code, as `lib/` does today): null when
  gated off; null for unknown players; **every entry has a non-empty author and
  licence and a Wikimedia image-host URL (`upload.` or `thumb.wikimedia.org`)** — the licensing
  guardrail as a test.
- `lib/roundView.test.ts`: `heroTabMetrics` at 220 / 130 / 108 / 68 pt,
  including the 14 pt floor.
- Manual: play Spain on all three levels with `EXPO_PUBLIC_PHOTO_POC=1`, drop
  the network mid-round, both themes.
- `design/screens/` stays unchanged — production screens do not change.
- `npm run check` passes before the work is reported done.

## 7. Release blockers (before any of this ships)

The POC never ships. A production version must first:

1. **Have credit placement signed off by a person.** Option C (credit after
   answering) was rejected in the play test: it read as an unnecessary
   reveal, and it leaves the photo uncredited for seconds. The production
   placement is persistent (§8.4). The App Store and Google Play are unlikely
   to object; the risk is the copyright holders — CC BY-SA 2.0/3.0
   attribution is actively enforced by some photographers.
2. **Update privacy disclosures** (guardrail 4): every photo load sends the
   user's IP to Wikimedia. Privacy policy, About text, App Privacy and Data
   safety change together, in a store build.
3. **Update CLAUDE.md guardrail 1** to describe remote Commons photos and the
   attribution rule.

## 8. Production implementation

The POC code is a working reference, not the production code: lookup lives in
`scripts/poc/`, data in `data/poc/`, and the app reads it behind a dev-only
gate. Production moves each piece to its permanent home.

### 8.1 Data model

- `Player.photo` (`types/squad.ts`) changes from the reserved
  `string | null` to `PhotoCredit | null`, with `PhotoCredit` moving there
  from `types/photo.ts`. Add the Commons file name as a field (`file`): it is
  the stable identity, while the thumbnail URL is derived and can change
  (the POC's first rule broke on exactly that: §9.3).
- `Player.birth` is filled from Wikidata where it is null today.
- Size: ~400 bytes per credited player (measured on Spain), about 0.6 MB
  added to the bundled `data/players.json` at today's coverage. Squad data stays bundled
  (guardrail 4); a hosted database is a separate decision (§8.6).

### 8.2 Enrichment in squadctl

Add a player-enrichment step to `squadctl` that runs after `apply`, writing
photo and birth onto player records. It gets per-player data **in batches of
50 titles, not one request per player** — the same result for every player,
while keeping squadctl's rule that no per-player article is ever fetched
(`tools/squadctl/src/lib/wiki-fetch.ts`).

Three requests per batch, all measured in this POC:

| Step | Endpoint                                                                                        | Gives                                  |
| ---- | ----------------------------------------------------------------------------------------------- | -------------------------------------- |
| 1    | Wikipedia `prop=pageimages\|pageprops`, `pilicense=free`, `ppprop=wikibase_item`, `redirects=1` | Free lead image, Wikidata id           |
| 2    | Commons `prop=imageinfo`, `iiprop=url\|extmetadata`, `iiurlwidth=500`                           | Thumbnail, licence, author, deed, page |
| 3    | Wikidata `wbgetentities`, `props=claims`                                                        | Birth date (`P569`, day precision)     |

The whole player base is 117 requests, 2 min 22 s with a 500 ms courtesy
delay. Port the rules from `scripts/poc/lib/photo-records.ts` with their
tests:

- **Accept:** CC BY and CC BY-SA at any version (ported variants included),
  CC0, public domain.
- **Require:** licence, a thumbnail on `upload.wikimedia.org` or
  `thumb.wikimedia.org`, the Commons page. Author and deed URL are optional;
  the credit links the Commons page, which names both.
- **Strip** Commons' `utm_*` tracking query from stored URLs.
- **Request 500 px.** Commons snaps widths to standard sizes: 512 comes back
  as 960 px (463 KB for Pedri); 500 comes back exactly (119 KB), enough for
  the 220 pt hero at 2×.
- **Decide on "Attribution":** 7 players have Commons' attribution-only
  licence, refused by today's rule. It is a free licence; accept it after a
  person looks at the wording.
- **Birth disagreements are conflicts.** Where a stored birth date and
  Wikidata disagree (62 players), report a conflict as squadctl does for
  spelling changes; never overwrite silently. Use only day-precise dates.
- **Cache responses** before parsing, like `wiki-fetch.ts`, so rule changes
  re-run offline.
- **Run it on a developer machine.** Wikimedia's APIs answered 429 to a
  cloud session's shared IP after fewer than ten requests. GitHub Actions
  runners are untested.

### 8.3 Backfill `wikiTitle` first

It is the largest coverage lever: 1,227 players (37%) have no `wikiTitle`,
so nothing can be looked up for them. CLAUDE.md puts the permanent share
(source rows with no article) at about 2.5%; the rest predate the field.
Check whether re-running `squadctl apply` fills titles on existing records;
if not, backfilling them is the first task. With titles filled, expect about
74% photo coverage and 98% birth coverage.

### 8.4 App

- **Keep from the POC:** `HeroCard`'s photo branch with the bottom-left
  number tab and concave fillets, `heroTabMetrics` with the 14 pt floor,
  next-question prefetch, and the fall-back to the number card while loading,
  offline or on error.
- **Remove** the `EXPO_PUBLIC_PHOTO_POC` gate and `data/poc/`; read
  `player.photo`.
- **Move the credit.** It must be visible for as long as the photo is, and
  never appear as part of the answer reveal. Candidates from the play test:
  a quiet line in the footer below the action button, or beside the hero.
  Settle it in the planned redesign session. The results-screen credit list
  stays.
- **Never** put Commons file names or captions in visible text or labels —
  they usually name the player. Credits show author and licence only.

### 8.5 Release

Ships in a **store build**, never over the air (guardrail 4): each photo load
sends the user's IP address to Wikimedia. In the same release:

- the privacy policy and About text, word for word;
- App Privacy and Data safety answers;
- CLAUDE.md guardrail 1, rewritten for remote Commons photos and the credit
  rule;
- the credit-placement sign-off (§7.1).

No dependency changes are needed: `expo-image` and `expo-web-browser` are
installed.

### 8.6 Later

Moving squad data to a hosted database (e.g. DynamoDB) ends bundled data, so
it changes the offline-first guardrail and needs its own disclosure review.

### 8.7 Fix when porting

Found by task reviews of the POC; minor in a dev-only POC, real in
production:

- `stripHtml` decodes `&#39;` but not other numeric entities
  (`O&#039;Brien`).
- `isAcceptedLicence` accepts any "Public domain…" prefix, including "Public
  domain in the US only".
- The lookup does not follow MediaWiki `continue`. No response needed it at
  50 per batch, but production should handle it.
- Members with no shirt number are skipped from the coverage report without
  being counted.
- Fire-and-forget `Image.prefetch` and `openBrowserAsync` calls have no
  `.catch`.
- The hero tab can show for a frame over a still-loading photo when the card
  returns from its loading state with the same URL.

## 9. Results

Measured 2026-10-13 on a developer machine.

### 9.1 Spain

All 26 players usable: 25 CC BY-SA 4.0, 1 public domain. 25 of the 26 photos
are by one photographer (Bryan Berlin) from two 2026 World Cup matches.
Credits were spot-checked against Commons for Pedri and Rodri and match.
Report: `data/poc/photos.esp.report.md`.

### 9.2 All players

A read-only run of the same rules over all of `data/players.json` (not
committed; 117 requests):

| Status                          | Players | Share |
| ------------------------------- | ------- | ----- |
| Usable photo                    | 1,559   | 47%   |
| No `wikiTitle`                  | 1,227   | 37%   |
| Article has no free lead image  | 542     | 16%   |
| Licence refused ("Attribution") | 7       | 0.2%  |
| Licence data incomplete         | 0       | 0%    |

- Of 2,108 players with a `wikiTitle`, 74% have a usable photo.
- Licence mix of usable photos: CC BY-SA 4.0 906, CC0 259, CC BY 4.0 119,
  CC BY-SA 3.0 94 (plus 6 Austrian-ported), CC BY 3.0 77, CC BY 2.0 42,
  public domain 37, CC BY-SA 2.0 19.
- 375 distinct photographers; the top one accounts for 525 photos (34%).
- Birth dates: 1,643 players have one stored today. Wikidata has a
  day-precise date for 2,059 (98% of players with a `wikiTitle`). Together:
  2,490 (75% of all players). 62 players' stored date disagrees with
  Wikidata.

### 9.3 What the run taught us about the APIs

- Commons serves scaled thumbnails from `thumb.wikimedia.org`, and only
  small originals served unscaled from `upload.wikimedia.org`. The POC's
  first rule accepted only the latter and rejected 25 of 26 Spain photos.
- Requested widths snap to standard sizes (512 → 960; 500 is exact).
- Every image URL carries `utm_*` tracking parameters; the image loads
  without them.
- Wikimedia's APIs throttle shared cloud IPs (429) while still serving
  images to them.

### 9.4 Fit

Played on device across all three levels: the photo with the corner tab
works and transforms the experience. The credit after answering felt like an
unnecessary reveal, so it moves (§8.4). No screenshots were committed.

## 10. Production pipeline (built 2026-10-14)

§8.1–§8.3 and the §8.7 fixes are built. Photos are a core feature: the app
reads `player.photo` with no gate (the `EXPO_PUBLIC_PHOTOS` flag was removed
2026-10-14), so they ship with the next store release and its privacy
disclosures (§8.5). The credit sits in muted text under the question's action
button, always visible and taking two lines either way so the button never
moves — an interim placement until the play-page redesign (§8.4).

### 10.1 What was built

- **`squadctl enrich`** (`tools/squadctl/src/commands/enrich.ts`), after
  `apply`: Wikipedia → Wikidata → Commons in batches of 50, responses cached
  in `.cache/wikimedia/` before parsing, `--offline`, `--dry-run`, `--only`.
  Rules in `lib/photo-credit.ts` and `lib/enrich-plan.ts`, with recorded
  Wikimedia responses as fixtures. Usage and the conflict procedure:
  `tools/squadctl/README.md`.
- **`squadctl birth <id> <date>` / `--keep`** answer a birth conflict;
  `--keep` is recorded in `data/decisions.json` (`keptBirths`).
- **Data model** as §8.1: `Player.photo: PhotoCredit | null` with `file`;
  `types/photo.ts`, `data/poc/` and `scripts/poc/` are gone.
- **`lib/dataIntegrity.test.ts`** asserts every stored photo's credit (the
  licensing guardrail) and that every birth date is a real date.

Departures from §8.2, each found in the data:

- **Wikidata's image (P18) is the fallback** when the article has no free lead
  image, or its image is refused: +45 photos at no extra request.
- **No photo from an item that is not a person.** A club's item has an image
  too — Real Madrid's is a building — so a title pointing at one would show it.
- **No photo from a disambiguation page**, reported with the retitle fix.
- **A birth conflict holds the photo**, not just the date: a different birth
  date is how a title naming the wrong person shows up (`idrissa-gueye` was
  stored with a namesake's 1989 date).
- **A conflict can be kept** (`birth --keep`): when the stored date is right,
  the alternative was editing Wikidata or being asked every run.
- **Public domain is accepted exactly**, not as a prefix; ported CC variants
  ("CC BY-SA 3.0 at") are accepted; `http://` deeds are upgraded to https.
- **The credit names whom the licence asks for** (added 2026-10-14). Commons'
  `Attribution` field records the credit a licensor requests — CC BY wants
  credit "in any reasonable manner requested by the licensor" — and it
  differed from the author field on 459 photos: 350 by Bryan Berlin ask for
  "Bryan Berlin / WikiPortraits", and agency photos (Fars, Tasnim, Mehr,
  Dynamomania) name the agency, not the photographer. The credit shows that
  field, else the author; an unknown-author placeholder counts as no name.
- **"Attribution" is accepted** (signed off 2026-10-14) — "anyone may use it
  for any purpose, provided that the copyright holder is properly
  attributed" — on one condition: a named holder, else the photo is refused.
  It covers 12 photos: 5 from the Hungarian federation, 3 from the
  Government of Catalonia, 2 by GePo, 1 from Iran's Student News Agency
  (whose author field says only "Unknown photographer"), and Willi Orbán's.
- **The Commons page is derived, not stored** (2026-10-14): MediaWiki's own
  URL encoding of the file name reproduced all 2,184 stored page URLs
  exactly, so `sourceUrl` is gone and `scripts/commons.ts` derives it.
  enrich stores a photo only when Commons' page URL equals the derivation,
  so a derived link always lands.

### 10.2 `wikiTitle` backfill (§8.3)

Re-applying the cached wikitext the stored squads were built from (`fetch
--offline`, Brazil held back as usual) filled 1,100 of the 1,227 missing
titles: `apply` fills a title when unknown, and these records predated the
field. Squad files did not change. Freiburg first needed `KVX` mapped to
Kosovo (FIFA's code; most articles write `KOS`). The 127 left: 91 rows the
source lists unlinked, 21 orphans, 15 Brazil members the current article no
longer lists.

### 10.3 Results — all 3,335 players

| Photo status              | Players | Share |
| ------------------------- | ------- | ----- |
| Usable photo              | 2,197   | 66%   |
| Article has no free image | 965     | 29%   |
| No `wikiTitle`            | 127     | 4%    |
| Title has no article      | 43      | 1%    |
| Licence refused           | 3       | 0.1%  |

- **69.8% of question subjects** (2,631 of 3,767 numbered squad slots) have a
  photo. 19 squads are complete — 18 nations, Spain, England, France and
  Argentina among them, and Arsenal; Mallorca (3 of 28) and Italy (6 of 24)
  are lowest.
- Licence mix: CC BY-SA 4.0 1,176, CC0 434, CC BY 4.0 142, CC BY-SA 3.0 132,
  CC BY 3.0 120, CC BY 2.0 71, CC BY-SA 2.0 52, public domain 47, Attribution
  12, CC BY-SA 3.0 at 9, CC BY 3.0 br 1, CC BY 2.5 1.
- **Birth dates:** 1,543 filled; 3,186 players (95.5%) now have one.
- **68 stored dates disagreed with Wikidata.** Settled against the article
  infobox: 53 stored dates were wrong (Ferran Torres was stored as born
  1998-02-29, a date that does not exist), 13 were right and Wikidata was not
  (kept), and the last 2 were settled by hand: `andres-cubas` takes one of
  Wikidata's two dates, `longoni` keeps the infobox's against Wikidata's.
- Four disambiguation titles were retitled after matching nationality, birth
  and club on Wikidata.
- 185 requests, 3 min 40 s; a second, offline run changes nothing.
- Size: `data/players.json` 0.85 → 1.69 MB on disk; 0.69 MB minified, 331 bytes
  per photo, with the Commons page derived rather than stored.

Found on the way: Espanyol's stored squad carried eight entries its article
has since removed, linked to articles that do not exist; a fresh `rcd` apply
dropped them. Some players exist twice (`alisson` in Brazil, `alisson-becker`
at Liverpool); squadctl never merges records, so that is left to a person.

### 10.4 Still open

1. **Play-page redesign** (§8.4) — where the credit and the photo finally sit.
2. **Release** (§8.5) — privacy policy, About text, App Privacy and Data
   safety must name Wikimedia photo loads (#54, #55) before the next release
   branch is cut; never over the air.
3. **Brazil** — its stored squad predates squadctl and is held back while its
   article lists no shirt numbers, so its 15 untitled members have no photo,
   and its Alisson is a second record of Liverpool's `alisson-becker`. A
   Brazil apply would repoint him by title; until then he shows no photo.
