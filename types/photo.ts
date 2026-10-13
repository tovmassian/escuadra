/** A Wikimedia Commons photo and the credit its licence requires. Written by
 *  scripts/poc/fetch-photos.ts, read by lib/photoPoc.ts. Photo POC only — see
 *  docs/superpowers/specs/2026-10-13-wikimedia-photo-poc-design.md. */
export interface PhotoCredit {
  /** 512 px thumbnail on https://upload.wikimedia.org/. */
  url: string;
  /** Photographer, plain text. Null when Commons gives none; the credit
   *  then names Wikimedia Commons and links the file page, which credits them. */
  author: string | null;
  /** Licence short name as Commons gives it, e.g. "CC BY-SA 4.0". */
  licence: string;
  /** Licence deed, when Commons gives one (it often omits it for CC files);
   *  the credit falls back to linking the Commons page. */
  licenceUrl: string | null;
  /** The file's Commons page, which carries the full credit. */
  sourceUrl: string;
}

/** `data/poc/photos.<squad>.json`: player id → credit. */
export type PhotoFile = Record<string, PhotoCredit>;
