// Commons credit rules for player photos: which licences are accepted, what a
// credit must carry, and how Commons' HTML author field becomes text. Pure —
// `enrich` fetches, this decides. Ported from the photo POC's rules with the
// fixes its reviews found (numeric entities, exact "Public domain").
//
// Spec: docs/superpowers/specs/2026-10-13-wikimedia-photo-poc-design.md.
import { commonsFileUrl } from '../../../../scripts/commons.ts';
import type { PhotoCredit } from '../../../../types/squad.ts';

/** What an `incomplete-credit` lacks, so the report says why. `author` only
 *  for the attribution-only licence, whose one condition is a named holder;
 *  `commons-page` also when the page is not where `commonsFileUrl` puts it. */
export type MissingField = 'licence' | 'thumbnail' | 'commons-page' | 'author';

export type CreditOutcome =
  | { status: 'ok'; credit: PhotoCredit }
  | { status: 'refused-licence'; licence: string }
  | { status: 'incomplete-credit'; licence: string | null; missing: MissingField[] };

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeEntity(entity: string): string {
  const hex = entity.startsWith('#x') || entity.startsWith('#X');
  if (!entity.startsWith('#')) return NAMED_ENTITIES[entity] ?? `&${entity};`;
  const codePoint = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
  // Past Unicode's range there is no character: keep the text as written.
  return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : `&${entity};`;
}

/** Commons' `Artist` and `Attribution` fields are HTML — usually a link to the uploader's user
 *  page, sometimes a list naming the original and the derivative work. A
 *  credit line is plain text. */
export function stripHtml(html: string): string {
  return html
    .replace(/<\/li>\s*<li[^>]*>|<br\s*\/?>/gi, '; ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (_, entity: string) => decodeEntity(entity))
    .replace(/\s+/g, ' ')
    .replace(/\s*;\s*/g, '; ')
    .replace(/^[\s;]+|[\s;]+$/g, '');
}

/** `pageimages` answers `Pedri_2021.jpg`, Wikidata `Pedri 2021.jpg`, Commons
 *  `File:Pedri 2021.jpg`. One key for all three. */
export function fileKey(name: string): string {
  return name.replace(/^File:/, '').replace(/_/g, ' ');
}

// CC BY and CC BY-SA at any version (ported variants such as "CC BY-SA 3.0
// at" included), CC0, public domain exactly, and Commons' attribution-only
// licence — "anyone may use it for any purpose, provided that the copyright
// holder is properly attributed", accepted 2026-10-14 once its wording was
// read. Anything else — "Public domain in the United States",
// non-commercial, GFDL, "Copyrighted free use" — is refused, not guessed at.
const ACCEPTED_LICENCE = /^(CC BY(-SA)? \d\.\d( [a-z]{2,3})?|CC0|Public domain|Attribution)$/i;
const ATTRIBUTION_ONLY = 'Attribution';

/** Commons' unknown-author templates name no one to credit. */
const UNKNOWN_NAME = /^(unknown (author|photographer)\s*)+$/i;

export function isAcceptedLicence(shortName: string): boolean {
  return ACCEPTED_LICENCE.test(shortName.trim());
}

// Wikimedia's image hosts. Scaled thumbnails come from thumb.wikimedia.org;
// small originals Commons serves unscaled come from upload.wikimedia.org.
const IMAGE_HOSTS = new Set(['upload.wikimedia.org', 'thumb.wikimedia.org']);

/** The thumbnail URL on a Wikimedia image host, with Commons' utm_* tracking
 *  query dropped. Null when it is missing, not https, or hosted elsewhere. */
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

function nonEmpty(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

interface ImageInfoPage {
  title: string;
  imageinfo?: {
    thumburl?: string;
    descriptionurl?: string;
    extmetadata?: Record<string, { value?: string } | undefined>;
  }[];
}

interface ImageInfoResponse {
  query?: { normalized?: { from: string; to: string }[]; pages?: ImageInfoPage[] };
}

/** Who a credit names: the attribution the licence asks for when Commons
 *  records one — CC BY wants credit "in any reasonable manner requested by
 *  the licensor", and an agency's photo names the agency, not the
 *  photographer — else the author. Null when neither names anyone. */
function creditName(meta: Record<string, { value?: string } | undefined>): string | null {
  for (const field of [meta.Attribution?.value, meta.Artist?.value]) {
    const name = stripHtml(field ?? '');
    if (name !== '' && !UNKNOWN_NAME.test(name)) return name;
  }
  return null;
}

function credit(page: ImageInfoPage): CreditOutcome {
  const info = page.imageinfo?.[0];
  const meta = info?.extmetadata ?? {};
  const file = fileKey(page.title);
  const licence = nonEmpty(meta.LicenseShortName?.value);
  const author = creditName(meta);
  const licenceUrl = nonEmpty(meta.LicenseUrl?.value)?.replace(/^http:\/\//, 'https://') ?? null;
  const url = wikimediaImageUrl(info?.thumburl);
  // Not stored — the app derives it from `file` — so it must be exactly
  // where the derivation puts it, or the credit's link would not land.
  const pageFound = nonEmpty(info?.descriptionurl) === commonsFileUrl(file);

  if (licence !== null && !isAcceptedLicence(licence)) {
    return { status: 'refused-licence', licence };
  }
  const unnamedHolder = licence === ATTRIBUTION_ONLY && author === null;
  if (licence === null || url === null || !pageFound || unnamedHolder) {
    const missing: MissingField[] = [];
    if (licence === null) missing.push('licence');
    if (url === null) missing.push('thumbnail');
    if (!pageFound) missing.push('commons-page');
    if (unnamedHolder) missing.push('author');
    return { status: 'incomplete-credit', licence, missing };
  }
  return { status: 'ok', credit: { file, url, author, licence, licenceUrl } };
}

/** The credit of each Commons file across one batch's responses (more than
 *  one when the query was `continue`d), keyed by `fileKey` — under the
 *  requested spelling too when Commons normalised it. A file is `ok` only
 *  with an accepted licence, a thumbnail on a Wikimedia image host and its
 *  Commons page where `commonsFileUrl` derives it. A credit name and deed
 *  are kept when Commons sends them but not required — the credit links the
 *  Commons page, which names both, the same click-through credit Wikipedia
 *  relies on — except that the attribution-only licence needs a name. */
export function creditsByFile(responses: readonly unknown[]): Map<string, CreditOutcome> {
  const pages = new Map<string, ImageInfoPage>();
  const aliases = new Map<string, string>();
  for (const response of responses) {
    const query = (response as ImageInfoResponse).query ?? {};
    for (const { from, to } of query.normalized ?? []) aliases.set(fileKey(from), fileKey(to));
    for (const page of query.pages ?? []) {
      const key = fileKey(page.title);
      // A continued response can answer a page again without its imageinfo.
      if (!pages.has(key) || page.imageinfo !== undefined) pages.set(key, page);
    }
  }
  const result = new Map<string, CreditOutcome>();
  for (const [key, page] of pages) result.set(key, credit(page));
  for (const [from, to] of aliases) {
    const outcome = result.get(to);
    if (outcome !== undefined) result.set(from, outcome);
  }
  return result;
}
