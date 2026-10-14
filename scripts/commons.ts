// A Commons file's page, derived from its file name the way MediaWiki builds
// it, so a stored photo credit need not carry the URL (~100 bytes a photo).
// squadctl enrich stores a photo only when Commons' own page URL equals this
// derivation, so a stored file name always links to its real page.
//
// Shared by the app (`@/scripts/commons`) and squadctl, which loads it under
// plain Node: it lives in scripts/ because scripts/package.json declares ESM,
// as it does for the roster-envelope contract. Keep it free of `@/` imports.

// MediaWiki's wfUrlencode: rawurlencode, then these left bare.
const BARE: Record<string, string> = {
  '%3B': ';',
  '%40': '@',
  '%24': '$',
  '%2C': ',',
  '%2F': '/',
  '%3A': ':',
};

export function commonsFileUrl(file: string): string {
  const encoded = encodeURIComponent(file.replace(/ /g, '_'))
    // encodeURIComponent leaves ' bare, which rawurlencode does not.
    .replace(/'/g, '%27')
    .replace(/%(3B|40|24|2C|2F|3A)/g, (escape) => BARE[escape] ?? escape);
  return `https://commons.wikimedia.org/wiki/File:${encoded}`;
}
