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

/** What an `incomplete-licence` credit lacks, so the report says why. */
export type MissingField = 'licence' | 'thumbnail' | 'commons-page';

export interface ReportRow extends PlayerRow {
  status: PhotoStatus;
  file: string | null;
  licence: string | null;
  missing: readonly MissingField[];
}

export type CreditOutcome =
  | { status: 'ok'; credit: PhotoCredit }
  | { status: 'unexpected-licence'; licence: string }
  | { status: 'incomplete-licence'; licence: string | null; missing: MissingField[] };

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
// Wikimedia's image hosts. Scaled thumbnails come from thumb.wikimedia.org;
// small originals Commons serves unscaled come from upload.wikimedia.org.
const IMAGE_HOSTS = new Set(['upload.wikimedia.org', 'thumb.wikimedia.org']);

/** The thumbnail URL on a Wikimedia image host, with Commons' utm_* tracking
 *  query dropped. Null when it is missing or hosted anywhere else. */
function wikimediaImageUrl(raw: string | undefined): string | null {
  if (raw === undefined) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' || !IMAGE_HOSTS.has(parsed.hostname)) return null;
  return `${parsed.origin}${parsed.pathname}`;
}

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
 *  file is `ok` only with an accepted licence, a thumbnail on a Wikimedia
 *  image host and a Commons page. Author and licence deed URL are
 *  kept when Commons sends them but not required: the credit links to the
 *  Commons page, which names both — the same click-through credit Wikipedia
 *  itself relies on. */
export function creditsByFile(response: unknown): Map<string, CreditOutcome> {
  const result = new Map<string, CreditOutcome>();
  for (const page of (response as ImageInfoResponse).query?.pages ?? []) {
    const info = page.imageinfo?.[0];
    const meta = info?.extmetadata ?? {};
    const licence = nonEmpty(meta.LicenseShortName?.value);
    const author = stripHtml(meta.Artist?.value ?? '');
    const licenceUrl = nonEmpty(meta.LicenseUrl?.value);
    const url = wikimediaImageUrl(info?.thumburl);
    const sourceUrl = info?.descriptionurl ?? '';

    const missing: MissingField[] = [];
    if (licence === null) missing.push('licence');
    if (url === null) missing.push('thumbnail');
    if (sourceUrl === '') missing.push('commons-page');

    let outcome: CreditOutcome;
    if (licence !== null && !isAcceptedLicence(licence)) {
      outcome = { status: 'unexpected-licence', licence };
    } else if (licence === null || url === null || missing.length > 0) {
      outcome = { status: 'incomplete-licence', licence, missing };
    } else {
      outcome = {
        status: 'ok',
        credit: { url, author: author === '' ? null : author, licence, licenceUrl, sourceUrl },
      };
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
    '| No | Player | Status | File | Licence | Missing |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows.map(
      (r) =>
        `| ${r.no} | ${r.name} | ${r.status} | ${r.file ?? '—'} | ${r.licence ?? '—'} | ` +
        `${r.missing.length > 0 ? r.missing.join(', ') : '—'} |`,
    ),
    '',
  ].join('\n');
}
