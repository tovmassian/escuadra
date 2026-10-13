# Wikimedia player photos — proof of concept

**Status:** design, approved 2026-10-13. Self-contained — every decision and
its rationale is recorded here. Mockups:
<https://claude.ai/artifact/3EQSqA9vHiWVEbzrGTdWAN> (private; the last version
shows the credit options, earlier versions the hero studies).

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

| Decision         | Choice                                                                                                                                                                    | Why                                                                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hosting          | Hotlink Wikimedia's 512 px thumbnail from `upload.wikimedia.org` via `expo-image`; store no copies                                                                        | The point of the evaluation. Hotlinking Commons is permitted; `expo-image` (already installed) caches.                                                              |
| Licensing        | Remote hosting does **not** remove attribution duties; every shown photo carries author + licence + Commons link, and a photo with incomplete licence data is never shown | CC BY / BY-SA require attribution wherever the image is displayed, wherever it is hosted. CLAUDE.md's asset-licensing rule applies to remote images too.            |
| Resolution       | Build-time lookup script (not runtime API calls)                                                                                                                          | No extra network round trips per question; licences are validated before a build, not discovered by a user. This is also how production would work.                 |
| Hero treatment   | Option **A — corner tab**: photo fills the square, number sits in a bottom-left surface-coloured tab joined to the card by concave fillets                                | Keeps the most photo while the number stays on a flat, always-legible surface; scales to the 68 pt minimum. Chosen over bottom band, side rail and number-on-photo. |
| Number minimum   | 14 pt floor for the tab number                                                                                                                                            | At 68 pt (level 3, short screen) the proportional size is ~11 pt — too small for a timed read.                                                                      |
| Credit placement | Option **C — after answering**: one-line credit when the question is fully answered, plus a full list on the results screen                                               | Cleanest during play. See the release blocker in §7: this is the weakest of the three options on licence compliance.                                                |
| Gate             | `__DEV__` and `EXPO_PUBLIC_PHOTO_POC=1`, both required                                                                                                                    | Dead code in production builds, so it cannot ship over the air or in a store build even if merged.                                                                  |
| Engine           | `lib/questionEngine.ts` untouched                                                                                                                                         | Photos are a presentation concern looked up by `playerId`; the engine stays pure.                                                                                   |

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
   `AttributionRequired`. A missing author or licence name is reported
   `incomplete-licence` and the entry is dropped — never shipped with a
   guessed credit. A licence that is not CC BY / CC BY-SA / CC0 / public
   domain is reported `unexpected-licence` and dropped.
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
  url: string; // 512 px thumbnail on upload.wikimedia.org
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
  licence and an `https://upload.wikimedia.org/` URL** — the licensing
  guardrail as a test.
- `lib/roundView.test.ts`: `heroTabMetrics` at 220 / 130 / 108 / 68 pt,
  including the 14 pt floor.
- Manual: play Spain on all three levels with `EXPO_PUBLIC_PHOTO_POC=1`, drop
  the network mid-round, both themes.
- `design/screens/` stays unchanged — production screens do not change.
- `npm run check` passes before the work is reported done.

## 7. Release blockers (before any of this ships)

The POC never ships. A production version must first:

1. **Have credit placement signed off by a person.** Option C shows a photo
   for several seconds before its credit is reachable. The App Store and
   Google Play are unlikely to object; the risk is the copyright holders —
   CC BY-SA 2.0/3.0 attribution is actively enforced by some photographers.
   Option B (a CC button on the photo opening a credit sheet) is the fallback
   if C is not accepted.
2. **Update privacy disclosures** (guardrail 4): every photo load sends the
   user's IP to Wikimedia. Privacy policy, About text, App Privacy and Data
   safety change together, in a store build.
3. **Update CLAUDE.md guardrail 1** to describe remote Commons photos and the
   attribution rule.

## 8. Path to production (out of scope here)

- Photo lookup becomes a step in `squadctl`'s per-player fetch, alongside
  birth date, writing the `PhotoCredit` fields onto each player record in the
  bundled JSON. The `data/poc/` record shape is designed to move over
  unchanged.
- A later move of squad data to a hosted database (e.g. DynamoDB) is a
  separate product decision: it ends bundled squad data, so it changes the
  offline-first guardrail and needs its own disclosure review.

## 9. Results

_To be filled in after the script has run: coverage %, licence-complete %,
licence mix, and screenshots of real photos in the hero at each level._
