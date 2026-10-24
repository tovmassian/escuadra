# Native libraries' licence notices — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** About → Licences shows the notice of every native library the iOS and Android builds link, and `npm run check` fails when a new native dependency reaches the build unlisted (#160).

**Architecture:** Route A, chosen by the owner on 2026-10-24. Two sources feed `lib/licences.generated.ts`, both read by `npm run gen:licences`, offline. (1) **Autolinked npm packages**: Expo autolinking names every package whose native code is compiled into the app. They join `PACKAGES`, read from `node_modules` like the bundled ones, because some (expo-dev-launcher, expo-json-utils…) ship native code but no JavaScript, so the bundle's source maps miss them. (2) **Third-party native libraries** (pods, Maven artifacts, React Native's C++ dependencies, code vendored inside an npm package's native folders): hand-curated in `scripts/native-licences.json`, with texts copied verbatim into `scripts/licence-texts/native/`. The generator scans the podspecs and `build.gradle` files of the autolinked packages and fails on a direct dependency the list does not match. Indirect dependencies are curated once from a local prebuild inventory (this plan's appendix) and refreshed on an Expo SDK bump.

**Tech Stack:** Node 24 TypeScript scripts (no build step), Vitest, Expo SDK 58 autolinking CLI (`npx expo-modules-autolinking`), React Native.

**Spec:** `docs/superpowers/specs/2026-10-20-licences-sheet-design.md` (the sheet and the generator this extends) plus issue #160 (route A). Owner's decisions of 2026-10-24, binding:

- Route A: a curated list with a drift check, no EAS build.
- Indirect native dependencies are curated from a local `npx expo prebuild` inventory (Gradle `releaseRuntimeClasspath`; on iOS the podspecs plus the CocoaPods trunk, since CocoaPods cannot be installed on the owner's machine).
- A native allowlist, separate from `ALLOWED_LICENCES`: `Apache-2.0`, `MIT`, `BSD-2-Clause`, `BSD-3-Clause`, `BSL-1.0`, `bzip2-1.0.6`.
- Google's proprietary Play libraries (In-App Review, Play services) are **named, with their terms**, and carry no licence text.

## Global Constraints

- Run `nvm use` (Node 24) before any `node` or `npm` command. In this worktree, `export PATH="$HOME/.nvm/versions/node/v24.21.0/bin:$PATH"` does the same.
- `npm run check` must not need the network. Autolinking resolution is offline. The generator already sets `EXPO_OFFLINE=1` for the export.
- No new npm script, no dependency change, no `.gitignore` line, no `app.json`/`eas.json` change (fingerprint).
- Widening either allowlist is the owner's decision. A licence outside `NATIVE_ALLOWED_LICENCES` stops the work and goes to the owner. Never widen it to make the check pass.
- Licence texts are copied **verbatim** from the upstream repository at the shipped tag, with their URL recorded. Never retype or summarise one.
- `ALLOWED_LICENCES` (JavaScript) stays as it is.
- No hardcoded colour, spacing or font size (guardrail 5). No new user-visible catalog text: native rows join the existing **Software** section, so no catalog key, translation or About hash changes.
- Native rows show **no version**. Pods float within their podspec ranges (EAS resolves them fresh on each build, with no committed `Podfile.lock`), and a licence notice does not depend on a version. This is a design tradeoff to flag in the PR.
- Prettier formats everything (`npm run format:check` is part of `check`). TypeScript strict, `noUncheckedIndexedAccess` stays on.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and carry `(#160)`.

---

## File structure

| File                                                                 | Responsibility                                                                                                                                         |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `scripts/native-licences.ts` (new)                                   | Pure half for native libraries: dependency extraction from podspec, Gradle and version-catalog text, pattern matching, validation, sheet data. No I/O. |
| `scripts/__tests__/native-licences.test.ts` (new)                    | Its unit tests, in memory.                                                                                                                             |
| `scripts/licences.ts`                                                | Gains `autolinkedPackageFolders` (pure) to merge autolinked packages into `PACKAGES`.                                                                  |
| `scripts/gen-licences.ts`                                            | I/O: runs autolinking, reads podspecs, `build.gradle` files and RN's version catalog, reads the curated list, writes `NATIVE_LIBRARIES`.               |
| `scripts/native-licences.json` (new)                                 | The curated list: one entry per upstream project.                                                                                                      |
| `scripts/licence-texts/native/*` (new)                               | Verbatim licence and NOTICE texts for those entries.                                                                                                   |
| `lib/licencesView.ts`                                                | `NativeLibrary` type, `softwareRows` (one alphabetical list of packages and native libraries).                                                         |
| `lib/licences.generated.ts`                                          | Regenerated: autolinked packages added, `NATIVE_LIBRARIES` exported.                                                                                   |
| `app/licences.tsx`                                                   | Renders `softwareRows`.                                                                                                                                |
| `docs/license.md`, `.claude/rules/licensing.md`, `design/SCREENS.md` | Docs.                                                                                                                                                  |

---

### Task 1: The native pure half (`scripts/native-licences.ts`)

**Files:**

- Create: `scripts/native-licences.ts`
- Create: `scripts/__tests__/native-licences.test.ts`

**Interfaces:**

- Consumes: `copyrightLines` is **not** used, because native copyright lines are curated. `NativeLibrary` comes from `lib/licencesView.ts`, which this task adds there (see Step 3).
- Produces:
  - `NATIVE_ALLOWED_LICENCES: readonly string[]`
  - `podDependencies(podspec: string): string[]`: the root pod names a podspec depends on, excluding test specs.
  - `podspecName(fileName: string): string`: `'RCT-Folly.podspec'` → `'RCT-Folly'`.
  - `gradleCoordinates(gradle: string): string[]`: `group:artifact` of every `implementation`/`api` dependency given as a quoted coordinate.
  - `catalogCoordinates(gradleKts: string, toml: string): string[]`: `group:artifact` of every `implementation(libs.x)`/`api(libs.x)` in a Gradle Kotlin file, through the version catalog.
  - `matchesPattern(name: string, pattern: string): boolean`: `*` matches any run of characters.
  - `interface NativeEntry`, `interface NativeScan`, `buildNativeData(entries, scan, texts, readText): NativeData` (types below).

- [ ] **Step 1: Write the failing tests**

`scripts/__tests__/native-licences.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  NATIVE_ALLOWED_LICENCES,
  buildNativeData,
  catalogCoordinates,
  gradleCoordinates,
  matchesPattern,
  podDependencies,
  podspecName,
  type NativeEntry,
  type NativeScan,
} from '../native-licences';

const MIT = 'MIT License\n\nCopyright (c) 2016 Someone\n\nPermission is hereby granted.\n';
const APACHE = 'Apache License\nVersion 2.0, January 2004\n';
const texts: Record<string, string> = {
  'scripts/licence-texts/native/a.LICENSE': MIT,
  'scripts/licence-texts/native/apache-2.0.LICENSE': APACHE,
};
const readText = (file: string): string => {
  const text = texts[file];
  if (text === undefined) throw new Error(`no such file: ${file}`);
  return text;
};
const entry = (over: Partial<NativeEntry> = {}): NativeEntry => ({
  licence: 'MIT',
  platforms: ['ios'],
  found: 'scan',
  matches: { ios: ['A*'] },
  via: 'expo-image',
  copyright: 'Copyright (c) 2016 Someone',
  files: [{ file: 'scripts/licence-texts/native/a.LICENSE', url: 'https://example.org/a/LICENSE' }],
  ...over,
});
const scan = (over: Partial<NativeScan> = {}): NativeScan => ({
  ios: ['ALib'],
  android: [],
  vendoredLicenceFiles: [],
  notLinked: {},
  ...over,
});

describe('podDependencies', () => {
  it('reads s., spec. and ss. dependencies, reduced to their root pod', () => {
    const podspec = [
      'Pod::Spec.new do |s|',
      "  s.dependency 'ExpoModulesCore'",
      "  s.dependency 'SDWebImage', '~> 5.21.0'",
      "  s.dependency 'libavif/libdav1d' unless disable_libdav1d",
      '  spec.dependency "boost"',
      "  s.subspec 'x' do |ss|",
      "    ss.dependency 'React-Core/Default'",
      '  end',
      "  s.test_spec 'Tests' do |test_spec|",
      "    test_spec.dependency 'OHHTTPStubs'",
      '  end',
      'end',
    ].join('\n');
    expect(podDependencies(podspec)).toEqual([
      'ExpoModulesCore',
      'SDWebImage',
      'libavif',
      'boost',
      'React-Core',
    ]);
  });
  it('ignores commented-out lines', () => {
    expect(podDependencies("  # s.dependency 'Old'\n  s.dependency 'New'")).toEqual(['New']);
  });
});

it('names a pod by its podspec file', () => {
  expect(podspecName('RCT-Folly.podspec')).toBe('RCT-Folly');
});

describe('gradleCoordinates', () => {
  it('reads implementation and api coordinates, quoted either way, with or without parentheses', () => {
    const gradle = [
      'dependencies {',
      '  implementation "com.google.android.play:review:2.0.1"',
      "  api 'com.caverock:androidsvg-aar:1.4'",
      '  api "com.github.bumptech.glide:glide:${GLIDE_VERSION}"',
      '  implementation("com.squareup.okhttp3:okhttp:4.9.2")',
      "  implementation 'com.facebook.react:react-native:+'",
      '  implementation "com.facebook.react:react-android"',
      "  implementation project(':expo-modules-core')",
      '  debugImplementation "com.example:debug-only:1.0"',
      '  testImplementation "junit:junit:4.13"',
      '  compileOnly "com.example:compile-only:1.0"',
      '}',
    ].join('\n');
    expect(gradleCoordinates(gradle)).toEqual([
      'com.google.android.play:review',
      'com.caverock:androidsvg-aar',
      'com.github.bumptech.glide:glide',
      'com.squareup.okhttp3:okhttp',
      'com.facebook.react:react-native',
      'com.facebook.react:react-android',
    ]);
  });
  it('ignores commented-out lines', () => {
    expect(gradleCoordinates('  // implementation "a:b:1"\n  implementation "c:d:1"')).toEqual([
      'c:d',
    ]);
  });
});

describe('catalogCoordinates', () => {
  it('maps libs.x aliases through the [libraries] table, module or group/name form', () => {
    const toml = [
      '[versions]',
      'fresco = "3.6.0"',
      '[libraries]',
      'fresco-middleware = { module = "com.facebook.fresco:middleware", version.ref = "fresco" }',
      'androidx-profileinstaller = { group = "androidx.profileinstaller", name = "profileinstaller", version.ref = "p" }',
      'junit = {module = "junit:junit", version.ref = "junit" }',
      '[plugins]',
    ].join('\n');
    const kts = [
      '  api(libs.fresco.middleware)',
      '  implementation(libs.androidx.profileinstaller)',
      '  testImplementation(libs.junit)',
    ].join('\n');
    expect(catalogCoordinates(kts, toml)).toEqual([
      'com.facebook.fresco:middleware',
      'androidx.profileinstaller:profileinstaller',
    ]);
  });
  it('fails on an alias the catalog does not define', () => {
    expect(() => catalogCoordinates('api(libs.nope)', '[libraries]\n')).toThrow(/libs\.nope/);
  });
});

describe('matchesPattern', () => {
  it('matches exactly without a star', () => {
    expect(matchesPattern('SDWebImage', 'SDWebImage')).toBe(true);
    expect(matchesPattern('SDWebImageWebPCoder', 'SDWebImage')).toBe(false);
  });
  it('lets a star match any run, dots included', () => {
    expect(matchesPattern('androidx.core:core-ktx', 'androidx.*:*')).toBe(true);
    expect(matchesPattern('org.jetbrains.kotlin:kotlin-stdlib', 'org.jetbrains.kotlin:*')).toBe(
      true,
    );
    expect(
      matchesPattern('org.jetbrains.kotlinx:kotlinx-coroutines-core', 'org.jetbrains.kotlin:*'),
    ).toBe(false);
  });
});

it('allows exactly the six licences and the two Google terms the owner accepted', () => {
  expect([...NATIVE_ALLOWED_LICENCES].sort()).toEqual(
    [
      'Android Software Development Kit License',
      'Apache-2.0',
      'BSD-2-Clause',
      'BSD-3-Clause',
      'BSL-1.0',
      'MIT',
      'Play Core Software Development Kit Terms of Service',
      'bzip2-1.0.6',
    ].sort(),
  );
});

describe('buildNativeData', () => {
  it('builds a sorted list with interned texts, appended after the existing ones', () => {
    const data = buildNativeData(
      {
        Zeta: entry({ matches: { ios: ['Zeta'] } }),
        Alpha: entry({ matches: { ios: ['ALib'] } }),
      },
      scan({ ios: ['ALib', 'Zeta'] }),
      ['existing text'],
      readText,
    );
    expect(data.texts).toEqual(['existing text', MIT.trim()]);
    expect(data.libraries.map((l) => l.name)).toEqual(['Alpha', 'Zeta']);
    expect(data.libraries[0]).toEqual({
      name: 'Alpha',
      platforms: ['ios'],
      licence: 'MIT',
      copyright: 'Copyright (c) 2016 Someone',
      texts: [1],
    });
  });

  it('reuses an existing text index for an identical text', () => {
    // The package half hands over its texts already normalised (trimmed).
    const data = buildNativeData({ A: entry() }, scan(), [MIT.trim()], readText);
    expect(data.libraries[0]?.texts).toEqual([0]);
  });

  it('accepts a proprietary Google entry with no text', () => {
    const data = buildNativeData(
      {
        'Google Play In-App Review': entry({
          licence: 'Play Core Software Development Kit Terms of Service',
          platforms: ['android'],
          matches: { android: ['com.google.android.play:*'] },
          copyright: 'Google LLC',
          files: [],
        }),
      },
      scan({ ios: [], android: ['com.google.android.play:review'] }),
      [],
      readText,
    );
    expect(data.libraries[0]?.texts).toEqual([]);
  });

  it('skips a dependency named in notLinked', () => {
    expect(() =>
      buildNativeData(
        { A: entry() },
        scan({ ios: ['ALib', 'sqlite3'], notLinked: { sqlite3: 'why' } }),
        [],
        readText,
      ),
    ).not.toThrow();
  });

  it('lists every problem at once', () => {
    const run = () =>
      buildNativeData(
        {
          Bad: entry({ licence: 'GPL-3.0', matches: { ios: ['Bad'] } }),
          NoText: entry({ matches: { ios: ['NoText'] }, files: [] }),
          NoCopyright: entry({ matches: { ios: ['NoCopyright'] }, copyright: '' }),
          Dead: entry({ matches: { ios: ['Gone'] } }),
          Inventory: entry({ found: 'inventory', matches: { android: ['x:y'] } }),
          Vendored: entry({
            found: 'vendored',
            matches: {},
            vendored: ['node_modules/p/android/LICENSE'],
          }),
        },
        scan({
          ios: ['Bad', 'NoText', 'NoCopyright', 'Unlisted'],
          vendoredLicenceFiles: ['node_modules/p/android/LICENSE', 'node_modules/q/ios/LICENSE'],
        }),
        [],
        readText,
      );
    expect(run).toThrow(/6 problem\(s\)/);
    expect(run).toThrow(/Bad: licence "GPL-3.0" is not on the native allowlist/);
    expect(run).toThrow(/NoText: an open licence needs its text/);
    expect(run).toThrow(/NoCopyright: no copyright/);
    expect(run).toThrow(/Dead: found by "scan", but no scanned dependency matches it/);
    expect(run).toThrow(/ios dependency "Unlisted" is not in scripts\/native-licences\.json/);
    expect(run).toThrow(
      /node_modules\/q\/ios\/LICENSE: a licence file inside a native folder that no entry claims/,
    );
  });

  it('does not report inventory or vendored entries as dead', () => {
    expect(() =>
      buildNativeData(
        { A: entry(), I: entry({ found: 'inventory', matches: { android: ['x:y'] } }) },
        scan(),
        [],
        readText,
      ),
    ).not.toThrow();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run scripts/__tests__/native-licences.test.ts`
Expected: FAIL, `Cannot find module '../native-licences'`.

- [ ] **Step 3: Add the `NativeLibrary` type to `lib/licencesView.ts`**

Insert after the `BundledPackage` interface:

```ts
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
```

- [ ] **Step 4: Write `scripts/native-licences.ts`**

```ts
// The pure half of the native libraries' notices (#160): from the podspecs and
// Gradle files of the packages Expo autolinks, and the hand-curated
// scripts/native-licences.json, the data the Licences sheet shows. No I/O here,
// so every rule is unit-tested without a prebuild. See docs/license.md.
import type { NativeLibrary } from '../lib/licencesView.ts';

// Decided by the owner on 2026-10-24 (#160): the licences the native libraries
// already shipping are under, and the terms of Google's proprietary Play
// libraries, which are named in the sheet with no text. Widening it is the
// owner's decision, like ALLOWED_LICENCES.
export const NATIVE_ALLOWED_LICENCES: readonly string[] = [
  'Apache-2.0',
  'MIT',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'BSL-1.0',
  'bzip2-1.0.6',
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
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run scripts/__tests__/native-licences.test.ts`
Expected: PASS. If the count in "lists every problem at once" is off, fix the code, not the test: the test lists exactly six problems.

- [ ] **Step 6: Typecheck and format**

Run: `npm run typecheck && npx prettier --write scripts/native-licences.ts scripts/__tests__/native-licences.test.ts lib/licencesView.ts`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add scripts/native-licences.ts scripts/__tests__/native-licences.test.ts lib/licencesView.ts
git commit -m "feat(licences): the native libraries' pure half and drift rules (#160)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Autolinked packages join `PACKAGES`

Some autolinked packages ship native code but no JavaScript, so the source maps miss them: on 2026-10-24 that meant expo-dev-launcher, expo-dev-menu, expo-dev-menu-interface, expo-json-utils, expo-manifests, expo-structured-headers, expo-eas-client, expo-updates-interface, expo-modules-jsi and @expo/log-box, among others. They are npm packages with `node_modules` licences, so they join the existing package list under the existing rules.

**Files:**

- Modify: `scripts/licences.ts` (add `autolinkedPackageFolders`)
- Modify: `scripts/__tests__/licences.test.ts`
- Modify: `scripts/gen-licences.ts`
- Modify: `scripts/licence-sources.json` (only if the generator demands it)
- Regenerate: `lib/licences.generated.ts`

**Interfaces:**

- Consumes: `packageFolderFromSource(source: string): string | null` (existing, `scripts/licences.ts`).
- Produces:
  - `interface AutolinkingResolve { modules: { packageName: string; pods?: { podName: string; podspecDir: string }[]; projects?: { name: string; sourceDir: string }[] }[] }`
  - `interface RnConfig { dependencies: Record<string, { root: string; platforms: { ios?: { podspecPath?: string } | null; android?: { sourceDir?: string } | null } }> }`
  - `autolinkedPackageFolders(repoRoot: string, resolves: AutolinkingResolve[], configs: RnConfig[]): string[]`: package folders relative to the repo root (`node_modules/expo-json-utils`, `node_modules/expo/node_modules/expo-modules-core`), sorted, unique.
  - In `gen-licences.ts`: `function autolinking(): { resolves: AutolinkingResolve[]; configs: RnConfig[] }`, reused by Task 4.

- [ ] **Step 1: Write the failing test** (append to `scripts/__tests__/licences.test.ts`, adding `autolinkedPackageFolders` to the import)

```ts
describe('autolinkedPackageFolders', () => {
  const root = '/repo';
  it('reduces Expo pods and projects and RN dependencies to package folders, nested ones kept', () => {
    expect(
      autolinkedPackageFolders(
        root,
        [
          {
            modules: [
              {
                packageName: 'expo-json-utils',
                pods: [
                  { podName: 'EXJSONUtils', podspecDir: '/repo/node_modules/expo-json-utils/ios' },
                ],
              },
              {
                packageName: 'expo-modules-core',
                projects: [
                  {
                    name: 'expo-modules-core',
                    sourceDir: '/repo/node_modules/expo/node_modules/expo-modules-core/android',
                  },
                ],
              },
            ],
          },
        ],
        [
          {
            dependencies: {
              'react-native-svg': {
                root: '/repo/node_modules/react-native-svg',
                platforms: { ios: {}, android: {} },
              },
            },
          },
        ],
      ),
    ).toEqual([
      'node_modules/expo-json-utils',
      'node_modules/expo/node_modules/expo-modules-core',
      'node_modules/react-native-svg',
    ]);
  });
  it('skips an RN dependency with no native side on either platform', () => {
    expect(
      autolinkedPackageFolders(
        root,
        [],
        [
          {
            dependencies: {
              'js-only': {
                root: '/repo/node_modules/js-only',
                platforms: { ios: null, android: null },
              },
            },
          },
        ],
      ),
    ).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run scripts/__tests__/licences.test.ts -t autolinkedPackageFolders`
Expected: FAIL, `autolinkedPackageFolders is not a function` (or an import error).

- [ ] **Step 3: Implement it in `scripts/licences.ts`** (after `collectPackageFolders`)

```ts
/** `npx expo-modules-autolinking resolve -p <platform> --json`, the parts read here. */
export interface AutolinkingResolve {
  modules: {
    packageName: string;
    pods?: { podName: string; podspecDir: string }[];
    projects?: { name: string; sourceDir: string }[];
  }[];
}

/** `npx expo-modules-autolinking react-native-config -p <platform> --json`, the parts read here. */
export interface RnConfig {
  dependencies: Record<
    string,
    {
      root: string;
      platforms: {
        ios?: { podspecPath?: string } | null;
        android?: { sourceDir?: string } | null;
      };
    }
  >;
}

/**
 * The package folders whose native code Expo autolinks into either app (#160).
 * Some ship no JavaScript, so the bundle's source maps never name them.
 */
export function autolinkedPackageFolders(
  repoRoot: string,
  resolves: readonly AutolinkingResolve[],
  configs: readonly RnConfig[],
): string[] {
  const relative = (p: string): string => (p.startsWith(repoRoot) ? p.slice(repoRoot.length) : p);
  const paths = [
    ...resolves.flatMap((r) =>
      r.modules.flatMap((m) => [
        ...(m.pods ?? []).map((pod) => `${pod.podspecDir}/x`),
        ...(m.projects ?? []).map((project) => `${project.sourceDir}/x`),
      ]),
    ),
    ...configs.flatMap((c) =>
      Object.values(c.dependencies)
        .filter((d) => d.platforms.ios || d.platforms.android)
        .map((d) => `${d.root}/x`),
    ),
  ];
  return collectPackageFolders(paths.map(relative));
}
```

(`collectPackageFolders` reduces each path to its last `node_modules/<name>` folder, keeps nested ones, sorts and de-duplicates. The `/x` suffix makes the folder itself a "source" inside it.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run scripts/__tests__/licences.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire it into `scripts/gen-licences.ts`**

Add to the imports from `./licences.ts`: `autolinkedPackageFolders, type AutolinkingResolve, type RnConfig`. Add after `exportSourceMaps`:

```ts
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
```

In `main()`, replace the `folders` line with:

```ts
const linked = autolinking();
const folders = [
  ...new Set([
    ...collectPackageFolders(exportSourceMaps(outDir)),
    ...autolinkedPackageFolders(`${REPO_ROOT}/`, linked.resolves, linked.configs),
  ]),
].sort();
```

Update the `PACKAGES` doc comment written into the file to: `'/** Every package Metro bundles, or Expo autolinks, into the iOS or Android app, by name then version. */'`. Update the file's header comment to say the list also holds the packages Expo autolinks (#160).

- [ ] **Step 6: Run the generator and resolve what it reports**

Run: `npm run gen:licences`
Expected: either it writes the file, or it fails listing problems. For each problem, follow `docs/license.md` → Software licences. Most likely: an Expo module published without a `LICENSE` file. Add a `scripts/licence-sources.json` entry `{ "reason": "Published from the Expo repository under its MIT LICENSE.", "sources": [{ "from": "expo" }] }` after confirming the package's `package.json` `repository` is `expo/expo` and its `license` is `MIT`. A licence outside `ALLOWED_LICENCES` is **not** fixed here: stop and report it to the owner.

- [ ] **Step 7: Check the result**

Run: `git diff --stat lib/licences.generated.ts && npx vitest run lib/__tests__/licencesView.test.ts`
Expected: the generated file gains the autolinked packages (expo-dev-launcher, expo-json-utils, … appear in `PACKAGES`). Tests PASS.

- [ ] **Step 8: Commit**

```bash
npx prettier --write scripts/licences.ts scripts/__tests__/licences.test.ts scripts/gen-licences.ts scripts/licence-sources.json
git add scripts/licences.ts scripts/__tests__/licences.test.ts scripts/gen-licences.ts scripts/licence-sources.json lib/licences.generated.ts
git commit -m "feat(licences): packages Expo autolinks join the list, JavaScript or not (#160)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Curate `scripts/native-licences.json` and its texts

The research task: one entry per upstream project in the appendix inventory, with its licence text copied verbatim. **This task needs the network** (GitHub raw files, Maven Central POMs). `npm run check` never does.

**Files:**

- Create: `scripts/native-licences.json`
- Create: `scripts/licence-texts/native/<id>.LICENSE`, and `<id>.NOTICE` where the project has one

**Interfaces:**

- Consumes: `NativeEntry` (Task 1) is the shape of each value.
- Produces: the file Task 4 reads. Its keys are display names. Its pattern grammar is `matchesPattern`'s.

**Rules for every entry:**

1. **One entry per upstream project** (one repository, one licence). AndroidX is one entry (`androidx.*:*`, Apache-2.0, `https://android.googlesource.com/platform/frameworks/support/+/refs/heads/androidx-main/LICENSE.txt`); Kotlin is one (`org.jetbrains.kotlin:*`); kotlinx.coroutines another (`org.jetbrains.kotlinx:kotlinx-coroutines-*`). Each SDWebImage repository (SDWebImage, SDWebImageAVIFCoder, SDWebImageSVGCoder, SDWebImageWebPCoder) is its own entry, since each has its own LICENSE and copyright.
2. **`licence`** is the SPDX id the project's own LICENSE file states, checked against the file and not just the POM or podspec. Glide is BSD, MIT and Apache combined: read its LICENSE and record the id that matches it. If a project's licence is none of `NATIVE_ALLOWED_LICENCES`, **stop and report it to the owner**. Do not add it.
3. **`files`**: the LICENSE (and NOTICE, if the repository has one, as Apache-2.0 asks) fetched raw at the tag matching the shipped version (from the appendix), saved byte for byte to `scripts/licence-texts/native/<kebab-id>.LICENSE` / `.NOTICE`, with `url` pointing at that tag's file. An Apache-2.0 project whose LICENSE is the bare Apache text still gets its own file. The generator de-duplicates identical texts.
4. **`copyright`**: verbatim from the LICENSE, else the NOTICE, else the main source files' header (e.g. `Copyright (C) The Android Open Source Project` for AndroidX). Never invented. For Google's proprietary libraries, the organisation the POM names.
5. **`found`**: `scan` when the drift scan (Task 4) sees one of its `matches` directly, `inventory` when only the appendix inventory shows it (an indirect dependency), `vendored` for code inside an npm package's native folders.
6. **`via`**: the npm package(s) that pull it in, e.g. `"expo-image"`, `"react-native"`, `"expo-updates"`.
7. **Google's proprietary libraries** (decided: named, with their terms): `"Google Play In-App Review"` with `licence: "Play Core Software Development Kit Terms of Service"`, matching `com.google.android.play:*`; `"Google Play services"` with `licence: "Android Software Development Kit License"`, matching `com.google.android.gms:*`. Read each artifact's POM `<licenses>` on Maven (`https://dl.google.com/dl/android/maven2/com/google/android/play/review/2.0.1/review-2.0.1.pom`, and the same for `core-common`, `play-services-basement`, `play-services-tasks`, `play-services-base`) to confirm the terms' names. If a POM names other terms, **stop and report to the owner**. `files: []`.

**Vendored code found on 2026-10-24** (each becomes a `found: "vendored"` entry, after reading the code to confirm its licence):

| Where                                                                                                                  | What                     | Likely licence                                                             |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------- |
| `node_modules/expo-updates/vendor/bspatch/LICENSE`                                                                     | bspatch (Colin Percival) | BSD-2-Clause                                                               |
| `node_modules/expo-updates/android/src/main/cpp/third-party/bzip2/LICENSE`                                             | bzip2 (Julian Seward)    | bzip2-1.0.6                                                                |
| `node_modules/expo-updates/ios/**` headers "Filippo Maguolo"                                                           | ASN1Decoder, vendored    | MIT (confirm)                                                              |
| `node_modules/expo-structured-headers/android/LICENSE`                                                                 | read it                  | read it                                                                    |
| `node_modules/expo-image/**` headers "Joe Drago"                                                                       | libavif-derived code     | BSD-2-Clause (confirm)                                                     |
| `node_modules/expo-image/**` headers "please view the LICENSE"                                                         | SDWebImage-derived code  | MIT, covered by the SDWebImage entry: add the files to its `vendored`      |
| `node_modules/react-native-worklets/**` header "Juan Palacios"                                                         | read it                  | read it                                                                    |
| `node_modules/react-native/**` header "Daniel Kirchner"                                                                | read it                  | read it                                                                    |
| `node_modules/expo-dev-menu`, `react-native`, `react-native-gesture-handler` headers "The Android Open Source Project" | AOSP snippets            | Apache-2.0: one `"Android Open Source Project"` entry, `found: "vendored"` |

`vendored` lists only the licence **files** the scan finds (Task 4 scans licence files under `ios/`, `android/`, `apple/`, `cpp/` and `common/` of autolinked packages). Code known only from headers gets an entry with `vendored` omitted.

**`notLinked`** is not part of `native-licences.json`'s entries. Put it under a reserved top-level key `"$notLinked"`, which Task 4 reads and strips, e.g. `{ "sqlite3": "expo-updates adds it only when expo.updates.useThirdPartySQLitePod is true, which app.json does not set" }`. Confirm that in `app.json` and `node_modules/expo-updates/ios/EXUpdates.podspec`.

- [ ] **Step 1: Write the iOS entries** from the appendix's iOS table: SDWebImage (four entries), libavif, libdav1d, libwebp, ReachabilitySwift, Folly (`RCT-Folly`), boost, glog, DoubleConversion, fmt, fast_float, SocketRocket, Hermes (`hermes-engine`). For React Native's C++ dependencies, `platforms: ["ios", "android"]`: React Native's Android `.so` files link the same libraries. On Android they are `found` through iOS's scan. Also `"$notLinked"`.
- [ ] **Step 2: Write the Android entries** from the appendix's Android groups. Group artifacts per upstream project (rule 1). The groups `host.exp.exponent`, `expo.modules.*` and `com.facebook.react:react-android` are first-party npm packages (Task 4 filters them), not entries. Hermes's Android artifact `com.facebook.hermes:*` joins the Hermes entry's `android` matches.
- [ ] **Step 3: Write the vendored entries** from the table above.
- [ ] **Step 4: Fetch every text** with `curl -fsSL <raw-url> -o scripts/licence-texts/native/<id>.LICENSE`, one per entry, then open each and confirm it is the licence text and not an HTML page.
- [ ] **Step 5: Validate the JSON shape**: `node -e "const j=require('./scripts/native-licences.json'); for (const [k,v] of Object.entries(j)) if (k!=='\$notLinked' && (!v.licence||!v.platforms||!v.found||!v.copyright||!v.files)) console.log('bad', k)"` prints nothing.
- [ ] **Step 6: Commit**

```bash
npx prettier --write scripts/native-licences.json
git add scripts/native-licences.json scripts/licence-texts/native
git commit -m "feat(licences): the native libraries the builds link, with their licence texts (#160)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The generator scans and writes `NATIVE_LIBRARIES`

**Files:**

- Modify: `scripts/gen-licences.ts`
- Regenerate: `lib/licences.generated.ts`

**Interfaces:**

- Consumes: `autolinking()` (Task 2); `podDependencies`, `podspecName`, `gradleCoordinates`, `catalogCoordinates`, `buildNativeData`, `NativeEntry`, `NativeScan` (Task 1); `scripts/native-licences.json` (Task 3); `isLicenceFile` (existing, `scripts/licences.ts`).
- Produces: `export const NATIVE_LIBRARIES: readonly NativeLibrary[]` in `lib/licences.generated.ts`. `LICENCE_TEXTS` holds both halves' texts.

- [ ] **Step 1: Add the scan to `scripts/gen-licences.ts`**

```ts
const NATIVE_PATH = path.join(REPO_ROOT, 'scripts', 'native-licences.json');
const RN = path.join(REPO_ROOT, 'node_modules', 'react-native');
// React Native's own copies of third-party code: scanned as dependencies, never
// counted as first-party pods.
const RN_THIRD_PARTY = ['third-party-podspecs', 'sdks'];
// Published from npm packages already in PACKAGES, through their local Maven repos.
const FIRST_PARTY_ANDROID = [
  'com.facebook.react:react-android',
  'com.facebook.react:react-native',
  'host.exp.exponent:*',
  'expo.modules.*:*',
];
const NATIVE_FOLDERS = ['ios', 'android', 'apple', 'cpp', 'common'];
const SKIP_DIRS = new Set(['node_modules', 'build', '.gradle', '__tests__']);

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

function scanNative(folders: readonly string[], notLinked: Record<string, string>): NativeScan {
  const roots = folders.map((f) => path.join(REPO_ROOT, f));
  const podspecs = [...roots, RN].flatMap((r) => filesUnder(r, (n) => n.endsWith('.podspec')));
  const thirdParty = (file: string): boolean =>
    file.startsWith(RN) && RN_THIRD_PARTY.some((d) => file.startsWith(path.join(RN, d)));
  const firstPartyPods = new Set(
    podspecs.filter((f) => !thirdParty(f)).map((f) => podspecName(path.basename(f))),
  );
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
```

Import `matchesPattern`, `podDependencies`, `podspecName`, `gradleCoordinates`, `catalogCoordinates`, `buildNativeData`, `type NativeEntry`, `type NativeScan` from `./native-licences.ts`, and `isLicenceFile` from `./licences.ts`.

In `main()`, after `buildLicenceData`:

```ts
const raw = JSON.parse(readFileSync(NATIVE_PATH, 'utf8')) as Record<string, unknown>;
const notLinked = (raw.$notLinked ?? {}) as Record<string, string>;
const entries = Object.fromEntries(
  Object.entries(raw).filter(([key]) => key !== '$notLinked'),
) as Record<string, NativeEntry>;
const native = buildNativeData(
  entries,
  scanNative(autolinkedPackageFolders(`${REPO_ROOT}/`, linked.resolves, linked.configs), notLinked),
  texts,
  (file) => readFileSync(path.join(REPO_ROOT, file), 'utf8'),
);
```

Write `native.texts` as `LICENCE_TEXTS` (it starts with the package texts, so their indices are unchanged), and add, after `PACKAGES`:

```ts
      '/** Every third-party native library the iOS or Android build links (#160), by name. */',
      `export const NATIVE_LIBRARIES: readonly NativeLibrary[] = ${JSON.stringify(native.libraries)};`,
```

The generated import line becomes `"import type { BundledPackage, NativeLibrary } from './licencesView';"`. The log line adds `${native.libraries.length} native libraries`.

- [ ] **Step 2: Run the generator**

Run: `npm run gen:licences`
Expected, the first time: a problem list. Resolve each:

- `dependency "X" is not in scripts/native-licences.json`: a direct dependency Task 3 missed or grouped under the wrong pattern. Curate it by Task 3's rules. If the pod is first-party, handle it by kind:
  - A podspec in an autolinked package whose file name differs from its `s.name`: make `firstPartyPods` read `s.name` too.
  - A pod React Native **generates at `pod install`** (expected: `React-Codegen`, `ReactCodegen`, `ReactAppDependencyProvider`): add it to a `GENERATED_PODS` constant in `gen-licences.ts`, with a comment saying codegen writes it from first-party code, and filter it like `firstPartyPods`.
  - A pod on a path the app does not take (expected: `React-jsc`, since the app runs Hermes): add it to `"$notLinked"` with the reason.

  Never add a broad `*` pattern just to silence a report.

- `found by "scan", but no scanned dependency matches it`: change that entry to `inventory`, since the scan cannot see it.
- `a licence file inside a native folder that no entry claims`: add it to the right entry's `vendored`, after reading it.

- [ ] **Step 3: Check the drift check bites**

Temporarily add `  s.dependency 'Unlisted'` to `node_modules/expo-image/ios/ExpoImage.podspec`. Run `npm run gen:licences`. Expected: FAIL with `ios dependency "Unlisted" is not in scripts/native-licences.json`. Remove the line, then run `npm run gen:licences` again. Expected: passes. Do the same with `  implementation "com.example:unlisted:1.0"` in `node_modules/expo-image/android/build.gradle`. Record both runs' output for the PR body.

- [ ] **Step 4: Commit**

```bash
npx prettier --write scripts/gen-licences.ts scripts/native-licences.json
git add scripts/gen-licences.ts scripts/native-licences.json lib/licences.generated.ts
git commit -m "feat(licences): gen-licences checks native dependencies and writes their notices (#160)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The sheet shows the native libraries

**Files:**

- Modify: `lib/licencesView.ts` (add `softwareRows`)
- Modify: `lib/__tests__/licencesView.test.ts`
- Modify: `app/licences.tsx`

**Interfaces:**

- Consumes: `BundledPackage`, `NativeLibrary`, `packageKey` (`lib/licencesView.ts`); `NATIVE_LIBRARIES`, `PACKAGES`, `LICENCE_TEXTS` (`lib/licences.generated.ts`); `NATIVE_ALLOWED_LICENCES` (`scripts/native-licences.ts`).
- Produces: `interface SoftwareRow { key: string; title: string; meta: string; texts: readonly number[] }` and `softwareRows(packages: readonly BundledPackage[], natives: readonly NativeLibrary[]): SoftwareRow[]`.

- [ ] **Step 1: Write the failing tests** (append to `lib/__tests__/licencesView.test.ts`; extend the imports with `softwareRows`, `NATIVE_LIBRARIES` and `NATIVE_ALLOWED_LICENCES` from `'../../scripts/native-licences'`)

```ts
describe('softwareRows', () => {
  const pkg = {
    name: 'expo',
    version: '58.0.19',
    licence: 'MIT',
    copyright: 'Copyright (c) 650 Industries',
    texts: [0],
  };
  const native = {
    name: 'AndroidX',
    platforms: ['android'] as const,
    licence: 'Apache-2.0',
    copyright: 'Copyright (C) The Android Open Source Project',
    texts: [1],
  };
  const both = {
    name: 'fmt',
    platforms: ['ios', 'android'] as const,
    licence: 'MIT',
    copyright: 'Copyright (c) 2012 - present, Victor Zverovich\nand fmt contributors',
    texts: [2],
  };
  it('merges packages and native libraries into one list, case-insensitively by name', () => {
    expect(softwareRows([pkg], [both, native]).map((r) => r.title)).toEqual([
      'AndroidX',
      'expo 58.0.19',
      'fmt',
    ]);
  });
  it('shows a package with its version, a native library with its platforms', () => {
    const [androidx, expo, fmt] = softwareRows([pkg], [native, both]);
    expect(expo).toEqual({
      key: 'expo@58.0.19',
      title: 'expo 58.0.19',
      meta: 'MIT · Copyright (c) 650 Industries',
      texts: [0],
    });
    expect(androidx).toEqual({
      key: 'native:AndroidX',
      title: 'AndroidX',
      meta: 'Apache-2.0 · Android · Copyright (C) The Android Open Source Project',
      texts: [1],
    });
    expect(fmt?.meta).toBe(
      'MIT · iOS, Android · Copyright (c) 2012 - present, Victor Zverovich and fmt contributors',
    );
  });
});

describe('NATIVE_LIBRARIES', () => {
  it('resolves every text index, gives every library a copyright, and allows only the native allowlist', () => {
    for (const l of NATIVE_LIBRARIES) {
      expect(l.copyright, l.name).not.toBe('');
      expect(NATIVE_ALLOWED_LICENCES, `${l.name} ${l.licence}`).toContain(l.licence);
      for (const i of l.texts) expect(LICENCE_TEXTS[i], `${l.name} → ${i}`).toBeTypeOf('string');
    }
  });
  it('names the libraries #160 lists', () => {
    const names = NATIVE_LIBRARIES.map((l) => l.name);
    for (const expected of [
      'SDWebImage',
      'libavif',
      'libdav1d',
      'ReachabilitySwift',
      'Folly',
      'boost',
      'fmt',
      'glog',
      'DoubleConversion',
      'Glide',
      'OkHttp',
      'Fresco',
      'AndroidX',
      'Kotlin',
    ]) {
      expect(names, expected).toContain(expected);
    }
  });
  it('lists each library once, sorted by name', () => {
    const names = NATIVE_LIBRARIES.map((l) => l.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')));
  });
});
```

(Task 3 names entries exactly as these strings: `Folly`, `DoubleConversion`, `OkHttp`. If curation chose a different display name, change it in the JSON to match, not here.)

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run lib/__tests__/licencesView.test.ts`
Expected: FAIL, `softwareRows is not a function`.

- [ ] **Step 3: Implement `softwareRows` in `lib/licencesView.ts`**

```ts
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
  const rows: (SoftwareRow & { sortName: string })[] = [
    ...packages.map((p) => ({
      sortName: p.name,
      key: packageKey(p),
      title: `${p.name} ${p.version}`,
      meta: `${p.licence} · ${oneLine(p.copyright)}`,
      texts: p.texts,
    })),
    ...natives.map((n) => ({
      sortName: n.name,
      key: `native:${n.name}`,
      title: n.name,
      meta: `${n.licence} · ${n.platforms.map((p) => PLATFORM_NAMES[p]).join(', ')} · ${oneLine(n.copyright)}`,
      texts: n.texts,
    })),
  ];
  return rows
    .sort((a, b) => a.sortName.localeCompare(b.sortName, 'en', { sensitivity: 'base' }))
    .map(({ sortName: _, ...row }) => row);
}
```

(If `npm run lint` flags the unused `_` binding, destructure with a different pattern rather than disable the rule.)

- [ ] **Step 4: Use it in `app/licences.tsx`**

Import `NATIVE_LIBRARIES` from `@/lib/licences.generated` and `softwareRows` from `@/lib/licencesView` (drop `packageKey` from that import if it is no longer used). Above the `return`: `const software = softwareRows(PACKAGES, NATIVE_LIBRARIES);`. Replace the Software section's heading count and body:

```tsx
<Text style={styles.sectionName} accessibilityRole="header">
  {t.about.licences.software} · {software.length}
</Text>;
{
  software.map((r) =>
    row(
      r.key,
      r.title,
      r.meta,
      r.texts.flatMap((i) => LICENCE_TEXTS[i] ?? []),
    ),
  );
}
```

Update the file's header comment: "every bundled package follows" → "every bundled or autolinked package and every native library the builds link (#160) follow, in one alphabetical list". The `testID` becomes `licence-native:<name>` for native rows. Check that `testID` is on `SILENT_PROPS`, so lint is fine.

- [ ] **Step 5: Run the tests and lint**

Run: `npx vitest run lib/__tests__/licencesView.test.ts && npm run lint && npm run typecheck`
Expected: PASS, no lint errors.

- [ ] **Step 6: Commit**

```bash
npx prettier --write lib/licencesView.ts lib/__tests__/licencesView.test.ts app/licences.tsx
git add lib/licencesView.ts lib/__tests__/licencesView.test.ts app/licences.tsx
git commit -m "feat(about): Licences lists the native libraries with the packages (#160)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Docs, rule, screens, and the whole check

**Files:**

- Modify: `docs/license.md`
- Modify: `.claude/rules/licensing.md`
- Modify: `design/SCREENS.md`, and `design/screens/*` if the Licences page is captured

- [ ] **Step 1: `docs/license.md`, the table row.** Replace the "Native libraries" row with:

`| Native libraries | each library's own: Apache-2.0, MIT, BSD-2-Clause, BSD-3-Clause, BSL-1.0, bzip2-1.0.6; Google's Play libraries under Google's terms | scripts/native-licences.json, checked by scripts/gen-licences.ts |`

Also change the "Bundled JavaScript packages" row's name to "Bundled and autolinked packages". Re-run prettier to realign the table.

- [ ] **Step 2: `docs/license.md`, Software licences.** Replace the closing paragraph ("Native libraries that the iOS and Android builds link … #160.") with:

```markdown
The list also holds every package Expo autolinks, read with `npx expo-modules-autolinking`
the way `expo prebuild` reads them: some ship native code and no JavaScript, so the source
maps never name them.

Native libraries that the builds link (pods, Maven artifacts, React Native's C++
dependencies, code vendored in a package's native folders) have no `node_modules` licence,
so they are curated in `scripts/native-licences.json`. Each entry names one upstream
project, its licence, copyright and the npm package that pulls it in, with its licence and
NOTICE copied verbatim into `scripts/licence-texts/native/` from the URL it records. Their
allowlist is `NATIVE_ALLOWED_LICENCES` (`scripts/native-licences.ts`), owner-approved on
2026-10-24 like the JavaScript one. Google's Play libraries (In-App Review, Play services)
are proprietary: the sheet names them with their terms and shows no text. Native rows show
no version, since pods float within their podspec ranges.

`gen:licences` scans the podspecs and `build.gradle` files of the autolinked packages, and
React Native's version catalog, and fails on:

- **a native dependency the list does not match:** curate it, from its repository, as
  above. A licence off the allowlist goes to the owner.
- **a `scan` entry nothing matches** (a dependency was dropped): remove it, or make it
  `inventory` if it still ships indirectly.
- **a licence file in a package's native folder that no entry claims:** read it and add it
  to the right entry's `vendored`.

The scan sees direct dependencies only. Indirect ones (`found: "inventory"`) come from a
local inventory, refreshed on every Expo SDK bump: in a scratch copy of the repo,
`npx expo prebuild --no-install`, then `./gradlew :app:dependencies --configuration
releaseRuntimeClasspath` in `android/`, and `pod install` in `ios/` (or, without CocoaPods,
the podspecs' dependencies resolved on the CocoaPods trunk). Every library in that output
must match an entry.
```

- [ ] **Step 3: `.claude/rules/licensing.md`.** Change the "Licence notices are generated" bullet so it says the notices cover bundled and autolinked packages (generated) and native libraries (curated in `scripts/native-licences.json`, drift-checked by `npm run check`), and add: `- Widening NATIVE_ALLOWED_LICENCES (scripts/native-licences.ts) is the owner's decision too.` Keep the file under 100 lines (tested).

- [ ] **Step 4: `design/SCREENS.md`.** In row 9 (`/licences`), "and every bundled package, each a tap from its full text" → "and every package and native library the app ships, in one list, each a tap from its full text". If `design/screens/` holds a Licences capture, run `npm run shots` (dev server per `.claude/rules/design-handoff.md`) and commit the changed PNGs. If it holds none, skip it.

- [ ] **Step 5: The whole check**

Run: `npm run check`
Expected: passes, with `git diff --exit-code` clean. Report its actual output.

- [ ] **Step 6: Commit**

```bash
npx prettier --write docs/license.md .claude/rules/licensing.md design/SCREENS.md
git add docs/license.md .claude/rules/licensing.md design/SCREENS.md design/screens
git commit -m "docs(licences): native libraries are listed and drift-checked (#160)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Appendix: the inventory of 2026-10-24 (main at `df83a116`)

**Android**, `releaseRuntimeClasspath` of a local `npx expo prebuild --platform android`: 191 resolved artifacts. The full list (`group:artifact:version`) is in the session scratchpad at `/private/tmp/claude-501/-Users-khachaturtovmasyan-Projects-escuadra/3c1989c9-e0fe-4515-b7ac-ee521a55a3c7/scratchpad/android-artifacts.txt`, with the tree in `android-deps.txt` beside it. If that is gone, re-run the procedure in Task 6, Step 2. Groups:

`androidx.*` (activity, annotation, appcompat, arch.core, autofill, browser, cardview, collection, concurrent, constraintlayout, coordinatorlayout, core, cursoradapter, customview, databinding, documentfile, drawerlayout, dynamicanimation, emoji2, exifinterface, fragment, graphics, interpolator, lifecycle, loader, profileinstaller, recyclerview, resourceinspection, room, savedstate, sqlite, startup, swiperefreshlayout, tracing, transition, vectordrawable, versionedparcelable, viewpager, viewpager2, window) · `com.caverock` (androidsvg-aar) · `com.facebook.fbjni` · `com.facebook.fresco` · `com.facebook.infer.annotation` · `com.facebook.react` (first-party) · `com.facebook.soloader` · `com.facebook.yoga` · `com.facebook.hermes` · `com.github.bumptech.glide` · `com.github.penfeizhou.android.animation` (APNG, AWebP, GIF, AVIF) · `com.google.android.gms` (play-services-base, -basement, -tasks: proprietary) · `com.google.android.material` · `com.google.android.play` (review, review-ktx, core-common: proprietary) · `com.google.code.findbugs` (jsr305) · `com.google.code.gson` · `com.google.errorprone` · `com.google.guava` · `com.google.j2objc` · `com.parse.bolts` · `com.squareup.okhttp3` · `com.squareup.okio` · `com.squareup.zstd` (zstd-kmp; it embeds zstd) · `commons-codec` · `commons-io` · `expo.modules.*`, `host.exp.exponent` (first-party) · `io.github.expo` · `io.github.expo.kolibri` · `io.github.expo.pika` · `javax.inject` · `jp.wasabeef` (glide-transformations) · `org.aomedia.avif.android` (it embeds libavif, dav1d, libyuv) · `org.bouncycastle` · `org.brotli` · `org.checkerframework` · `org.codehaus.mojo` (animal-sniffer-annotations) · `org.jetbrains` (annotations) · `org.jetbrains.kotlin` · `org.jetbrains.kotlinx` · `org.jspecify`.

An AAR that embeds C libraries (`org.aomedia.avif.android`, `com.squareup.zstd`) gets entries for those libraries too (libavif, dav1d, libyuv, zstd), `found: "inventory"`. `io.github.expo*` is published by Expo outside npm: read its POM for licence and repository.

**iOS**, from the podspecs of the autolinked pods and React Native, resolved on the CocoaPods trunk (CocoaPods could not be installed locally: Homebrew calls this Mac's configuration Tier 3):

| Pod                      | Version                                                            | Licence (podspec)                                                                          | Via                         |
| ------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | --------------------------- |
| SDWebImage               | 5.21.7                                                             | MIT                                                                                        | expo-image                  |
| SDWebImageAVIFCoder      | 0.11.1                                                             | MIT                                                                                        | expo-image                  |
| SDWebImageSVGCoder       | 1.7.0                                                              | MIT                                                                                        | expo-image                  |
| SDWebImageWebPCoder      | 0.14.6                                                             | MIT                                                                                        | expo-image                  |
| libavif (core, libdav1d) | 1.0.0                                                              | BSD-2-Clause                                                                               | expo-image                  |
| libdav1d                 | 1.2.0                                                              | BSD-2-Clause                                                                               | expo-image, through libavif |
| libwebp                  | 1.6.0                                                              | BSD-3-Clause (with its PATENTS file)                                                       | SDWebImageWebPCoder         |
| ReachabilitySwift        | 5.2.4                                                              | MIT                                                                                        | expo-updates                |
| RCT-Folly (Folly)        | `node_modules/react-native/third-party-podspecs/RCT-Folly.podspec` | Apache-2.0                                                                                 | react-native                |
| boost                    | 1.84.0                                                             | BSL-1.0                                                                                    | react-native                |
| glog                     | 0.3.5                                                              | BSD-3-Clause                                                                               | react-native                |
| DoubleConversion         | 1.1.6                                                              | BSD-3-Clause                                                                               | react-native                |
| fmt                      | 12.1.0                                                             | MIT                                                                                        | react-native                |
| fast_float               | 8.0.0                                                              | Apache-2.0 OR MIT OR BSL-1.0: record the one its LICENSE files offer that we choose, `MIT` | react-native                |
| SocketRocket             | React Native's prebuilt dependencies                               | BSD-3-Clause                                                                               | react-native                |
| hermes-engine (Hermes)   | `node_modules/react-native/sdks/hermes-engine/version.properties`  | MIT                                                                                        | react-native                |

libavif's default subspec (libaom, libvmaf) is **not** linked: expo-image asks for `libavif/libdav1d` and the AVIF coder for `libavif/core`. `sqlite3` is not linked either (`$notLinked`).
