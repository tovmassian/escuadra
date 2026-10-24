// The pure half of the native libraries' notices (#160): from the podspecs and
// Gradle files of the packages Expo autolinks, and the hand-curated
// scripts/native-licences.json, the data the Licences sheet shows. No I/O here,
// so every rule is unit-tested without a prebuild. See docs/license.md.
import type { NativeLibrary } from '../lib/licencesView.ts';

// Decided by the owner on 2026-10-24 (#160): the licences the native libraries
// already shipping are under, and the terms of Google's proprietary Play
// libraries, which are named in the sheet with no text. The owner widened it
// in a second round on 2026-10-24 for Glide (BSD-2-Clause-Views), the
// libjpeg-turbo inside Fresco (IJG, Zlib), the code Hermes bundles (LLVM's
// licences, Unlicense) and the Public Suffix List inside OkHttp (MPL-2.0).
// MPL-2.0 was approved for the Public Suffix List only: any other entry under
// MPL-2.0 goes to the owner first. A third round the same day accepted the four notices left in Hermes: netlib
// dtoa, OpenBSD's strlcpy (ISC), LLVM's ConvertUTF (Unicode, Inc.; no SPDX id
// matches its text, so ScanCode's) and Solar Designer's public-domain MD5.
// An entry's licence is compared as a whole string, so a library under several
// licences at once is listed by its full expression: IJG, Zlib, NCSA and
// LLVM's exception appear only inside the two compounds. Widening it is the
// owner's decision, like ALLOWED_LICENCES.
export const NATIVE_ALLOWED_LICENCES: readonly string[] = [
  'Apache-2.0',
  'MIT',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'BSL-1.0',
  'bzip2-1.0.6',
  'BSD-2-Clause-Views',
  'Unlicense',
  'MPL-2.0',
  'dtoa',
  'ISC',
  'LicenseRef-scancode-unicode-mappings',
  'LicenseRef-Public-Domain',
  'IJG AND BSD-3-Clause AND Zlib',
  'Apache-2.0 WITH LLVM-exception AND NCSA',
  'Play Core Software Development Kit Terms of Service',
  'Android Software Development Kit License',
];

// Google's terms carry no open-source text to show.
const TERMS_WITHOUT_TEXT = new Set([
  'Play Core Software Development Kit Terms of Service',
  'Android Software Development Kit License',
]);

const uncommented = (text: string): string[] =>
  text.split(/\r?\n/).filter((line) => !/^\s*(#|\/\/)/.test(line));

// `s.dependency`, `spec.dependency`, `ss.dependency`, but not
// `test_spec.dependency`: a test spec never reaches the app.
const POD_DEPENDENCY = /(?<![\w.])(?:s|spec|ss)\.dependency\s+['"]([^'"]+)['"]/;

/** The root pod names a podspec depends on, in order, test specs excluded. */
export function podDependencies(podspec: string): string[] {
  return uncommented(podspec).flatMap((line) => {
    const m = POD_DEPENDENCY.exec(line);
    return m?.[1] ? [m[1].split('/')[0] ?? m[1]] : [];
  });
}

export const podspecName = (fileName: string): string =>
  fileName.replace(/\.podspec(\.json)?$/, '');

// `implementation "g:a:v"`, `api 'g:a'`, `implementation("g:a:v")`. Not
// debugImplementation, testImplementation or compileOnly: none reaches a
// release build.
const GRADLE_DEPENDENCY =
  /^\s*(?:implementation|api)\s*\(?\s*['"]([\w.-]+):([\w.-]+)(?::[^'"]*)?['"]/;

/** `group:artifact` of every quoted implementation or api dependency. */
export function gradleCoordinates(gradle: string): string[] {
  return uncommented(gradle).flatMap((line) => {
    const m = GRADLE_DEPENDENCY.exec(line);
    return m ? [`${m[1]}:${m[2]}`] : [];
  });
}

const CATALOG_DEPENDENCY = /^\s*(?:implementation|api)\(libs\.([\w.]+)\)/;

/** `group:artifact` of every `implementation(libs.x)`/`api(libs.x)`, through the version catalog. */
export function catalogCoordinates(gradleKts: string, toml: string): string[] {
  const libraries = new Map<string, string>();
  let inLibraries = false;
  for (const line of uncommented(toml)) {
    const section = /^\s*\[([\w-]+)\]/.exec(line);
    if (section) {
      inLibraries = section[1] === 'libraries';
      continue;
    }
    if (!inLibraries) continue;
    const alias = /^\s*([\w-]+)\s*=/.exec(line)?.[1];
    const module = /module\s*=\s*"([^"]+)"/.exec(line)?.[1];
    const group = /group\s*=\s*"([^"]+)"/.exec(line)?.[1];
    const name = /name\s*=\s*"([^"]+)"/.exec(line)?.[1];
    if (alias && (module || (group && name))) libraries.set(alias, module ?? `${group}:${name}`);
  }
  return uncommented(gradleKts).flatMap((line) => {
    const ref = CATALOG_DEPENDENCY.exec(line)?.[1];
    if (!ref) return [];
    const coordinate = libraries.get(ref.replace(/\./g, '-'));
    if (!coordinate) throw new Error(`gen-licences: libs.${ref} is not in the version catalog`);
    return [coordinate];
  });
}

/** `*` matches any run of characters, dots and colons included. */
export function matchesPattern(name: string, pattern: string): boolean {
  const source = pattern.split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`^${source.join('.*')}$`).test(name);
}

/** One entry of scripts/native-licences.json, keyed by the upstream project's name. */
export interface NativeEntry {
  licence: string;
  platforms: ('ios' | 'android')[];
  /**
   * How the drift check knows it: `scan` (a podspec or Gradle file of an autolinked
   * package names it), `inventory` (only the prebuild inventory shows it: an indirect
   * dependency), or `vendored` (its code sits inside an npm package's native folders).
   */
  found: 'scan' | 'inventory' | 'vendored';
  /** Pod names (ios) and `group:artifact` (android) it covers; `*` matches any run. */
  matches: { ios?: string[]; android?: string[] };
  /** Why it ships: the npm package or packages that pull it in. */
  via: string;
  copyright: string;
  /** Its licence, then its NOTICE, each copied verbatim from `url`. Empty only for Google's terms. */
  files: { file: string; url: string }[];
  /** For `vendored`: the licence files inside node_modules it accounts for. */
  vendored?: string[];
}

/** What gen-licences read from node_modules. */
export interface NativeScan {
  /** Root pod names, first-party pods removed. */
  ios: string[];
  /** `group:artifact`, first-party modules removed. */
  android: string[];
  /** Licence files inside autolinked packages' native folders, relative to the repo root. */
  vendoredLicenceFiles: string[];
  /** Dependencies a scanned file names but the build does not link, with the reason. */
  notLinked: Record<string, string>;
}

export interface NativeData {
  texts: string[];
  libraries: NativeLibrary[];
}

const normalise = (text: string): string => text.replace(/\r\n?/g, '\n').trim();

/**
 * The sheet's native rows. `texts` is LICENCE_TEXTS as the package half built it;
 * native texts are interned into it, so identical texts (Apache-2.0) are stored
 * once. Throws one error listing every problem.
 */
export function buildNativeData(
  entries: Readonly<Record<string, NativeEntry>>,
  scan: NativeScan,
  texts: readonly string[],
  readText: (file: string) => string,
): NativeData {
  const problems: string[] = [];
  const all = [...texts];
  const indexOf = new Map(all.map((text, i) => [text, i]));
  const intern = (text: string): number => {
    const key = normalise(text);
    let index = indexOf.get(key);
    if (index === undefined) {
      index = all.length;
      all.push(key);
      indexOf.set(key, index);
    }
    return index;
  };

  for (const platform of ['ios', 'android'] as const) {
    for (const dep of [...new Set(scan[platform])].sort()) {
      if (dep in scan.notLinked) continue;
      const covered = Object.values(entries).some((e) =>
        (e.matches[platform] ?? []).some((p) => matchesPattern(dep, p)),
      );
      if (!covered)
        problems.push(`${platform} dependency "${dep}" is not in scripts/native-licences.json`);
    }
  }
  const claimed = new Set(Object.values(entries).flatMap((e) => e.vendored ?? []));
  for (const file of [...scan.vendoredLicenceFiles].sort()) {
    if (!claimed.has(file))
      problems.push(`${file}: a licence file inside a native folder that no entry claims`);
  }

  const libraries: NativeLibrary[] = [];
  for (const name of Object.keys(entries).sort((a, b) => a.localeCompare(b, 'en'))) {
    const e = entries[name];
    if (!e) continue;
    if (!NATIVE_ALLOWED_LICENCES.includes(e.licence)) {
      problems.push(
        `${name}: licence "${e.licence}" is not on the native allowlist (scripts/native-licences.ts)`,
      );
    }
    if (!TERMS_WITHOUT_TEXT.has(e.licence) && e.files.length === 0) {
      problems.push(`${name}: an open licence needs its text in scripts/licence-texts/native/`);
    }
    if (!e.copyright.trim()) problems.push(`${name}: no copyright line`);
    if (e.found === 'scan') {
      const hit = (['ios', 'android'] as const).some((platform) =>
        (e.matches[platform] ?? []).some((p) =>
          scan[platform].some((dep) => matchesPattern(dep, p)),
        ),
      );
      if (!hit) problems.push(`${name}: found by "scan", but no scanned dependency matches it`);
    }
    let indices: number[] = [];
    try {
      indices = e.files.map((f) => intern(readText(f.file)));
    } catch (error) {
      problems.push(`${name}: ${(error as Error).message}`);
    }
    libraries.push({
      name,
      platforms: e.platforms,
      licence: e.licence,
      copyright: e.copyright,
      texts: indices,
    });
  }

  if (problems.length > 0) {
    throw new Error(
      `gen-licences: ${problems.length} problem(s)\n${problems.map((p) => `  - ${p}`).join('\n')}`,
    );
  }
  return { texts: all, libraries };
}
