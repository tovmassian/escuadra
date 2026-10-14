// Commons credit rules for player photos: which licences are accepted, what a
// credit must carry, and how Commons' HTML author field becomes text — and
// the Commons lookup that asks for exactly the fields they read. Pure —
// lib/wikimedia-fetch.ts sends the query, this decides. Ported from the photo
// POC's rules with the fixes its reviews found (numeric entities, exact
// "Public domain").
//
// Spec: docs/superpowers/specs/2026-10-13-wikimedia-photo-poc-design.md.
import { commonsFileUrl, fileKey } from '../../../../scripts/commons.ts';
import type { PhotoCredit } from '../../../../types/squad.ts';
import type { Lookup } from './wikimedia-fetch.ts';
import { pagesByTitle } from './wikimedia-parse.ts';

export const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';

/** Commons snaps a requested width to its standard sizes: 512 comes back as
 *  960 px (463 KB for one photo), 500 exactly (119 KB) — enough for the
 *  220 pt hero at 2x. */
export const THUMB_WIDTH = 500;

/** The `extmetadata` fields the rules read, and all the query asks for.
 *  Typed, so reading a field not asked for does not compile. */
const CREDIT_FIELDS = ['LicenseShortName', 'Artist', 'Attribution', 'LicenseUrl'] as const;
type CreditField = (typeof CREDIT_FIELDS)[number];
type CreditMetadata = Partial<Record<CreditField, { value?: string }>>;

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
 *  credit line is plain text. A `<style>` or `<script>` element goes with its
 *  contents: a template's CSS is not part of anyone's name. */
export function stripHtml(html: string): string {
  return html
    .replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<\/li>\s*<li[^>]*>|<br\s*\/?>/gi, '; ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (_, entity: string) => decodeEntity(entity))
    .replace(/\s+/g, ' ')
    .replace(/\s*;\s*/g, '; ')
    .replace(/^[\s;]+|[\s;]+$/g, '');
}

// CC BY and CC BY-SA at any version (ported variants such as "CC BY-SA 3.0
// at" included), CC0, public domain exactly, and Commons' attribution-only
// licence — "anyone may use it for any purpose, provided that the copyright
// holder is properly attributed", accepted 2026-10-14 once its wording was
// read. Anything else is refused, not guessed at. What each asks, and why
// each refusal: docs/license.md — change the two together.
const ACCEPTED_LICENCE = /^(CC BY(-SA)? \d\.\d( [a-z]{2,3})?|CC0|Public domain|Attribution)$/i;
const ATTRIBUTION_ONLY = /^Attribution$/i;

/** Commons' unknown-author templates name no one to credit. */
const UNKNOWN_NAME = /^(unknown (author|photographer)\s*)+$/i;

/** Longer than any credit name Commons gives a person or an agency (the
 *  longest stored is 73 characters): text past this is a template's
 *  boilerplate — a source box, a licence banner — that `stripHtml` cannot
 *  tell from a name. */
export const MAX_CREDIT_NAME = 120;

export function isAcceptedLicence(shortName: string): boolean {
  return ACCEPTED_LICENCE.test(shortName.trim());
}

/** Commons' attribution-only licence, whose one condition is a named holder.
 *  Matched as `isAcceptedLicence` matches it — any case — so no spelling of
 *  it gets past the named-holder rule. */
export function isAttributionOnly(shortName: string): boolean {
  return ATTRIBUTION_ONLY.test(shortName.trim());
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
    extmetadata?: CreditMetadata;
  }[];
}

/** Who a credit names: the attribution the licence asks for when Commons
 *  records one — CC BY wants credit "in any reasonable manner requested by
 *  the licensor", and an agency's photo names the agency, not the
 *  photographer — else the author. Null when neither names anyone: a field
 *  that is empty, an unknown-author placeholder, or too long to be a name.
 *  The credit then names Wikimedia Commons and links the file's page, which
 *  names the author in full. */
function creditName(meta: CreditMetadata): string | null {
  for (const field of [meta.Attribution?.value, meta.Artist?.value]) {
    const name = stripHtml(field ?? '');
    if (name !== '' && name.length <= MAX_CREDIT_NAME && !UNKNOWN_NAME.test(name)) return name;
  }
  return null;
}

/** The credit of one Commons file. It is `ok` only with an accepted licence,
 *  a thumbnail on a Wikimedia image host and its Commons page where
 *  `commonsFileUrl` derives it. A credit name and deed are kept when Commons
 *  sends them but not required — the credit links the Commons page, which
 *  names both, the same click-through credit Wikipedia relies on — except
 *  that the attribution-only licence needs a name. */
export function credit(page: ImageInfoPage): CreditOutcome {
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
  const unnamedHolder = licence !== null && isAttributionOnly(licence) && author === null;
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

/** Each file's thumbnail, Commons page and credit metadata, keyed by the
 *  file key it was requested under. */
export const CREDITS: Lookup<CreditOutcome, ImageInfoPage> = {
  name: 'commons',
  endpoint: COMMONS_API,
  params: (files) => ({
    action: 'query',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: String(THUMB_WIDTH),
    iiextmetadatafilter: CREDIT_FIELDS.join('|'),
    // A file moved on Commons still answers under its new name, which the
    // credit then stores: the old name's page is only a redirect.
    redirects: '1',
    titles: files.map((file) => `File:${file}`).join('|'),
  }),
  answers: (files, replies) => {
    // A continued reply can answer a page again without its imageinfo.
    const pages = pagesByTitle<ImageInfoPage>(
      files.map((file) => `File:${file}`),
      replies,
      (seen, next) => (next.imageinfo === undefined ? seen : next),
    );
    const result = new Map<string, ImageInfoPage>();
    for (const file of files) {
      const page = pages.get(`File:${file}`);
      if (page !== undefined) result.set(file, page);
    }
    return result;
  },
  read: credit,
};
