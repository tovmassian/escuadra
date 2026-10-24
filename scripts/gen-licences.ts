// Producer of lib/licences.generated.ts — run via `npm run gen:licences`. It writes
// that file: the Unicode notice and every package Metro bundles, or Expo autolinks
// (#160), into the iOS and Android apps, with their licence notices, for About →
// Licences. See
// docs/superpowers/specs/2026-10-20-licences-sheet-design.md.
//
// "Bundled" is read from the bundle itself: one production export with source
// maps, whose `sources` name every file Metro included. The lockfile would list
// some 640 packages, most of them build tools that never reach a phone. Packages
// whose native code is autolinked but ship no JavaScript are added from Expo's
// own autolinking resolution.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
// Shared with gen-squads and squadctl so every generated file is written
// through identical prettier options.
import { formatAndWrite } from '../tools/squadctl/src/lib/write-json.ts';
import {
  autolinkedPackageFolders,
  buildLicenceData,
  collectPackageFolders,
  isLicenceFile,
  orderLicenceFiles,
  sourceMapSources,
  type AutolinkingResolve,
  type LicenceFile,
  type PackageRead,
  type RnConfig,
  type SourceMap,
} from './licences.ts';
import {
  buildNativeData,
  catalogCoordinates,
  gradleCoordinates,
  matchesPattern,
  podDependencies,
  podspecName,
  type NativeEntry,
  type NativeScan,
} from './native-licences.ts';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const GENERATED_TS_PATH = path.join(REPO_ROOT, 'lib', 'licences.generated.ts');
const SOURCES_PATH = path.join(REPO_ROOT, 'scripts', 'licence-sources.json');
const UNICODE_PATH = path.join(REPO_ROOT, 'i18n', 'UNICODE-LICENSE.txt');
const UNICODE_START = 'UNICODE LICENSE V3';
const PLATFORMS = ['ios', 'android'] as const;
const NATIVE_PATH = path.join(REPO_ROOT, 'scripts', 'native-licences.json');
const RN = path.join(REPO_ROOT, 'node_modules', 'react-native');
// React Native's own copies of third-party code: scanned as dependencies, never
// counted as first-party pods.
const RN_THIRD_PARTY = ['third-party-podspecs', 'sdks'];
// A pod React Native's codegen writes at `pod install`, from first-party code and
// its templates in react-native/scripts/codegen/templates. Its podspec exists
// only after that, never in node_modules, so it is filtered like first-party pods.
const GENERATED_PODS = ['ReactAppDependencyProvider'];
// Published from npm packages already in PACKAGES, through their local Maven repos.
const FIRST_PARTY_ANDROID = [
  'com.facebook.react:react-android',
  'com.facebook.react:react-native',
  'host.exp.exponent:*',
  'expo.modules.*:*',
];
const NATIVE_FOLDERS = ['ios', 'android', 'apple', 'cpp', 'common'];
const SKIP_DIRS = new Set(['node_modules', 'build', '.gradle', '__tests__']);

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

// What Expo autolinks into each app: the same resolution `expo prebuild` and
// EAS Build use, read offline from node_modules, with no ios/ or android/ folder.
function autolinking(): { resolves: AutolinkingResolve[]; configs: RnConfig[] } {
  const run = (args: string[]): unknown =>
    JSON.parse(
      execFileSync('npx', ['expo-modules-autolinking', ...args, '--json'], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'inherit'],
        maxBuffer: 64 * 1024 * 1024,
      }),
    );
  return {
    resolves: PLATFORMS.map((p) => run(['resolve', '-p', p]) as AutolinkingResolve),
    configs: PLATFORMS.map((p) => run(['react-native-config', '-p', p]) as RnConfig),
  };
}

function filesUnder(dir: string, keep: (name: string) => boolean): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return SKIP_DIRS.has(e.name) ? [] : filesUnder(full, keep);
    return e.isFile() && keep(e.name) ? [full] : [];
  });
}

// The native dependencies the autolinked packages and React Native name, read from
// their podspecs and Gradle files, for the drift check against
// scripts/native-licences.json.
function scanNative(folders: readonly string[], notLinked: Record<string, string>): NativeScan {
  const roots = folders.map((f) => path.join(REPO_ROOT, f));
  const podspecs = [...roots, RN].flatMap((r) => filesUnder(r, (n) => n.endsWith('.podspec')));
  const thirdParty = (file: string): boolean =>
    file.startsWith(RN) && RN_THIRD_PARTY.some((d) => file.startsWith(path.join(RN, d)));
  const firstPartyPods = new Set([
    ...podspecs.filter((f) => !thirdParty(f)).map((f) => podspecName(path.basename(f))),
    ...GENERATED_PODS,
  ]);
  const ios = podspecs
    .flatMap((f) => podDependencies(readFileSync(f, 'utf8')))
    .filter((pod) => !firstPartyPods.has(pod));

  const gradles = roots.flatMap((r) =>
    filesUnder(path.join(r, 'android'), (n) => /^build\.gradle(\.kts)?$/.test(n)),
  );
  const toml = readFileSync(path.join(RN, 'gradle', 'libs.versions.toml'), 'utf8');
  const rnKts = [
    'ReactAndroid/build.gradle.kts',
    'ReactAndroid/hermes-engine/build.gradle.kts',
  ].map((f) => readFileSync(path.join(RN, f), 'utf8'));
  const android = [
    ...gradles.flatMap((f) => gradleCoordinates(readFileSync(f, 'utf8'))),
    ...rnKts.flatMap((kts) => catalogCoordinates(kts, toml)),
  ].filter((c) => !FIRST_PARTY_ANDROID.some((p) => matchesPattern(c, p)));

  const vendoredLicenceFiles = roots
    .flatMap((r) => NATIVE_FOLDERS.flatMap((d) => filesUnder(path.join(r, d), isLicenceFile)))
    .map((f) => path.relative(REPO_ROOT, f));
  return { ios, android, vendoredLicenceFiles, notLinked };
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
    const linked = autolinking();
    const linkedFolders = autolinkedPackageFolders(
      `${REPO_ROOT}/`,
      linked.resolves,
      linked.configs,
    );
    const folders = [
      ...new Set([...collectPackageFolders(exportSourceMaps(outDir)), ...linkedFolders]),
    ].sort();
    const { texts, packages } = buildLicenceData(folders.map(readPackage), resolveSources());

    const raw = JSON.parse(readFileSync(NATIVE_PATH, 'utf8')) as Record<string, unknown>;
    const notLinked = (raw.$notLinked ?? {}) as Record<string, string>;
    const entries = Object.fromEntries(
      Object.entries(raw).filter(([key]) => key !== '$notLinked'),
    ) as Record<string, NativeEntry>;
    const native = buildNativeData(entries, scanNative(linkedFolders, notLinked), texts, (file) =>
      readFileSync(path.join(REPO_ROOT, file), 'utf8'),
    );

    const content = [
      '// GENERATED FILE — run `npm run gen:licences` to regenerate. Do not hand-edit.',
      "import type { BundledPackage, NativeLibrary } from './licencesView';",
      '',
      '/** i18n/UNICODE-LICENSE.txt from its "UNICODE LICENSE V3" line on, verbatim. */',
      `export const UNICODE_LICENSE = ${JSON.stringify(unicodeNotice())};`,
      '',
      '/** Every distinct licence text the bundled packages and native libraries carry. */',
      `export const LICENCE_TEXTS: readonly string[] = ${JSON.stringify(native.texts)};`,
      '',
      '/** Every package Metro bundles, or Expo autolinks, into the iOS or Android app, by name then version. */',
      `export const PACKAGES: readonly BundledPackage[] = ${JSON.stringify(packages)};`,
      '',
      '/** Every third-party native library the iOS or Android build links (#160), by name. */',
      `export const NATIVE_LIBRARIES: readonly NativeLibrary[] = ${JSON.stringify(native.libraries)};`,
      '',
    ].join('\n');
    await formatAndWrite(GENERATED_TS_PATH, content);
    console.log(
      `gen-licences: wrote ${packages.length} packages, ${native.libraries.length} native libraries (${native.texts.length} licence texts) to lib/licences.generated.ts`,
    );
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}

await main();
