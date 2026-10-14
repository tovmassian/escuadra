// Commons file names: one key for every spelling of a file, and the file's
// page derived from it the way MediaWiki builds it, so a stored photo credit
// need not carry the URL (~100 bytes a photo).
// squadctl enrich stores a photo only when Commons' own page URL equals this
// derivation, so a stored file name always links to its real page.
//
// Shared by the app (`@/scripts/commons`) and squadctl, which loads it under
// plain Node: it lives in scripts/ because scripts/package.json declares ESM,
// as it does for the roster-envelope contract. Keep it free of `@/` imports.

/** `pageimages` answers `Pedri_2021.jpg`, Wikidata `Pedri 2021.jpg`, Commons
 *  `File:Pedri 2021.jpg`. One key for all three. */
export function fileKey(name: string): string {
  return name.replace(/^File:/, '').replace(/_/g, ' ');
}

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
