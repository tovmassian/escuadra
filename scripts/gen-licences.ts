// Producer of lib/licences.generated.ts — run via `npm run gen:licences`. It writes
// that file: the Unicode notice and every package Metro bundles into the iOS and
// Android apps, with their licence notices, for About → Licences. See
// docs/superpowers/specs/2026-10-20-licences-sheet-design.md.
//
// "Bundled" is read from the bundle itself: one production export with source
// maps, whose `sources` name every file Metro included. The lockfile would list
// some 640 packages, most of them build tools that never reach a phone.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
// Shared with gen-squads and squadctl so every generated file is written
// through identical prettier options.
import { formatAndWrite } from '../tools/squadctl/src/lib/write-json.ts';
import {
  buildLicenceData,
  collectPackageFolders,
  orderLicenceFiles,
  sourceMapSources,
  type LicenceFile,
  type PackageRead,
  type SourceMap,
} from './licences.ts';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const GENERATED_TS_PATH = path.join(REPO_ROOT, 'lib', 'licences.generated.ts');
const SOURCES_PATH = path.join(REPO_ROOT, 'scripts', 'licence-sources.json');
const UNICODE_PATH = path.join(REPO_ROOT, 'i18n', 'UNICODE-LICENSE.txt');
const UNICODE_START = 'UNICODE LICENSE V3';
const PLATFORMS = ['ios', 'android'] as const;

// One entry per package in scripts/licence-sources.json: why it needs one, and
// where its licence files come from, in order. `from` is another package in
// node_modules, published from the same repository; `file` is a licence copied
// verbatim into the repo from `url`.
type LicenceSource = { from: string } | { file: string; url: string };
interface LicenceSourceEntry {
  reason: string;
  sources: LicenceSource[];
}

function exportSourceMaps(outDir: string): string[] {
  // EXPO_OFFLINE: the export needs no network, and `npm run check` must not.
  execFileSync(
    'npx',
    [
      'expo',
      'export',
      ...PLATFORMS.flatMap((p) => ['--platform', p]),
      '--source-maps',
      '--no-bytecode',
      '--output-dir',
      outDir,
    ],
    {
      cwd: REPO_ROOT,
      stdio: ['ignore', 'ignore', 'inherit'],
      env: { ...process.env, EXPO_OFFLINE: '1' },
    },
  );
  return PLATFORMS.flatMap((platform) => {
    const dir = path.join(outDir, '_expo', 'static', 'js', platform);
    const maps = readdirSync(dir).filter((f) => f.endsWith('.map'));
    if (maps.length === 0)
      throw new Error(`gen-licences: the ${platform} export wrote no source map`);
    return maps.flatMap((m) =>
      sourceMapSources(JSON.parse(readFileSync(path.join(dir, m), 'utf8')) as SourceMap),
    );
  });
}

function readLicenceFiles(folder: string): LicenceFile[] {
  // Regular files only: a folder named LICENSES is not a licence text.
  const names = readdirSync(folder, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);
  return orderLicenceFiles(names).map((name) => ({
    name,
    text: readFileSync(path.join(folder, name), 'utf8'),
  }));
}

function readPackage(relFolder: string): PackageRead {
  const folder = path.join(REPO_ROOT, relFolder);
  const json = JSON.parse(readFileSync(path.join(folder, 'package.json'), 'utf8')) as {
    name: string;
    version: string;
    license?: unknown;
  };
  return {
    name: json.name,
    version: json.version,
    licence: typeof json.license === 'string' ? json.license : undefined,
    files: readLicenceFiles(folder),
  };
}

function resolveSource(name: string, source: LicenceSource): LicenceFile[] {
  if ('from' in source) return readLicenceFiles(path.join(REPO_ROOT, 'node_modules', source.from));
  if ('file' in source)
    return [{ name: 'LICENSE', text: readFileSync(path.join(REPO_ROOT, source.file), 'utf8') }];
  throw new Error(
    `gen-licences: scripts/licence-sources.json entry "${name}" has a source with neither "from" nor "file"`,
  );
}

function resolveSources(): Record<string, LicenceFile[]> {
  const entries = JSON.parse(readFileSync(SOURCES_PATH, 'utf8')) as Record<
    string,
    LicenceSourceEntry
  >;
  return Object.fromEntries(
    Object.entries(entries).map(([name, entry]) => [
      name,
      entry.sources.flatMap((source) => resolveSource(name, source)),
    ]),
  );
}

function unicodeNotice(): string {
  const text = readFileSync(UNICODE_PATH, 'utf8');
  const at = text.indexOf(UNICODE_START);
  if (at < 0)
    throw new Error(`gen-licences: i18n/UNICODE-LICENSE.txt has no "${UNICODE_START}" line`);
  return text.slice(at).trim();
}

async function main(): Promise<void> {
  const outDir = mkdtempSync(path.join(process.env.RUNNER_TEMP ?? tmpdir(), 'escuadra-licences-'));
  try {
    const folders = collectPackageFolders(exportSourceMaps(outDir));
    const { texts, packages } = buildLicenceData(folders.map(readPackage), resolveSources());
    const content = [
      '// GENERATED FILE — run `npm run gen:licences` to regenerate. Do not hand-edit.',
      "import type { BundledPackage } from './licencesView';",
      '',
      '/** i18n/UNICODE-LICENSE.txt from its "UNICODE LICENSE V3" line on, verbatim. */',
      `export const UNICODE_LICENSE = ${JSON.stringify(unicodeNotice())};`,
      '',
      '/** Every distinct licence text the bundled packages carry. */',
      `export const LICENCE_TEXTS: readonly string[] = ${JSON.stringify(texts)};`,
      '',
      '/** Every package Metro bundles into the iOS or Android app, by name then version. */',
      `export const PACKAGES: readonly BundledPackage[] = ${JSON.stringify(packages)};`,
      '',
    ].join('\n');
    await formatAndWrite(GENERATED_TS_PATH, content);
    console.log(
      `gen-licences: wrote ${packages.length} packages (${texts.length} licence texts) to lib/licences.generated.ts`,
    );
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}

await main();
