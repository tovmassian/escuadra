// What the Licences page (Settings or About → Licences, #156, #175) shows, kept React-free so
// Vitest can test it. The package list itself is lib/licences.generated.ts,
// written by scripts/gen-licences.ts from the bundle's source maps.

/** One package Metro bundles into the app, as the sheet lists it. */
export interface BundledPackage {
  name: string;
  version: string;
  /** Its package.json `license` expression, e.g. `MIT` or `MIT AND OFL-1.1`. */
  licence: string;
  /** The copyright line or lines of its primary licence file, verbatim, `\n`-joined. */
  copyright: string;
  /** Indices into `LICENCE_TEXTS`: the primary licence file, then any others (`LICENSE_FONT`, `NOTICE`). */
  texts: readonly number[];
}

export interface FontCredit {
  families: readonly string[];
  licence: string;
}

// Named only: each font file carries its own notice (docs/license.md), and the
// texts of the npm-packaged ones are under their packages in the same sheet.
// Archivo is not an npm package, which is why this list is written by hand.
export const BUNDLED_FONTS: readonly FontCredit[] = [
  { families: ['Inter', 'IBM Plex Mono', 'Archivo'], licence: 'SIL Open Font License 1.1' },
  // Shipped in the Android bundle through expo-router → expo-symbols.
  { families: ['Material Symbols (Android)'], licence: 'Apache License 2.0' },
];

export const UNICODE_CREDIT = { source: 'Unicode CLDR', licence: 'Unicode License v3' } as const;

/**
 * A licence file as paragraphs for a phone screen. Licence files are
 * hard-wrapped at about 80 columns, which a narrow screen wraps again into
 * ragged lines, so a blank line separates paragraphs and the breaks inside one
 * become spaces. The words are untouched; only the wrapping follows the screen.
 */
export function licenceParagraphs(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n/)
    .map((paragraph) =>
      paragraph
        .split('\n')
        .map((line) => line.trim().replace(/\s+/g, ' '))
        .filter(Boolean)
        .join(' '),
    )
    .filter((paragraph) => paragraph.length > 0);
}

export const packageKey = (p: Pick<BundledPackage, 'name' | 'version'>): string =>
  `${p.name}@${p.version}`;
