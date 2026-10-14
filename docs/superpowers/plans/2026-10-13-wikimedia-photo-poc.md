# Wikimedia Photo POC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show hotlinked Wikimedia Commons player photos in the question hero for the Spain squad, with full licence credit, in development builds only — and measure how much of a squad Wikipedia covers automatically.

**Architecture:** A local Node script resolves each Spain player's free lead image (Wikipedia `pageimages`) and its credit (Commons `imageinfo`/`extmetadata`) into `data/poc/photos.esp.json` plus a coverage report; its parsing and licence rules live in a pure, tested module. The app reads that JSON through a pure gate (`__DEV__` + `EXPO_PUBLIC_PHOTO_POC=1`), renders the photo in `HeroCard` with the shirt number in a bottom-left corner tab, and credits the photo after the question is answered and on the results screen.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`), Node 24 native type stripping for scripts, Expo SDK 57, `expo-image`, `expo-web-browser`, Vitest (Node environment, no RN renderer).

**Spec:** `docs/superpowers/specs/2026-10-13-wikimedia-photo-poc-design.md`

## Global Constraints

- Node 24+: run `nvm use` (`.nvmrc` pins 24) and `npm ci` once before anything else. On Node 22 every `.ts` entry point fails with `ERR_UNKNOWN_FILE_EXTENSION`.
- No new dependency, no new npm script, no `app.json`/`eas.json`/`.gitignore` change — the fingerprint must not move.
- The feature is live only when **both** `__DEV__` is true and `EXPO_PUBLIC_PHOTO_POC === '1'`. With the flag off, every screen renders exactly as today.
- `lib/questionEngine.ts` is not touched.
- Never hardcode a colour, spacing or font size in components: values come from `theme/tokens.ts`, colours from `useThemeColors()` inside the component (CLAUDE.md guardrail 5).
- Nothing derived from a Commons file name or caption may appear in any label or visible text during a question — they usually contain the player's name.
- A photo is shown only if its entry carries author, licence and Commons page; the script drops anything incomplete.
- No telemetry for any of this (CLAUDE.md guardrail 4).
- Animations under 300 ms.
- Tests live in `__tests__/` mirroring the code for `scripts/` (model: `scripts/ci/__tests__/`); `lib/` keeps its existing `*.test.ts`-beside-code layout.
- Prettier: single quotes, trailing commas, print width 100 (`.prettierrc`). Run `npx prettier --write <files>` before each commit.
- `npm run check` passes before the work is reported done.
- Commit messages end with the session's attribution lines.

## File Structure

| File                                                                        | Responsibility                                                                    |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `types/photo.ts` (create)                                                   | `PhotoCredit` / `PhotoFile` — the record shared by script and app                 |
| `scripts/poc/lib/photo-records.ts` (create)                                 | Pure: batching, HTML stripping, licence rules, response parsing, report rendering |
| `scripts/poc/__tests__/photo-records.test.ts` (create)                      | Tests for the above                                                               |
| `scripts/poc/__tests__/fixtures/pageimages.json`, `imageinfo.json` (create) | API response fixtures in MediaWiki `formatversion=2` shape                        |
| `scripts/poc/fetch-photos.ts` (create)                                      | Networked CLI: fetch, assemble, write atomically                                  |
| `data/poc/photos.esp.json` (create, `{}` until the script runs)             | Spain photo credits                                                               |
| `lib/photoPoc.ts` (create)                                                  | Pure gate, `getPhoto`, `photoCreditRows`                                          |
| `lib/photoPoc.test.ts` (create)                                             | Gate/lookup tests + licensing guardrail over the data file                        |
| `lib/photoPocRuntime.ts` (create)                                           | Reads `__DEV__` + env var into `PHOTO_POC_ENABLED`                                |
| `theme/tokens.ts` (modify)                                                  | `heroTab` constants, `sizes.photoCreditsMaxHeight`                                |
| `lib/roundView.ts` / `lib/roundView.test.ts` (modify)                       | `heroTabMetrics(size)`                                                            |
| `components/HeroTabFillet.tsx` (create)                                     | Concave corner joining the tab to the photo edge                                  |
| `components/HeroCard.tsx` (modify)                                          | Photo branch with corner tab; number-card branch unchanged                        |
| `components/PhotoCreditLine.tsx` (create)                                   | One-line credit after a question is answered                                      |
| `components/PhotoCredits.tsx` (create)                                      | Collapsible credit list on the results screen                                     |
| `app/play/[squadId]/[level]/index.tsx` (modify)                             | Wire photo, prefetch, credit line                                                 |
| `app/play/[squadId]/[level]/results.tsx` (modify)                           | Wire credit list                                                                  |
| `data/poc/photos.esp.report.md` (created by the script in Task 8)           | Coverage report                                                                   |

---

### Task 1: Photo record type and pure lookup rules

**Files:**

- Create: `types/photo.ts`
- Create: `scripts/poc/lib/photo-records.ts`
- Create: `scripts/poc/__tests__/fixtures/pageimages.json`
- Create: `scripts/poc/__tests__/fixtures/imageinfo.json`
- Test: `scripts/poc/__tests__/photo-records.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `types/photo.ts`: `interface PhotoCredit { url: string; author: string; licence: string; licenceUrl: string | null; sourceUrl: string }`, `type PhotoFile = Record<string, PhotoCredit>`
  - `scripts/poc/lib/photo-records.ts`: `type PhotoStatus`, `interface PlayerRow { playerId: string; name: string; no: number; wikiTitle: string | null }`, `interface ReportRow extends PlayerRow { status: PhotoStatus; file: string | null; licence: string | null }`, `type CreditOutcome`, `const BATCH_SIZE = 50`, `chunk<T>(items: readonly T[], size: number): T[][]`, `stripHtml(html: string): string`, `fileKey(name: string): string`, `isAcceptedLicence(shortName: string): boolean`, `leadImagesByTitle(titles: readonly string[], response: unknown): Map<string, string | null>`, `creditsByFile(response: unknown): Map<string, CreditOutcome>`, `renderReport(squadName: string, rows: readonly ReportRow[]): string`

- [ ] **Step 1: Create the shared type**

`types/photo.ts`:

```ts
/** A Wikimedia Commons photo and the credit its licence requires. Written by
 *  scripts/poc/fetch-photos.ts, read by lib/photoPoc.ts. Photo POC only — see
 *  docs/superpowers/specs/2026-10-13-wikimedia-photo-poc-design.md. */
export interface PhotoCredit {
  /** 512 px thumbnail on https://upload.wikimedia.org/. */
  url: string;
  /** Photographer, plain text. */
  author: string;
  /** Licence short name as Commons gives it, e.g. "CC BY-SA 4.0". */
  licence: string;
  /** Licence deed. Null only for CC0 and public domain. */
  licenceUrl: string | null;
  /** The file's Commons page, which carries the full credit. */
  sourceUrl: string;
}

/** `data/poc/photos.<squad>.json`: player id → credit. */
export type PhotoFile = Record<string, PhotoCredit>;
```

- [ ] **Step 2: Create the fixtures**

These follow MediaWiki's documented `formatversion=2` response shape. File names are invented (`Fixture …`) so nobody mistakes them for real Commons files.

`scripts/poc/__tests__/fixtures/pageimages.json`:

```json
{
  "batchcomplete": true,
  "query": {
    "normalized": [
      {
        "fromencoded": false,
        "from": "Rodri_(footballer,_born_1996)",
        "to": "Rodri (footballer, born 1996)"
      }
    ],
    "redirects": [{ "from": "Ferran Torres García", "to": "Ferran Torres" }],
    "pages": [
      { "pageid": 1, "ns": 0, "title": "Pedri", "pageimage": "Fixture_Pedri.jpg" },
      {
        "pageid": 2,
        "ns": 0,
        "title": "Rodri (footballer, born 1996)",
        "pageimage": "Fixture_Rodri.jpg"
      },
      { "pageid": 3, "ns": 0, "title": "Ferran Torres", "pageimage": "Fixture_Ferran.jpg" },
      { "pageid": 4, "ns": 0, "title": "Víctor Muñoz (footballer, born 2003)" },
      { "ns": 0, "title": "Nobody Real", "missing": true }
    ]
  }
}
```

`scripts/poc/__tests__/fixtures/imageinfo.json`:

```json
{
  "batchcomplete": true,
  "query": {
    "normalized": [
      { "fromencoded": false, "from": "File:Fixture_Pedri.jpg", "to": "File:Fixture Pedri.jpg" }
    ],
    "pages": [
      {
        "ns": 6,
        "title": "File:Fixture Pedri.jpg",
        "imageinfo": [
          {
            "thumburl": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Fixture_Pedri.jpg/512px-Fixture_Pedri.jpg",
            "descriptionurl": "https://commons.wikimedia.org/wiki/File:Fixture_Pedri.jpg",
            "extmetadata": {
              "Artist": {
                "value": "<a href=\"//commons.wikimedia.org/wiki/User:Example\" title=\"User:Example\">Example   Photographer</a>"
              },
              "LicenseShortName": { "value": "CC BY-SA 4.0" },
              "LicenseUrl": { "value": "https://creativecommons.org/licenses/by-sa/4.0" },
              "AttributionRequired": { "value": "true" }
            }
          }
        ]
      },
      {
        "ns": 6,
        "title": "File:Fixture Rodri.jpg",
        "imageinfo": [
          {
            "thumburl": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Fixture_Rodri.jpg/512px-Fixture_Rodri.jpg",
            "descriptionurl": "https://commons.wikimedia.org/wiki/File:Fixture_Rodri.jpg",
            "extmetadata": {
              "LicenseShortName": { "value": "CC BY 2.0" },
              "LicenseUrl": { "value": "https://creativecommons.org/licenses/by/2.0" }
            }
          }
        ]
      },
      {
        "ns": 6,
        "title": "File:Fixture Ferran.jpg",
        "imageinfo": [
          {
            "thumburl": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Fixture_Ferran.jpg/512px-Fixture_Ferran.jpg",
            "descriptionurl": "https://commons.wikimedia.org/wiki/File:Fixture_Ferran.jpg",
            "extmetadata": {
              "Artist": { "value": "Someone" },
              "LicenseShortName": { "value": "CC BY-NC 2.0" },
              "LicenseUrl": { "value": "https://creativecommons.org/licenses/by-nc/2.0" }
            }
          }
        ]
      },
      {
        "ns": 6,
        "title": "File:Fixture Old.jpg",
        "imageinfo": [
          {
            "thumburl": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Fixture_Old.jpg/512px-Fixture_Old.jpg",
            "descriptionurl": "https://commons.wikimedia.org/wiki/File:Fixture_Old.jpg",
            "extmetadata": {
              "Artist": { "value": "Unknown &amp; anonymous" },
              "LicenseShortName": { "value": "Public domain" }
            }
          }
        ]
      },
      {
        "ns": 6,
        "title": "File:Fixture Elsewhere.jpg",
        "imageinfo": [
          {
            "thumburl": "http://example.org/Fixture_Elsewhere.jpg",
            "descriptionurl": "https://commons.wikimedia.org/wiki/File:Fixture_Elsewhere.jpg",
            "extmetadata": {
              "Artist": { "value": "Someone" },
              "LicenseShortName": { "value": "CC BY 4.0" },
              "LicenseUrl": { "value": "https://creativecommons.org/licenses/by/4.0" }
            }
          }
        ]
      },
      {
        "ns": 6,
        "title": "File:Fixture NoDeed.jpg",
        "imageinfo": [
          {
            "thumburl": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Fixture_NoDeed.jpg/512px-Fixture_NoDeed.jpg",
            "descriptionurl": "https://commons.wikimedia.org/wiki/File:Fixture_NoDeed.jpg",
            "extmetadata": {
              "Artist": { "value": "Someone" },
              "LicenseShortName": { "value": "CC BY-SA 3.0" }
            }
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 3: Write the failing tests**

`scripts/poc/__tests__/photo-records.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  BATCH_SIZE,
  chunk,
  creditsByFile,
  fileKey,
  isAcceptedLicence,
  leadImagesByTitle,
  renderReport,
  stripHtml,
  type ReportRow,
} from '../lib/photo-records.ts';
import imageInfo from './fixtures/imageinfo.json';
import pageImages from './fixtures/pageimages.json';

describe('chunk', () => {
  it('splits into MediaWiki-sized batches', () => {
    const titles = Array.from({ length: 120 }, (_, i) => `T${i}`);
    expect(chunk(titles, BATCH_SIZE).map((b) => b.length)).toEqual([50, 50, 20]);
  });

  it('returns no batches for no items', () => {
    expect(chunk([], BATCH_SIZE)).toEqual([]);
  });
});

describe('stripHtml', () => {
  it('reduces a Commons user link to its text', () => {
    expect(stripHtml('<a href="//commons.wikimedia.org/wiki/User:X">Jane  Doe</a>')).toBe(
      'Jane Doe',
    );
  });

  it('decodes the entities Commons emits', () => {
    expect(stripHtml('A &amp; B &quot;C&quot; &#39;D&#39;&nbsp;E')).toBe('A & B "C" \'D\' E');
  });
});

describe('fileKey', () => {
  it('gives pageimages and Commons spellings of one file the same key', () => {
    expect(fileKey('Pedri_2021.jpg')).toBe('Pedri 2021.jpg');
    expect(fileKey('File:Pedri 2021.jpg')).toBe('Pedri 2021.jpg');
  });
});

describe('isAcceptedLicence', () => {
  it.each(['CC BY-SA 4.0', 'CC BY 2.0', 'CC BY-SA 3.0 de', 'CC0', 'Public domain'])(
    'accepts %s',
    (licence) => {
      expect(isAcceptedLicence(licence)).toBe(true);
    },
  );

  it.each(['CC BY-NC 2.0', 'CC BY-NC-SA 4.0', 'GFDL', 'CC BY-SA', 'Fair use'])(
    'refuses %s',
    (licence) => {
      expect(isAcceptedLicence(licence)).toBe(false);
    },
  );
});

describe('leadImagesByTitle', () => {
  const titles = [
    'Pedri',
    'Rodri_(footballer,_born_1996)',
    'Ferran Torres García',
    'Víctor Muñoz (footballer, born 2003)',
    'Nobody Real',
    'Never Requested Back',
  ];
  const images = leadImagesByTitle(titles, pageImages);

  it('maps a plain title to its lead image', () => {
    expect(images.get('Pedri')).toBe('Fixture_Pedri.jpg');
  });

  it('follows title normalisation', () => {
    expect(images.get('Rodri_(footballer,_born_1996)')).toBe('Fixture_Rodri.jpg');
  });

  it('follows redirects', () => {
    expect(images.get('Ferran Torres García')).toBe('Fixture_Ferran.jpg');
  });

  it('returns null for an article without a free lead image, a missing page, or no answer', () => {
    expect(images.get('Víctor Muñoz (footballer, born 2003)')).toBeNull();
    expect(images.get('Nobody Real')).toBeNull();
    expect(images.get('Never Requested Back')).toBeNull();
  });
});

describe('creditsByFile', () => {
  const credits = creditsByFile(imageInfo);

  it('builds a complete credit with the author stripped to text', () => {
    expect(credits.get('Fixture Pedri.jpg')).toEqual({
      status: 'ok',
      credit: {
        url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Fixture_Pedri.jpg/512px-Fixture_Pedri.jpg',
        author: 'Example Photographer',
        licence: 'CC BY-SA 4.0',
        licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:Fixture_Pedri.jpg',
      },
    });
  });

  it('drops a photo with no author as incomplete', () => {
    expect(credits.get('Fixture Rodri.jpg')).toEqual({
      status: 'incomplete-licence',
      licence: 'CC BY 2.0',
    });
  });

  it('drops a licence outside CC BY / BY-SA / CC0 / public domain', () => {
    expect(credits.get('Fixture Ferran.jpg')).toEqual({
      status: 'unexpected-licence',
      licence: 'CC BY-NC 2.0',
    });
  });

  it('accepts public domain without a licence URL', () => {
    const outcome = credits.get('Fixture Old.jpg');
    expect(outcome?.status).toBe('ok');
    if (outcome?.status === 'ok') {
      expect(outcome.credit.author).toBe('Unknown & anonymous');
      expect(outcome.credit.licenceUrl).toBeNull();
    }
  });

  it('drops a thumbnail hosted anywhere but upload.wikimedia.org', () => {
    expect(credits.get('Fixture Elsewhere.jpg')?.status).toBe('incomplete-licence');
  });

  it('drops a CC licence that comes without its deed URL', () => {
    expect(credits.get('Fixture NoDeed.jpg')?.status).toBe('incomplete-licence');
  });
});

describe('renderReport', () => {
  const row = (no: number, status: ReportRow['status'], licence: string | null): ReportRow => ({
    playerId: `p${no}`,
    name: `Player ${no}`,
    no,
    wikiTitle: status === 'no-article' ? null : `Player ${no}`,
    status,
    file: status === 'ok' || status === 'incomplete-licence' ? `File ${no}.jpg` : null,
    licence,
  });
  const report = renderReport('Spain', [
    row(1, 'ok', 'CC BY-SA 4.0'),
    row(2, 'ok', 'CC BY 2.0'),
    row(3, 'no-article', null),
    row(4, 'incomplete-licence', 'CC BY 2.0'),
  ]);

  it('reports coverage and usable share', () => {
    expect(report).toContain('| Members | 4 | 100% |');
    expect(report).toContain('| With a free lead image | 3 | 75% |');
    expect(report).toContain('| Usable (complete, accepted licence) | 2 | 50% |');
  });

  it('counts every status and lists the licence mix of usable photos only', () => {
    expect(report).toContain('| no-article | 1 |');
    expect(report).toContain('| lookup-failed | 0 |');
    expect(report).toContain('| CC BY 2.0 | 1 |');
    expect(report).toContain('| CC BY-SA 4.0 | 1 |');
  });

  it('lists each player', () => {
    expect(report).toContain('| 3 | Player 3 | no-article | — | — |');
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npx vitest run scripts/poc`
Expected: FAIL — `Cannot find module '../lib/photo-records.ts'` (or equivalent resolve error).

- [ ] **Step 5: Implement the pure module**

`scripts/poc/lib/photo-records.ts`:

```ts
// Pure half of the Wikimedia photo POC lookup: response parsing, licence
// rules and the coverage report. No network and no filesystem, so every rule
// is pinned by scripts/poc/__tests__/photo-records.test.ts. The networked
// half is scripts/poc/fetch-photos.ts. Spec:
// docs/superpowers/specs/2026-10-13-wikimedia-photo-poc-design.md.
import type { PhotoCredit } from '../../../types/photo';

export type PhotoStatus =
  | 'ok'
  | 'no-article'
  | 'no-free-image'
  | 'incomplete-licence'
  | 'unexpected-licence'
  | 'lookup-failed';

export interface PlayerRow {
  playerId: string;
  name: string;
  no: number;
  wikiTitle: string | null;
}

export interface ReportRow extends PlayerRow {
  status: PhotoStatus;
  file: string | null;
  licence: string | null;
}

export type CreditOutcome =
  | { status: 'ok'; credit: PhotoCredit }
  | { status: 'incomplete-licence' | 'unexpected-licence'; licence: string | null };

/** MediaWiki's per-request title limit for clients without the apihighlimits right. */
export const BATCH_SIZE = 50;

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size));
  return batches;
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  '#39': "'",
  nbsp: ' ',
};

/** Commons' `Artist` field is HTML — usually a link to the uploader's user
 *  page. A credit line is plain text. */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, name: string) => ENTITIES[name] ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** `pageimages` answers `Pedri_2021.jpg`; Commons titles read
 *  `File:Pedri 2021.jpg`. One key for both spellings. */
export function fileKey(name: string): string {
  return name.replace(/^File:/, '').replace(/_/g, ' ');
}

// CC BY and CC BY-SA at any version (ported variants such as "CC BY-SA 3.0
// de" included), CC0 and public domain. Anything else — non-commercial,
// GFDL-only, fair use — is refused rather than guessed at.
const ACCEPTED_LICENCE = /^(CC BY(-SA)? \d\.\d\b|CC0\b|Public domain\b)/i;
const NEEDS_DEED_URL = /^CC BY/i;
const THUMB_HOST = 'https://upload.wikimedia.org/';

export function isAcceptedLicence(shortName: string): boolean {
  return ACCEPTED_LICENCE.test(shortName.trim());
}

interface TitleMapping {
  from: string;
  to: string;
}

interface PageImagesResponse {
  query?: {
    normalized?: TitleMapping[];
    redirects?: TitleMapping[];
    pages?: { title: string; pageimage?: string }[];
  };
}

/** The free lead image of each requested title, following MediaWiki's title
 *  normalisation and then redirects. Null when the article has none, is
 *  missing, or is absent from the response. */
export function leadImagesByTitle(
  titles: readonly string[],
  response: unknown,
): Map<string, string | null> {
  const query = (response as PageImagesResponse).query ?? {};
  const normalized = new Map((query.normalized ?? []).map((m) => [m.from, m.to]));
  const redirects = new Map((query.redirects ?? []).map((m) => [m.from, m.to]));
  const images = new Map((query.pages ?? []).map((p) => [p.title, p.pageimage ?? null]));
  const result = new Map<string, string | null>();
  for (const title of titles) {
    const canonical = normalized.get(title) ?? title;
    result.set(title, images.get(redirects.get(canonical) ?? canonical) ?? null);
  }
  return result;
}

interface ImageInfoResponse {
  query?: {
    pages?: {
      title: string;
      imageinfo?: {
        thumburl?: string;
        descriptionurl?: string;
        extmetadata?: Record<string, { value?: string } | undefined>;
      }[];
    }[];
  };
}

function nonEmpty(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

/** The credit of each Commons file in the response, keyed by `fileKey`. A
 *  file is `ok` only with an accepted licence, an author, a thumbnail on
 *  upload.wikimedia.org, a Commons page, and — for CC licences — the deed URL. */
export function creditsByFile(response: unknown): Map<string, CreditOutcome> {
  const result = new Map<string, CreditOutcome>();
  for (const page of (response as ImageInfoResponse).query?.pages ?? []) {
    const info = page.imageinfo?.[0];
    const meta = info?.extmetadata ?? {};
    const licence = nonEmpty(meta.LicenseShortName?.value);
    const author = stripHtml(meta.Artist?.value ?? '');
    const licenceUrl = nonEmpty(meta.LicenseUrl?.value);
    const url = info?.thumburl ?? '';
    const sourceUrl = info?.descriptionurl ?? '';

    let outcome: CreditOutcome;
    if (licence !== null && !isAcceptedLicence(licence)) {
      outcome = { status: 'unexpected-licence', licence };
    } else if (
      licence === null ||
      author === '' ||
      !url.startsWith(THUMB_HOST) ||
      sourceUrl === '' ||
      (NEEDS_DEED_URL.test(licence) && licenceUrl === null)
    ) {
      outcome = { status: 'incomplete-licence', licence };
    } else {
      outcome = { status: 'ok', credit: { url, author, licence, licenceUrl, sourceUrl } };
    }
    result.set(fileKey(page.title), outcome);
  }
  return result;
}

const STATUS_ORDER: PhotoStatus[] = [
  'ok',
  'no-article',
  'no-free-image',
  'incomplete-licence',
  'unexpected-licence',
  'lookup-failed',
];

export function renderReport(squadName: string, rows: readonly ReportRow[]): string {
  const count = (status: PhotoStatus) => rows.filter((r) => r.status === status).length;
  const share = (n: number) =>
    rows.length === 0 ? '0%' : `${Math.round((n / rows.length) * 100)}%`;
  const withImage = rows.filter((r) => r.file !== null).length;
  const usable = count('ok');

  const licences = new Map<string, number>();
  for (const r of rows) {
    if (r.status === 'ok' && r.licence !== null) {
      licences.set(r.licence, (licences.get(r.licence) ?? 0) + 1);
    }
  }

  return [
    `# Photo coverage — ${squadName}`,
    '',
    'Generated by `node scripts/poc/fetch-photos.ts`. Do not edit by hand.',
    '',
    '| Measure | Count | Share |',
    '| --- | --- | --- |',
    `| Members | ${rows.length} | 100% |`,
    `| With a free lead image | ${withImage} | ${share(withImage)} |`,
    `| Usable (complete, accepted licence) | ${usable} | ${share(usable)} |`,
    '',
    '## By status',
    '',
    '| Status | Count |',
    '| --- | --- |',
    ...STATUS_ORDER.map((status) => `| ${status} | ${count(status)} |`),
    '',
    '## Licence mix (usable photos)',
    '',
    '| Licence | Count |',
    '| --- | --- |',
    ...[...licences]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([licence, n]) => `| ${licence} | ${n} |`),
    '',
    '## Players',
    '',
    '| No | Player | Status | File | Licence |',
    '| --- | --- | --- | --- | --- |',
    ...rows.map(
      (r) => `| ${r.no} | ${r.name} | ${r.status} | ${r.file ?? '—'} | ${r.licence ?? '—'} |`,
    ),
    '',
  ].join('\n');
}
```

Note on `withImage`: the report row's `file` is set whenever Wikipedia returned a lead image (Task 2 sets it for `ok`, `incomplete-licence`, `unexpected-licence` and Commons `lookup-failed`), so it measures Wikipedia coverage independently of licence quality.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run scripts/poc`
Expected: PASS, all tests green.

- [ ] **Step 7: Typecheck, format, commit**

Run: `npm run typecheck && npx prettier --write types/photo.ts scripts/poc`
Expected: no type errors.

```bash
git add types/photo.ts scripts/poc
git commit -m "feat(photo-poc): pure Wikimedia photo lookup rules and record type"
```

---

### Task 2: Lookup script and empty data file

**Files:**

- Create: `scripts/poc/fetch-photos.ts`
- Create: `data/poc/photos.esp.json`

**Interfaces:**

- Consumes: everything `scripts/poc/lib/photo-records.ts` exports (Task 1); `PhotoFile` from `types/photo.ts`; `Player`, `Squad` from `types/squad.ts`; `formatAndWrite(filePath: string, content: string): Promise<void>` from `tools/squadctl/src/lib/write-json.ts`.
- Produces: CLI `node scripts/poc/fetch-photos.ts <squadId>` writing `data/poc/photos.<squadId>.json` (a `PhotoFile`, keys sorted) and `data/poc/photos.<squadId>.report.md`. The committed `data/poc/photos.esp.json` starts as `{}` so the app compiles before the script has run.

This file is the only networked code; it is not unit-tested (same convention as `tools/squadctl/src/lib/wiki-fetch.ts`). Its logic is the composition of Task 1's tested functions.

- [ ] **Step 1: Create the empty data file**

`data/poc/photos.esp.json`:

```json
{}
```

- [ ] **Step 2: Write the script**

`scripts/poc/fetch-photos.ts`:

```ts
// Photo POC lookup. Run locally: `node scripts/poc/fetch-photos.ts esp`.
// For each squad member: Wikipedia's free lead image for their article, then
// that file's credit from Commons. Writes data/poc/photos.<squad>.json and a
// coverage report beside it. Spec:
// docs/superpowers/specs/2026-10-13-wikimedia-photo-poc-design.md.
//
// Run it on a developer machine. Wikimedia's APIs throttle shared cloud
// egress IPs — they answered 429 to a cloud session after fewer than ten
// requests — while upload.wikimedia.org (image serving) stayed open.
import { readFileSync, readdirSync, renameSync } from 'node:fs';
import path from 'node:path';
import type { PhotoFile } from '../../types/photo';
import type { Player, Squad } from '../../types/squad';
import { formatAndWrite } from '../../tools/squadctl/src/lib/write-json.ts';
import {
  BATCH_SIZE,
  chunk,
  creditsByFile,
  fileKey,
  leadImagesByTitle,
  renderReport,
  type CreditOutcome,
  type PlayerRow,
  type ReportRow,
} from './lib/photo-records.ts';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
// Wikimedia policy allows refusing a generic or absent User-Agent. The
// contact is the public repository, as squadctl's is.
const USER_AGENT = 'escuadra-photo-poc/0.1 (https://github.com/tovmassian/escuadra)';
const DELAY_MS = 500;
const MAX_RETRIES = 4;
const THUMB_WIDTH = 512;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/** One polite GET: a pause before every request, and exponential backoff
 *  (honouring Retry-After) on 429. */
async function getJson(url: string): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    await sleep(DELAY_MS);
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (response.status === 429 && attempt < MAX_RETRIES) {
      const retryAfter = Number(response.headers.get('retry-after'));
      await sleep(retryAfter > 0 ? retryAfter * 1000 : 2000 * 2 ** attempt);
      continue;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return response.json();
  }
}

function queryUrl(base: string, params: Record<string, string>): string {
  const search = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    ...params,
  });
  return `${base}?${search.toString()}`;
}

function findSquadFile(squadId: string): string {
  const dir = path.join(REPO_ROOT, 'data', 'squads');
  const match = (readdirSync(dir, { recursive: true }) as string[]).find(
    (f) => path.basename(f) === `${squadId}.json`,
  );
  if (match === undefined) throw new Error(`no squad file named ${squadId}.json under data/squads`);
  return path.join(dir, match);
}

/** Formats through squadctl's shared writer (so `npm run check` stays green),
 *  into a temp file renamed into place — a failed run never leaves a partial
 *  file behind. The temp name keeps the extension so prettier picks the parser. */
async function writeAtomically(target: string, content: string): Promise<void> {
  const ext = path.extname(target);
  const temp = `${target.slice(0, -ext.length)}.tmp${ext}`;
  await formatAndWrite(temp, content);
  renameSync(temp, target);
}

async function main(): Promise<void> {
  const squadId = process.argv[2] ?? 'esp';
  const squad = JSON.parse(readFileSync(findSquadFile(squadId), 'utf8')) as Squad;
  const allPlayers = JSON.parse(
    readFileSync(path.join(REPO_ROOT, 'data', 'players.json'), 'utf8'),
  ) as Player[];
  const players = new Map(allPlayers.map((p) => [p.id, p]));

  const rows: PlayerRow[] = [...squad.members]
    .sort((a, b) => a.no - b.no)
    .map((member) => {
      const player = players.get(member.playerId);
      if (player === undefined) {
        throw new Error(`squad ${squadId} names unknown player ${member.playerId}`);
      }
      return {
        playerId: member.playerId,
        name: player.name,
        no: member.no,
        wikiTitle: player.wikiTitle,
      };
    });

  // Stage 1 — Wikipedia: each article's free lead image.
  const titles = [...new Set(rows.flatMap((r) => (r.wikiTitle === null ? [] : [r.wikiTitle])))];
  const leadImages = new Map<string, string | null>();
  const failedTitles = new Set<string>();
  for (const batch of chunk(titles, BATCH_SIZE)) {
    try {
      const response = await getJson(
        queryUrl(WIKIPEDIA_API, {
          prop: 'pageimages',
          piprop: 'name',
          pilicense: 'free',
          pilimit: String(BATCH_SIZE),
          redirects: '1',
          titles: batch.join('|'),
        }),
      );
      for (const [title, file] of leadImagesByTitle(batch, response)) leadImages.set(title, file);
    } catch (error) {
      process.stderr.write(`Wikipedia batch failed: ${String(error)}\n`);
      for (const title of batch) failedTitles.add(title);
    }
  }

  // Stage 2 — Commons: each file's thumbnail and credit.
  const files = [
    ...new Set([...leadImages.values()].flatMap((f) => (f === null ? [] : [fileKey(f)]))),
  ];
  const credits = new Map<string, CreditOutcome>();
  const failedFiles = new Set<string>();
  for (const batch of chunk(files, BATCH_SIZE)) {
    try {
      const response = await getJson(
        queryUrl(COMMONS_API, {
          prop: 'imageinfo',
          iiprop: 'url|extmetadata',
          iiurlwidth: String(THUMB_WIDTH),
          titles: batch.map((f) => `File:${f}`).join('|'),
        }),
      );
      for (const [file, outcome] of creditsByFile(response)) credits.set(file, outcome);
    } catch (error) {
      process.stderr.write(`Commons batch failed: ${String(error)}\n`);
      for (const file of batch) failedFiles.add(file);
    }
  }

  const photos: PhotoFile = {};
  const report = rows.map((row): ReportRow => {
    const none = { ...row, file: null, licence: null };
    if (row.wikiTitle === null) return { ...none, status: 'no-article' };
    if (failedTitles.has(row.wikiTitle)) return { ...none, status: 'lookup-failed' };
    const lead = leadImages.get(row.wikiTitle) ?? null;
    if (lead === null) return { ...none, status: 'no-free-image' };
    const file = fileKey(lead);
    const outcome = credits.get(file);
    if (failedFiles.has(file) || outcome === undefined) {
      return { ...none, file, status: 'lookup-failed' };
    }
    if (outcome.status !== 'ok') {
      return { ...none, file, licence: outcome.licence, status: outcome.status };
    }
    photos[row.playerId] = outcome.credit;
    return { ...none, file, licence: outcome.credit.licence, status: 'ok' };
  });

  const sorted = Object.fromEntries(Object.entries(photos).sort(([a], [b]) => a.localeCompare(b)));
  const outDir = path.join(REPO_ROOT, 'data', 'poc');
  await writeAtomically(
    path.join(outDir, `photos.${squadId}.json`),
    `${JSON.stringify(sorted, null, 2)}\n`,
  );
  await writeAtomically(
    path.join(outDir, `photos.${squadId}.report.md`),
    renderReport(squad.name, report),
  );

  const usable = report.filter((r) => r.status === 'ok').length;
  process.stdout.write(
    `${squad.name}: ${usable}/${report.length} players have a usable photo. ` +
      `Report: data/poc/photos.${squadId}.report.md\n`,
  );
  if (
    titles.length > 0 &&
    failedTitles.size === 0 &&
    [...leadImages.values()].every((f) => f === null)
  ) {
    process.stderr.write(
      'Warning: no article returned a lead image. Compare a raw API response with ' +
        'scripts/poc/__tests__/fixtures/ before trusting this report.\n',
    );
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
```

- [ ] **Step 3: Verify it compiles and loads under Node 24**

Run: `npm run typecheck && npm run lint`
Expected: no errors (warnings unchanged from `main`).

Run: `node --check scripts/poc/fetch-photos.ts`
Expected: exits 0 with no output. (Do not run the script itself here; Task 8 runs it on a developer machine.)

- [ ] **Step 4: Format and commit**

```bash
npx prettier --write scripts/poc/fetch-photos.ts data/poc/photos.esp.json
git add scripts/poc/fetch-photos.ts data/poc/photos.esp.json
git commit -m "feat(photo-poc): Wikipedia/Commons lookup script for squad photos"
```

---

### Task 3: App-side gate, lookup and credit rows

**Files:**

- Create: `lib/photoPoc.ts`
- Create: `lib/photoPocRuntime.ts`
- Test: `lib/photoPoc.test.ts`

**Interfaces:**

- Consumes: `PhotoCredit`, `PhotoFile` (Task 1); `QuestionResult` type from `@/stores/session` (has `question: Question` with `playerId`, `playerName`, `memberNo`); `data/poc/photos.esp.json` (Task 2).
- Produces:
  - `photoPocGate(env: { isDev: boolean; flag: string | undefined }): boolean`
  - `getPhoto(playerId: string, enabled: boolean): PhotoCredit | null`
  - `interface PhotoCreditRow { playerId: string; memberNo: number; playerName: string; credit: PhotoCredit }`
  - `photoCreditRows(results: readonly QuestionResult[], lookup: (playerId: string) => PhotoCredit | null): PhotoCreditRow[]`
  - `lib/photoPocRuntime.ts`: `PHOTO_POC_ENABLED: boolean`

- [ ] **Step 1: Write the failing tests**

`lib/photoPoc.test.ts`:

```ts
import photosData from '@/data/poc/photos.esp.json';
import spain from '@/data/squads/nation/esp.json';
import { getPhoto, photoCreditRows, photoPocGate } from '@/lib/photoPoc';
import type { QuestionResult } from '@/stores/session';
import type { PhotoCredit, PhotoFile } from '@/types/photo';
import { describe, expect, it } from 'vitest';

const photos = photosData as PhotoFile;

const credit: PhotoCredit = {
  url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/X.jpg/512px-X.jpg',
  author: 'Example Photographer',
  licence: 'CC BY-SA 4.0',
  licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:X.jpg',
};

function result(playerId: string, memberNo: number, playerName: string): QuestionResult {
  return {
    question: {
      playerId,
      playerName,
      memberNo,
      age: null,
      position: 'MF',
      affiliation: '—',
      parts: [],
    },
    parts: [],
    correct: true,
  };
}

describe('photoPocGate', () => {
  it('is on only in a development build with the flag set to 1', () => {
    expect(photoPocGate({ isDev: true, flag: '1' })).toBe(true);
    expect(photoPocGate({ isDev: false, flag: '1' })).toBe(false);
    expect(photoPocGate({ isDev: true, flag: undefined })).toBe(false);
    expect(photoPocGate({ isDev: true, flag: 'true' })).toBe(false);
  });
});

describe('getPhoto', () => {
  it('returns nothing when the POC is off, whatever the data holds', () => {
    for (const id of Object.keys(photos)) expect(getPhoto(id, false)).toBeNull();
  });

  it('returns nothing for a player without a photo entry', () => {
    expect(getPhoto('not-a-player', true)).toBeNull();
  });

  it('returns the entry for a player who has one', () => {
    for (const [id, entry] of Object.entries(photos)) expect(getPhoto(id, true)).toEqual(entry);
  });
});

describe('photoCreditRows', () => {
  it('lists only the questions that showed a photo, in round order', () => {
    const rows = photoCreditRows(
      [result('a', 7, 'Ferran Torres'), result('b', 20, 'Pedri'), result('c', 16, 'Rodri')],
      (id) => (id === 'b' || id === 'c' ? credit : null),
    );
    expect(rows).toEqual([
      { playerId: 'b', memberNo: 20, playerName: 'Pedri', credit },
      { playerId: 'c', memberNo: 16, playerName: 'Rodri', credit },
    ]);
  });
});

// The licensing guardrail as a test: nothing reaches the screen without a
// nameable author and licence, hosted where the spec says.
describe('data/poc/photos.esp.json', () => {
  const memberIds = new Set(spain.members.map((m) => m.playerId));

  it('holds only Spain members, each with a complete credit', () => {
    for (const [id, entry] of Object.entries(photos)) {
      expect(memberIds.has(id), id).toBe(true);
      expect(entry.author.trim(), id).not.toBe('');
      expect(entry.licence.trim(), id).not.toBe('');
      expect(entry.url.startsWith('https://upload.wikimedia.org/'), id).toBe(true);
      expect(entry.sourceUrl.startsWith('https://commons.wikimedia.org/wiki/File:'), id).toBe(true);
      if (entry.licenceUrl !== null) expect(entry.licenceUrl.startsWith('https://'), id).toBe(true);
    }
  });
});
```

Note: with the empty `{}` data file this test passes trivially; it starts biting once Task 8 fills the file. A plain loop rather than `it.each` because `.each` over an empty table is an error.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/photoPoc.test.ts`
Expected: FAIL — cannot resolve `@/lib/photoPoc`.

- [ ] **Step 3: Implement the pure module**

`lib/photoPoc.ts`:

```ts
// Photo POC: dev-only Wikimedia photos in the question hero. Pure — the gate
// takes its inputs rather than reading `__DEV__`, which does not exist in
// Vitest's Node environment; lib/photoPocRuntime.ts supplies them, as
// lib/telemetry.ts does for lib/telemetryEvents.ts. Spec:
// docs/superpowers/specs/2026-10-13-wikimedia-photo-poc-design.md.
import photosData from '@/data/poc/photos.esp.json';
import type { QuestionResult } from '@/stores/session';
import type { PhotoCredit, PhotoFile } from '@/types/photo';

const photos = photosData as PhotoFile;

/** On only in a development build started with EXPO_PUBLIC_PHOTO_POC=1, so a
 *  production binary or OTA update can never show a photo. */
export function photoPocGate(env: { isDev: boolean; flag: string | undefined }): boolean {
  return env.isDev && env.flag === '1';
}

export function getPhoto(playerId: string, enabled: boolean): PhotoCredit | null {
  if (!enabled) return null;
  return photos[playerId] ?? null;
}

export interface PhotoCreditRow {
  playerId: string;
  memberNo: number;
  playerName: string;
  credit: PhotoCredit;
}

/** One row per question in the round that showed a photo, in round order —
 *  the results screen's credit list. */
export function photoCreditRows(
  results: readonly QuestionResult[],
  lookup: (playerId: string) => PhotoCredit | null,
): PhotoCreditRow[] {
  return results.flatMap(({ question }) => {
    const credit = lookup(question.playerId);
    return credit === null
      ? []
      : [
          {
            playerId: question.playerId,
            memberNo: question.memberNo,
            playerName: question.playerName,
            credit,
          },
        ];
  });
}
```

`lib/photoPocRuntime.ts`:

```ts
// Reads the build environment into lib/photoPoc.ts's pure gate. Kept apart so
// Vitest never evaluates `__DEV__`. `process.env.EXPO_PUBLIC_PHOTO_POC` must
// stay written out in full: Expo inlines EXPO_PUBLIC_ variables by name at
// bundle time.
import { photoPocGate } from '@/lib/photoPoc';

export const PHOTO_POC_ENABLED = photoPocGate({
  isDev: __DEV__,
  flag: process.env.EXPO_PUBLIC_PHOTO_POC,
});
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/photoPoc.test.ts`
Expected: PASS (the data-file test passes trivially on `{}`).

- [ ] **Step 5: Typecheck, lint, format, commit**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

```bash
npx prettier --write lib/photoPoc.ts lib/photoPocRuntime.ts lib/photoPoc.test.ts
git add lib/photoPoc.ts lib/photoPocRuntime.ts lib/photoPoc.test.ts
git commit -m "feat(photo-poc): dev-only gate, photo lookup and credit rows"
```

---

### Task 4: Corner-tab sizing

**Files:**

- Modify: `theme/tokens.ts` (add `heroTab` after the `radii` block, ~line 503; add one entry to `sizes`, ~line 399)
- Modify: `lib/roundView.ts` (append after `fitHeroCard`, ~line 94)
- Test: `lib/roundView.test.ts` (append)

**Interfaces:**

- Consumes: `radii` from `theme/tokens.ts`.
- Produces:
  - `heroTab` token object; `sizes.photoCreditsMaxHeight: number`
  - `interface HeroTabMetrics { thickness: number; numberSize: number; fillet: number; padStart: number; padEnd: number }`
  - `heroTabMetrics(size: number): HeroTabMetrics`

- [ ] **Step 1: Write the failing test**

Append to `lib/roundView.test.ts` (and add `heroTabMetrics` to its existing `@/lib/roundView` import, plus `heroTab` to its `@/theme/tokens` import):

```ts
describe('heroTabMetrics', () => {
  it('scales the tab with the hero at every level size', () => {
    expect(heroTabMetrics(220)).toMatchObject({ thickness: 59, numberSize: 35 });
    expect(heroTabMetrics(130)).toMatchObject({ thickness: 35, numberSize: 21 });
    expect(heroTabMetrics(108)).toMatchObject({ thickness: 29, numberSize: 17 });
  });

  it('holds the number at its floor on the smallest hero', () => {
    // 68pt is level 3's fitHeroCard minimum; the ratios alone give an ~11pt number.
    expect(heroTabMetrics(68)).toMatchObject({
      thickness: heroTab.minThickness,
      numberSize: heroTab.minNumberSize,
    });
  });

  it('never lets the number outgrow its tab', () => {
    for (const size of [68, 90, 108, 124, 130, 180, 220]) {
      const m = heroTabMetrics(size);
      expect(m.numberSize).toBeLessThan(m.thickness);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/roundView.test.ts`
Expected: FAIL — `heroTabMetrics` / `heroTab` not exported.

- [ ] **Step 3: Add the tokens**

In `theme/tokens.ts`, directly after the closing `} as const;` of `export const radii = { … }`:

```ts
// Photo POC hero (docs/superpowers/specs/2026-10-13-wikimedia-photo-poc-design.md):
// with a photo, the shirt number moves into a tab cut into the card's
// bottom-left corner. Ratios are of the hero's side (thickness) or of the
// tab's thickness (number, padding); the floors keep the tab legible at
// level 3's 68pt minimum, where the ratios alone give an ~11pt number.
export const heroTab = {
  thicknessRatio: 0.27,
  minThickness: 18,
  numberRatio: 0.6,
  minNumberSize: 14,
  padStartRatio: 0.22,
  padEndRatio: 0.26,
  fillet: radii.md,
} as const;
```

In the `sizes` object, add as its last entry:

```ts
  // Photo POC: the results screen's expanded photo-credit list scrolls past this.
  photoCreditsMaxHeight: 200,
```

- [ ] **Step 4: Add the helper**

In `lib/roundView.ts`, extend the tokens import to
`import { heroCardMinSize, heroCardSize, heroFitHeight, heroNumberSize, heroTab } from '@/theme/tokens';`
and append after `fitHeroCard`:

```ts
export interface HeroTabMetrics {
  thickness: number;
  numberSize: number;
  fillet: number;
  padStart: number;
  padEnd: number;
}

/** The photo hero's number tab for a hero of side `size` (Photo POC). */
export function heroTabMetrics(size: number): HeroTabMetrics {
  const thickness = Math.max(heroTab.minThickness, Math.round(size * heroTab.thicknessRatio));
  return {
    thickness,
    numberSize: Math.max(heroTab.minNumberSize, Math.round(thickness * heroTab.numberRatio)),
    fillet: heroTab.fillet,
    padStart: Math.round(thickness * heroTab.padStartRatio),
    padEnd: Math.round(thickness * heroTab.padEndRatio),
  };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run lib/roundView.test.ts design theme`
Expected: PASS — including `design/handoff.test.ts` (it pins re-export identity; a new token does not break it).

- [ ] **Step 6: Format and commit**

```bash
npx prettier --write theme/tokens.ts lib/roundView.ts lib/roundView.test.ts
git add theme/tokens.ts lib/roundView.ts lib/roundView.test.ts
git commit -m "feat(photo-poc): corner-tab sizing tokens and heroTabMetrics"
```

---

### Task 5: Photo hero with the corner tab

**Files:**

- Create: `components/HeroTabFillet.tsx`
- Modify: `components/HeroCard.tsx` (whole file shown below)

**Interfaces:**

- Consumes: `heroTabMetrics(size)` (Task 4); `durations.reveal` (180 ms), `elevation.e1`, `radii.xl`, `spacing.xs`, `typography.captionEyebrow` from `theme/tokens.ts`.
- Produces: `HeroCard` gains optional prop `photoUrl?: string | null`. Without it (or while `loading`), render is identical to today. `HeroTabFillet({ size, color, style })`.

Components are verified on-device (no RN test renderer, by design — see `vitest.config.ts`).

- [ ] **Step 1: Create the fillet**

`components/HeroTabFillet.tsx`:

```tsx
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

interface HeroTabFilletProps {
  size: number;
  color: string;
  style?: StyleProp<ViewStyle>;
}

// A concave corner: a `size` square filled with `color` except for a quarter
// circle centred on its top-right corner. Two of these join the photo hero's
// number tab to the card edge in one continuous curve. Plain views, no SVG:
// a ring whose hole is that quarter circle, clipped to the square. The ring
// is as thick as its hole's radius, so it covers the square's far corner
// (√2·size from the centre) with room to spare.
export function HeroTabFillet({ size, color, style }: HeroTabFilletProps) {
  const styles = StyleSheet.create({
    clip: { width: size, height: size, overflow: 'hidden', pointerEvents: 'none' },
    ring: {
      position: 'absolute',
      left: -size,
      top: -2 * size,
      width: 4 * size,
      height: 4 * size,
      borderRadius: 2 * size,
      borderWidth: size,
      borderColor: color,
    },
  });
  return (
    <View style={[styles.clip, style]}>
      <View style={styles.ring} />
    </View>
  );
}
```

- [ ] **Step 2: Add the photo branch to `HeroCard`**

Replace `components/HeroCard.tsx` with:

```tsx
import type { Level } from '@/lib/questionEngine';
import { heroTabMetrics } from '@/lib/roundView';
import {
  durations,
  elevation,
  heroCardSize,
  heroNumberSize,
  radii,
  spacing,
  typography,
} from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';
import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { HeroTabFillet } from './HeroTabFillet';
import { Skeleton } from './Skeleton';

interface HeroCardProps {
  level: Level;
  shirtNumber: number;
  loading?: boolean;
  /** Overrides the level's full size, as fitted to the screen by `fitHeroCard`. */
  fit?: { size: number; numberSize: number };
  /** Photo POC: a Wikimedia Commons thumbnail to fill the card. The number
   *  card shows until it loads, and stays if it fails. */
  photoUrl?: string | null;
}

// Every level holds a shirt number; with a photo (Photo POC) the photo fills
// the same square footprint and the number moves into a bottom-left tab.
export function HeroCard({ level, shirtNumber, loading, fit, photoUrl }: HeroCardProps) {
  const colors = useThemeColors();
  const [photoShown, setPhotoShown] = useState(false);
  const size = fit?.size ?? heroCardSize[level];
  const numberSize = fit?.numberSize ?? heroNumberSize[level];
  const tab = heroTabMetrics(size);
  const styles = StyleSheet.create({
    card: {
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      ...elevation.e1,
    },
    number: {
      fontFamily: 'IBMPlexMono-Bold',
      fontWeight: '700',
      color: colors.textPrimary,
    },
    label: {
      ...typography.captionEyebrow,
      color: colors.textMuted,
      marginTop: spacing.xs,
    },
    // The photo card clips to its rounded corners, and on iOS a clipping view
    // drops its own shadow — so the shadow sits on an outer view.
    shadow: { borderRadius: radii.xl, backgroundColor: colors.surface, ...elevation.e1 },
    clip: {
      flex: 1,
      borderRadius: radii.xl,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    tab: {
      position: 'absolute',
      left: 0,
      bottom: 0,
      height: tab.thickness,
      minWidth: tab.thickness,
      paddingLeft: tab.padStart,
      paddingRight: tab.padEnd,
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderTopRightRadius: tab.fillet,
    },
    tabNumber: {
      fontFamily: 'IBMPlexMono-Bold',
      fontWeight: '700',
      color: colors.textPrimary,
      fontSize: tab.numberSize,
      lineHeight: Math.round(tab.numberSize * 1.05),
    },
    filletAbove: { position: 'absolute', left: 0, bottom: '100%' },
    filletBeside: { position: 'absolute', left: '100%', bottom: 0 },
  });

  const numberText = (
    <Text style={[styles.number, { fontSize: numberSize, lineHeight: numberSize * 1.05 }]}>
      {shirtNumber}
    </Text>
  );

  if (!photoUrl || loading) {
    return (
      <View style={[styles.card, { width: size, height: size }]}>
        {loading ? (
          <Skeleton width={numberSize} height={numberSize} radius={radii.sm} />
        ) : (
          <>
            {numberText}
            {level === 1 && <Text style={styles.label}>SHIRT NUMBER</Text>}
          </>
        )}
      </View>
    );
  }

  // The photo's own label is never read out: Commons file names and captions
  // usually name the player. The card reads as its shirt number, as it does
  // without a photo.
  return (
    <View
      style={[styles.shadow, { width: size, height: size }]}
      accessible
      accessibilityLabel={`Shirt number ${shirtNumber}`}
    >
      <View style={styles.clip}>
        {!photoShown && (
          <>
            {numberText}
            {level === 1 && <Text style={styles.label}>SHIRT NUMBER</Text>}
          </>
        )}
        <Image
          source={{ uri: photoUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition="top"
          transition={durations.reveal}
          accessible={false}
          onLoad={() => setPhotoShown(true)}
          onError={() => setPhotoShown(false)}
        />
        {photoShown && (
          <View style={styles.tab}>
            <HeroTabFillet size={tab.fillet} color={colors.surface} style={styles.filletAbove} />
            <Text style={styles.tabNumber}>{shirtNumber}</Text>
            <HeroTabFillet size={tab.fillet} color={colors.surface} style={styles.filletBeside} />
          </View>
        )}
      </View>
    </View>
  );
}
```

The number-card branch keeps today's `card` style, structure and text exactly; only the number `Text` is hoisted into `numberText`, which renders the same element.

- [ ] **Step 3: Typecheck, lint, format**

Run: `npm run typecheck && npm run lint && npx prettier --write components/HeroCard.tsx components/HeroTabFillet.tsx`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/HeroCard.tsx components/HeroTabFillet.tsx
git commit -m "feat(photo-poc): photo hero with bottom-left number tab"
```

---

### Task 6: Question screen — photo, prefetch, credit after answering

**Files:**

- Create: `components/PhotoCreditLine.tsx`
- Modify: `app/play/[squadId]/[level]/index.tsx`

**Interfaces:**

- Consumes: `getPhoto` (Task 3), `PHOTO_POC_ENABLED` (Task 3), `HeroCard`'s `photoUrl` (Task 5), `PhotoCredit` (Task 1), `openBrowserAsync` from `expo-web-browser`, `Image.prefetch` from `expo-image`.
- Produces: `PhotoCreditLine({ credit }: { credit: PhotoCredit })`.

- [ ] **Step 1: Create the credit line**

`components/PhotoCreditLine.tsx`:

```tsx
import { typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';
import type { PhotoCredit } from '@/types/photo';
import { openBrowserAsync } from 'expo-web-browser';
import { StyleSheet, Text } from 'react-native';

// Photo POC credit, shown once a question is fully answered (option C in
// docs/superpowers/specs/2026-10-13-wikimedia-photo-poc-design.md). Author and
// licence only — never the file name or caption, which name the player.
export function PhotoCreditLine({ credit }: { credit: PhotoCredit }) {
  const colors = useThemeColors();
  const styles = StyleSheet.create({
    line: { ...typography.secondarySmall, color: colors.textMuted },
    link: { color: colors.textSecondary, textDecorationLine: 'underline' },
  });
  const open = (url: string) => () => {
    void openBrowserAsync(url);
  };

  return (
    <Text style={styles.line}>
      Photo:{' '}
      <Text style={styles.link} accessibilityRole="link" onPress={open(credit.sourceUrl)}>
        {credit.author}
      </Text>
      {' · '}
      <Text
        style={styles.link}
        accessibilityRole="link"
        onPress={open(credit.licenceUrl ?? credit.sourceUrl)}
      >
        {credit.licence}
      </Text>
      {' · cropped'}
    </Text>
  );
}
```

- [ ] **Step 2: Wire it into the question screen**

In `app/play/[squadId]/[level]/index.tsx`:

Add imports (keep the file's alphabetical-by-path order):

```tsx
import { PhotoCreditLine } from '@/components/PhotoCreditLine';
import { getPhoto } from '@/lib/photoPoc';
import { PHOTO_POC_ENABLED } from '@/lib/photoPocRuntime';
import { Image } from 'expo-image';
```

Add this effect directly after the existing `useEffect` that routes to results (the one ending `}, [session.phase]);`), so it runs before any early return:

```tsx
// Photo POC: warm the cache for the next question's photo while this one is
// played, so it is normally already loaded when the question appears.
useEffect(() => {
  const next = session.questions[session.currentIndex + 1];
  const nextPhoto = next ? getPhoto(next.playerId, PHOTO_POC_ENABLED) : null;
  if (nextPhoto) void Image.prefetch(nextPhoto.url);
}, [session.currentIndex, session.questions]);
```

After `const questionComplete = result.correct !== null;` add:

```tsx
const photo = getPhoto(question.playerId, PHOTO_POC_ENABLED);
```

Change the hero line from

```tsx
<HeroCard level={level} shirtNumber={question.memberNo} fit={heroFit} />
```

to

```tsx
<HeroCard
  level={level}
  shirtNumber={question.memberNo}
  fit={heroFit}
  photoUrl={photo?.url ?? null}
/>
```

Inside the parts `ScrollView`, directly after the `{question.parts.map(…)}` block and before `</ScrollView>`, add:

```tsx
{
  questionComplete && photo && <PhotoCreditLine credit={photo} />;
}
```

- [ ] **Step 3: Typecheck, lint, format**

Run: `npm run typecheck && npm run lint && npx prettier --write components/PhotoCreditLine.tsx "app/play/[squadId]/[level]/index.tsx"`
Expected: no errors; no new lint warnings (the prefetch effect lists its full deps).

- [ ] **Step 4: Confirm nothing changes with the flag off**

Run: `npx expo start --web` (without `EXPO_PUBLIC_PHOTO_POC`), open Spain, play one question at each level.
Expected: identical to `design/screens/06-question-l1.png`, `07-question-l2.png`, `08-question-l3.png` — number card, no credit line.

- [ ] **Step 5: Commit**

```bash
git add components/PhotoCreditLine.tsx "app/play/[squadId]/[level]/index.tsx"
git commit -m "feat(photo-poc): photo in the question hero, credit once answered"
```

---

### Task 7: Results screen — photo credit list

**Files:**

- Create: `components/PhotoCredits.tsx`
- Modify: `app/play/[squadId]/[level]/results.tsx`

**Interfaces:**

- Consumes: `photoCreditRows`, `PhotoCreditRow`, `getPhoto` (Task 3), `PHOTO_POC_ENABLED` (Task 3), `sizes.photoCreditsMaxHeight` (Task 4).
- Produces: `PhotoCredits({ rows }: { rows: PhotoCreditRow[] })` — renders nothing for an empty list.

- [ ] **Step 1: Create the list**

`components/PhotoCredits.tsx`:

```tsx
import type { PhotoCreditRow } from '@/lib/photoPoc';
import { sizes, spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';
import { openBrowserAsync } from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

// Photo POC: every photo the round showed, with its credit. Collapsed by
// default so it never competes with the results' own actions. Player names are
// already revealed on this screen, so naming them here gives nothing away.
export function PhotoCredits({ rows }: { rows: PhotoCreditRow[] }) {
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);
  if (rows.length === 0) return null;

  const styles = StyleSheet.create({
    root: { marginTop: spacing.md, gap: spacing.xs },
    toggle: { ...typography.captionEyebrow, color: colors.textMuted },
    list: { maxHeight: sizes.photoCreditsMaxHeight },
    listContent: { gap: spacing.xs },
    row: { ...typography.secondarySmall, color: colors.textMuted },
    name: { color: colors.textPrimary },
    link: { color: colors.textSecondary, textDecorationLine: 'underline' },
  });
  const openUrl = (url: string) => () => {
    void openBrowserAsync(url);
  };

  return (
    <View style={styles.root}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        hitSlop={8}
      >
        <Text style={styles.toggle}>
          {open ? 'Hide' : 'Show'} photo credits · {rows.length}
        </Text>
      </Pressable>
      {open && (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {rows.map((r) => (
            <Text key={r.playerId} style={styles.row}>
              <Text style={styles.name}>
                {r.memberNo} {r.playerName}
              </Text>
              {' — '}
              <Text
                style={styles.link}
                accessibilityRole="link"
                onPress={openUrl(r.credit.sourceUrl)}
              >
                {r.credit.author}
              </Text>
              {' · '}
              <Text
                style={styles.link}
                accessibilityRole="link"
                onPress={openUrl(r.credit.licenceUrl ?? r.credit.sourceUrl)}
              >
                {r.credit.licence}
              </Text>
              {' · cropped'}
            </Text>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
```

- [ ] **Step 2: Wire it into the results screen**

In `app/play/[squadId]/[level]/results.tsx` add imports:

```tsx
import { PhotoCredits } from '@/components/PhotoCredits';
import { getPhoto, photoCreditRows } from '@/lib/photoPoc';
import { PHOTO_POC_ENABLED } from '@/lib/photoPocRuntime';
```

After `const actions = actionOrder({ … });` add:

```tsx
const photoCredits = photoCreditRows(session.results, (id) => getPhoto(id, PHOTO_POC_ENABLED));
```

Directly after the closing `</View>` of `<View style={styles.actions}>` (and before the root `</View>`), add:

```tsx
<PhotoCredits rows={photoCredits} />
```

- [ ] **Step 3: Typecheck, lint, format**

Run: `npm run typecheck && npm run lint && npx prettier --write components/PhotoCredits.tsx "app/play/[squadId]/[level]/results.tsx"`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/PhotoCredits.tsx "app/play/[squadId]/[level]/results.tsx"
git commit -m "feat(photo-poc): photo credit list on the results screen"
```

- [ ] **Step 5: Full check**

Run: `npm run check`
Expected: typecheck, lint, format:check, tests, registry check, gen:squads, gen:flags all pass and `git diff --exit-code` reports no generated-file drift. Paste the tail of the output into the task report.

---

### Task 8: Run the lookup, verify in the app, record results (developer machine)

This task needs a developer machine: Wikimedia's APIs throttle the cloud session's IP. It produces the POC's answer.

**Files:**

- Modify: `data/poc/photos.esp.json` (written by the script)
- Create: `data/poc/photos.esp.report.md` (written by the script)
- Modify: `docs/superpowers/specs/2026-10-13-wikimedia-photo-poc-design.md` (§9 Results)

**Interfaces:**

- Consumes: the CLI from Task 2; the app wiring from Tasks 5–7.
- Produces: the filled data file and report; the spec's Results section.

- [ ] **Step 1: Run the lookup**

```bash
nvm use
node scripts/poc/fetch-photos.ts esp
```

Expected: a line like `Spain: N/26 players have a usable photo. Report: data/poc/photos.esp.report.md`, and no "Warning: no article returned a lead image". If that warning appears, fetch one raw response in a browser —
`https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&prop=pageimages&piprop=name&pilicense=free&titles=Pedri` —
compare it with `scripts/poc/__tests__/fixtures/pageimages.json`, fix the parser and fixture together, and re-run.

- [ ] **Step 2: Run the guardrail test against the real data**

Run: `npx vitest run lib/photoPoc.test.ts`
Expected: PASS — the data-file test now checks every entry in `photos.esp.json`.

- [ ] **Step 3: Spot-check two credits by hand**

Open the `sourceUrl` of two entries in `data/poc/photos.esp.json`. Confirm the Commons page shows the same author and licence as the entry, and that the licence is the file's own (not a different licence for a derivative).

- [ ] **Step 4: Play it**

```bash
EXPO_PUBLIC_PHOTO_POC=1 npx expo start
```

On a device or simulator (development build), for Spain:

- Levels 1, 2, 3: players with a photo show it, cropped to keep the head in frame, with the number in the bottom-left tab; players without one show today's number card.
- After the last part of a question: the credit line appears under the answers; both links open in the system browser.
- Results: "Show photo credits · N" expands to the list; links open.
- Turn the network off mid-round: the next un-prefetched photo falls back to the number card, the question is never blocked.
- Repeat in light and dark themes.
- On a short screen (or the smallest simulator), level 3's 68 pt hero: the tab number is readable.

Note any player whose crop cuts the face badly — that is fit data for the report.

- [ ] **Step 5: Record the results**

Replace the placeholder under `## 9. Results` in the spec with: usable/26 and percentage, with-image/26, the licence mix table (copy from the report), the per-reason counts, the crop observations from Step 4, and three screenshots (one per level, real photos) saved under `docs/superpowers/specs/assets/2026-10-13-photo-poc/` and linked from the section. End with a one-paragraph verdict on the spec's question: is Wikipedia an easy, automatable, licence-clean source, and at what coverage.

- [ ] **Step 6: Final check and commit**

Run: `npm run check`
Expected: all green.

```bash
npx prettier --write data/poc docs/superpowers/specs/2026-10-13-wikimedia-photo-poc-design.md
git add data/poc docs/superpowers/specs
git commit -m "docs(photo-poc): Spain photo coverage results"
git push
```
