// The pure half of scripts/gen-licences.ts (#156): from the package folders
// Metro bundled and the licence files read from them, the data the Licences
// sheet shows. No I/O here, so every rule is unit-tested without bundling.
import type { BundledPackage } from '../lib/licencesView.ts';

// Widening this is the owner's decision, like accepting a photo licence
// (docs/license.md). MIT AND Apache-2.0 is the Material Symbols font package,
// already in the Android bundle through expo-router → expo-symbols.
export const ALLOWED_LICENCES: readonly string[] = [
  'MIT',
  'ISC',
  'MIT AND OFL-1.1',
  'MIT AND Apache-2.0',
];

const NODE_MODULES = 'node_modules/';

/** The package folder a bundled source path belongs to, relative to the repo root. */
export function packageFolderFromSource(source: string): string | null {
  const at = source.lastIndexOf(NODE_MODULES);
  if (at < 0) return null;
  const rest = source.slice(at + NODE_MODULES.length).split('/');
  const [first, second] = rest;
  if (!first) return null;
  const name = first.startsWith('@') && second ? `${first}/${second}` : first;
  return `${source.slice(0, at).replace(/^\/+/, '')}${NODE_MODULES}${name}`;
}

export function collectPackageFolders(sources: Iterable<string>): string[] {
  const folders = new Set<string>();
  for (const source of sources) {
    const folder = packageFolderFromSource(source);
    if (folder) folders.add(folder);
  }
  return [...folders].sort();
}

export const isLicenceFile = (fileName: string): boolean =>
  /^(licen[cs]e|copying|notice)/i.test(fileName);
export const isPrimaryLicenceFile = (fileName: string): boolean =>
  /^(licen[cs]e|copying)(\.(md|txt))?$/i.test(fileName);

/** The licence files among a folder's names: the primary one first, then the rest. */
export function orderLicenceFiles(fileNames: readonly string[]): string[] {
  const files = fileNames.filter(isLicenceFile).sort();
  return [...files.filter(isPrimaryLicenceFile), ...files.filter((f) => !isPrimaryLicenceFile(f))];
}

// A notice line is "Copyright" followed by (c), © or a digit, or a bare (c) or ©
// followed by a digit. No year is required (Meta, Isaac Z. Schlueter), and the
// prose lines that merely begin with the word copyright (Apache-2.0's body)
// are not notices.
const COPYRIGHT_NOTICE = [/^copyright\s+(\(c\)|©|\d)/i, /^(\(c\)|©)\s*\d/];

/** A licence text's copyright lines, verbatim and trimmed. Template lines never count. */
export function copyrightLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => COPYRIGHT_NOTICE.some((notice) => notice.test(line)))
    .filter((line) => !/\[yyyy\]|\[name of copyright owner\]/i.test(line));
}

export interface LicenceFile {
  name: string;
  text: string;
}

export interface PackageRead {
  name: string;
  version: string;
  licence: string | undefined;
  /** Already ordered by `orderLicenceFiles`; empty when the package ships none. */
  files: LicenceFile[];
}

export interface LicenceData {
  texts: string[];
  packages: BundledPackage[];
}

const normalise = (text: string): string => text.replace(/\r\n?/g, '\n').trim();
const hasPrimary = (files: readonly LicenceFile[]): boolean =>
  files.some((file) => isPrimaryLicenceFile(file.name));
const byNameThenVersion = (a: PackageRead, b: PackageRead): number =>
  a.name < b.name
    ? -1
    : a.name > b.name
      ? 1
      : a.version < b.version
        ? -1
        : a.version > b.version
          ? 1
          : 0;

/**
 * The sheet's data. `sourced` holds the licence files scripts/licence-sources.json
 * resolves, by package name, for packages that ship no primary licence file: they
 * come first, before the package's own files. A name and version found in two
 * folders keeps the copy that ships a primary licence file. Throws one error
 * listing every problem, so a run names them all at once.
 */
export function buildLicenceData(
  packages: readonly PackageRead[],
  sourced: Readonly<Record<string, LicenceFile[]>>,
): LicenceData {
  const problems = new Set<string>();
  const unique = new Map<string, PackageRead>();
  for (const p of packages) {
    const id = `${p.name}@${p.version}`;
    const held = unique.get(id);
    if (!held || (!hasPrimary(held.files) && hasPrimary(p.files))) unique.set(id, p);
  }
  const sorted = [...unique.values()].sort(byNameThenVersion);

  const names = new Set(sorted.map((p) => p.name));
  for (const name of Object.keys(sourced).sort()) {
    if (!names.has(name)) {
      problems.add(
        `${name}: scripts/licence-sources.json names a package the bundle no longer contains`,
      );
    }
  }

  const texts: string[] = [];
  const indexOf = new Map<string, number>();
  const result: BundledPackage[] = [];
  for (const p of sorted) {
    const id = `${p.name}@${p.version}`;
    if (!p.licence || !ALLOWED_LICENCES.includes(p.licence)) {
      problems.add(
        `${id}: licence "${p.licence ?? '(none)'}" is not on the allowlist (scripts/licences.ts)`,
      );
    }
    const source = sourced[p.name] ?? [];
    const ownPrimary = hasPrimary(p.files);
    if (ownPrimary && source.length > 0) {
      problems.add(
        `${p.name}: scripts/licence-sources.json has an entry, but the package ships its own licence file`,
      );
    }
    const files = ownPrimary ? p.files : [...source, ...p.files];
    if (files.length === 0) {
      problems.add(`${id}: no licence file, and no entry in scripts/licence-sources.json`);
      continue;
    }
    const primary = files[0];
    const copyright =
      primary && isPrimaryLicenceFile(primary.name) ? copyrightLines(primary.text) : [];
    if (copyright.length === 0) {
      problems.add(`${id}: its licence file has no copyright line`);
      continue;
    }
    const indices = files.map(({ text }) => {
      const key = normalise(text);
      let index = indexOf.get(key);
      if (index === undefined) {
        index = texts.length;
        texts.push(key);
        indexOf.set(key, index);
      }
      return index;
    });
    result.push({
      name: p.name,
      version: p.version,
      licence: p.licence ?? '',
      copyright: copyright.join('\n'),
      texts: indices,
    });
  }

  if (problems.size > 0) {
    const listed = [...problems];
    throw new Error(
      `gen-licences: ${listed.length} problem(s)\n${listed.map((p) => `  - ${p}`).join('\n')}`,
    );
  }
  return { texts, packages: result };
}
