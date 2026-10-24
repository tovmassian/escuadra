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

/** One third-party native library the iOS or Android build links (#160), as the sheet lists it. */
export interface NativeLibrary {
  /** The upstream project, e.g. `SDWebImage` or `AndroidX`. */
  name: string;
  platforms: readonly ('ios' | 'android')[];
  /** An SPDX id, or the name of Google's terms for its proprietary Play libraries. */
  licence: string;
  /** Verbatim from the project's licence, NOTICE or source headers, `\n`-joined. */
  copyright: string;
  /** Indices into `LICENCE_TEXTS`: its licence, then its NOTICE. Empty only for Google's terms. */
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

/** One row of the Software section: a bundled package or a native library. */
export interface SoftwareRow {
  key: string;
  title: string;
  meta: string;
  /** Indices into `LICENCE_TEXTS`. */
  texts: readonly number[];
}

// Platform names are proper nouns, the same in every language, like package names.
const PLATFORM_NAMES = { ios: 'iOS', android: 'Android' } as const;

/**
 * The Software section as one alphabetical list (#160), so a reader looking for
 * SDWebImage or expo-image finds either in the same place. A package shows its
 * version; a native library shows the platforms that link it instead, since pod
 * versions float within their podspec ranges.
 */
export function softwareRows(
  packages: readonly BundledPackage[],
  natives: readonly NativeLibrary[],
): SoftwareRow[] {
  const oneLine = (copyright: string): string => copyright.replace(/\n/g, ' ');
  const rows: { sortName: string; row: SoftwareRow }[] = [
    ...packages.map((p) => ({
      sortName: p.name,
      row: {
        key: packageKey(p),
        title: `${p.name} ${p.version}`,
        meta: `${p.licence} · ${oneLine(p.copyright)}`,
        texts: p.texts,
      },
    })),
    ...natives.map((n) => ({
      sortName: n.name,
      row: {
        key: `native:${n.name}`,
        title: n.name,
        meta: `${n.licence} · ${n.platforms.map((p) => PLATFORM_NAMES[p]).join(', ')} · ${oneLine(n.copyright)}`,
        texts: n.texts,
      },
    })),
  ];
  return rows
    .sort((a, b) => a.sortName.localeCompare(b.sortName, 'en', { sensitivity: 'base' }))
    .map((r) => r.row);
}
