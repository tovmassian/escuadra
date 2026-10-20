# Licences Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** About → Licences opens a sheet showing the Unicode License v3 notice, the fonts' licences by name, and every bundled JavaScript package's licence notice, from a list generated off Metro's source maps and checked in `npm run check`.

**Architecture:** `scripts/gen-licences.ts` bundles the app once for iOS and Android with source maps, hands the package folders it finds to the pure `scripts/licences.ts`, and writes `lib/licences.generated.ts`. `lib/licencesView.ts` holds the shared types and React-free display helpers; `components/LicencesSheet.tsx` renders them in the existing `Sheet`; `app/about.tsx` opens it from a row at the end of the credits card.

**Tech Stack:** Node 24 (native TS stripping, no build step), Expo SDK 57 / expo-router, React Native 0.86, Vitest (node environment), Prettier through `formatAndWrite`.

**Spec:** `docs/superpowers/specs/2026-10-20-licences-sheet-design.md`

## Global Constraints

- Work in the worktree `/Users/khachaturtovmasyan/Projects/escuadra/.claude/worktrees/156-licences-sheet`, branch `feat/156-licences-sheet`. Run `source ~/.nvm/nvm.sh && nvm use` first in every shell (Node 24 required).
- Licence texts, package names, versions, licence IDs, copyright lines and font names are **never translated** and never go in a catalog. Only `about.licences.*` keys are catalog text.
- Allowlist, exactly: `MIT`, `ISC`, `MIT AND OFL-1.1`, `MIT AND Apache-2.0`. Do not add others.
- No hard-coded colour, spacing or font size: `useThemeColors()` and `theme/tokens.ts` only; never a module-scope `StyleSheet.create` with colours (guardrail 5).
- `npm run lint` fails a wordy literal in JSX in `app/` or `components/`: put any English data string (e.g. "Unicode CLDR") in `lib/licencesView.ts`, not in JSX.
- TypeScript strict with `noUncheckedIndexedAccess`; never weaken it.
- Tests: `scripts/` and `lib/` keep `*.test.ts` beside the code (CLAUDE.md: an area keeps its layout until it moves whole).
- No animation over 300 ms; the expand/collapse has none.
- Generated output goes through `formatAndWrite` from `tools/squadctl/src/lib/write-json.ts`.
- CI temp files go to `$RUNNER_TEMP`, never new `.gitignore` lines.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Commits run a husky pre-commit hook; let it run.
- Product name is Escuadra; British spelling ("licence" noun) in English UI and docs, "License" only inside proper names ("Unicode License v3", "Apache License 2.0", "SIL Open Font License 1.1").

---

### Task 1: Shared types and display helpers — `lib/licencesView.ts`

**Files:**

- Create: `lib/licencesView.ts`
- Test: `lib/licencesView.test.ts`

**Interfaces:**

- Produces:
  - `interface BundledPackage { name: string; version: string; licence: string; copyright: string; texts: readonly number[] }`
  - `interface FontCredit { families: readonly string[]; licence: string }`
  - `const BUNDLED_FONTS: readonly FontCredit[]`
  - `const UNICODE_CREDIT: { source: 'Unicode CLDR'; licence: 'Unicode License v3' }`
  - `function licenceParagraphs(text: string): string[]`
  - `function packageKey(p: Pick<BundledPackage, 'name' | 'version'>): string` → `"name@version"`

- [ ] **Step 1: Write the failing test** — `lib/licencesView.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { licenceParagraphs, packageKey } from './licencesView';

describe('licenceParagraphs', () => {
  it('joins hard-wrapped lines and splits on blank lines', () => {
    const text =
      'MIT License\n\nCopyright (c) 2020 Someone\n\nPermission is hereby\ngranted, free of charge.\n';
    expect(licenceParagraphs(text)).toEqual([
      'MIT License',
      'Copyright (c) 2020 Someone',
      'Permission is hereby granted, free of charge.',
    ]);
  });

  it('treats CRLF, indentation and whitespace-only lines like plain breaks', () => {
    const text = '   Apache License\r\n   Version 2.0\r\n  \r\n  1. Definitions.\r\n';
    expect(licenceParagraphs(text)).toEqual(['Apache License Version 2.0', '1. Definitions.']);
  });

  it('keeps every word: the paragraphs rejoined equal the text with its whitespace collapsed', () => {
    const text = 'A b\nc\n\n\n d  e \n';
    const collapse = (s: string) => s.split(/\s+/).filter(Boolean).join(' ');
    expect(licenceParagraphs(text).join(' ')).toBe(collapse(text));
  });
});

it('keys a package by name and version', () => {
  expect(packageKey({ name: '@scope/a', version: '1.2.3' })).toBe('@scope/a@1.2.3');
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run lib/licencesView.test.ts`
Expected: FAIL — cannot resolve `./licencesView`.

- [ ] **Step 3: Implement** — `lib/licencesView.ts`

```ts
// What the Licences sheet (About → Licences, #156) shows, kept React-free so
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
        .map((line) => line.trim())
        .filter(Boolean)
        .join(' '),
    )
    .filter((paragraph) => paragraph.length > 0);
}

export const packageKey = (p: Pick<BundledPackage, 'name' | 'version'>): string =>
  `${p.name}@${p.version}`;
```

Note: the "keeps every word" test may need `licenceParagraphs` to also collapse runs of spaces inside a line (`'d  e'`). If it fails on that, change the inner `.map((line) => line.trim())` to `.map((line) => line.trim().replace(/\s+/g, ' '))`.

- [ ] **Step 4: Run it and see it pass**

Run: `npx vitest run lib/licencesView.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/licencesView.ts lib/licencesView.test.ts
git commit -m "feat(licences): the sheet's types and display helpers (#156)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The generator's pure core — `scripts/licences.ts`

**Files:**

- Create: `scripts/licences.ts`
- Test: `scripts/licences.test.ts`

**Interfaces:**

- Consumes: `BundledPackage` from `../lib/licencesView.ts` (type-only import; scripts run under Node's type stripping, so use `import type` and the `.ts` extension as `gen-squads.ts` does).
- Produces:
  - `const ALLOWED_LICENCES: readonly string[]` = `['MIT', 'ISC', 'MIT AND OFL-1.1', 'MIT AND Apache-2.0']`
  - `function packageFolderFromSource(source: string): string | null` — `'/node_modules/a/node_modules/@s/b/x.js'` → `'node_modules/a/node_modules/@s/b'`; no `node_modules/` → `null`
  - `function collectPackageFolders(sources: Iterable<string>): string[]` — unique, sorted
  - `function isLicenceFile(fileName: string): boolean` — `/^(licen[cs]e|copying|notice)/i`
  - `function isPrimaryLicenceFile(fileName: string): boolean` — `/^(licen[cs]e|copying)(\.(md|txt))?$/i`
  - `function orderLicenceFiles(fileNames: readonly string[]): string[]` — licence files only, primary first, then the rest in code-point order
  - `function copyrightLines(text: string): string[]`
  - `interface LicenceFile { name: string; text: string }`
  - `interface PackageRead { name: string; version: string; licence: string | undefined; files: LicenceFile[] }` (files already ordered)
  - `interface LicenceData { texts: string[]; packages: BundledPackage[] }`
  - `function buildLicenceData(packages: readonly PackageRead[], sourced: Readonly<Record<string, LicenceFile[]>>): LicenceData` — throws one `Error` listing every problem

- [ ] **Step 1: Write the failing tests** — `scripts/licences.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import {
  buildLicenceData,
  collectPackageFolders,
  copyrightLines,
  orderLicenceFiles,
  packageFolderFromSource,
  type PackageRead,
} from './licences';

const MIT = (holder: string) =>
  `MIT License\n\nCopyright (c) 2020 ${holder}\n\nPermission is hereby granted, free of charge.\n`;
const pkg = (over: Partial<PackageRead> = {}): PackageRead => ({
  name: 'a',
  version: '1.0.0',
  licence: 'MIT',
  files: [{ name: 'LICENSE', text: MIT('A') }],
  ...over,
});

describe('packageFolderFromSource', () => {
  it('reduces a source path to its package folder', () => {
    expect(packageFolderFromSource('/node_modules/zustand/esm/index.mjs')).toBe(
      'node_modules/zustand',
    );
  });
  it('keeps a scoped name whole', () => {
    expect(packageFolderFromSource('/node_modules/@telemetrydeck/sdk/dist/x.js')).toBe(
      'node_modules/@telemetrydeck/sdk',
    );
  });
  it('resolves a nested package to its own folder', () => {
    expect(
      packageFolderFromSource(
        '/node_modules/react-native-reanimated/node_modules/semver/classes/range.js',
      ),
    ).toBe('node_modules/react-native-reanimated/node_modules/semver');
  });
  it('ignores the app’s own files', () => {
    expect(packageFolderFromSource('/app/about.tsx')).toBeNull();
  });
});

it('collects unique folders, sorted', () => {
  expect(
    collectPackageFolders([
      '/node_modules/b/x.js',
      '/node_modules/a/y.js',
      '/node_modules/b/z.js',
      '/lib/q.ts',
    ]),
  ).toEqual(['node_modules/a', 'node_modules/b']);
});

it('orders licence files: primary first, then the rest, and drops the others', () => {
  expect(
    orderLicenceFiles(['README.md', 'NOTICE', 'LICENSE_FONT', 'package.json', 'LICENSE.md']),
  ).toEqual(['LICENSE.md', 'LICENSE_FONT', 'NOTICE']);
});

describe('copyrightLines', () => {
  it('takes the copyright lines verbatim, trimmed', () => {
    expect(copyrightLines('X\n  Copyright (c) 2019 Paul Henschel\nY')).toEqual([
      'Copyright (c) 2019 Paul Henschel',
    ]);
  });
  it('takes several', () => {
    expect(copyrightLines('Copyright (c) A,\nCopyright (c) B,\n')).toEqual([
      'Copyright (c) A,',
      'Copyright (c) B,',
    ]);
  });
  it('accepts © lines', () => {
    expect(copyrightLines('© 2024 Someone')).toEqual(['© 2024 Someone']);
  });
  it('refuses the MIT boilerplate and Apache’s template line', () => {
    expect(
      copyrightLines(
        'The above copyright notice and this permission notice…\n   Copyright [yyyy] [name of copyright owner]',
      ),
    ).toEqual([]);
  });
});

describe('buildLicenceData', () => {
  it('lists packages sorted by name then version, with deduplicated texts', () => {
    const data = buildLicenceData(
      [
        pkg({ name: 'b' }),
        pkg({ name: 'a', version: '2.0.0' }),
        pkg({ name: 'a', version: '1.0.0' }),
      ],
      {},
    );
    expect(data.packages.map((p) => `${p.name}@${p.version}`)).toEqual([
      'a@1.0.0',
      'a@2.0.0',
      'b@1.0.0',
    ]);
    expect(data.texts).toHaveLength(1);
    expect(data.packages.every((p) => p.texts[0] === 0)).toBe(true);
    expect(data.packages[0]).toMatchObject({ licence: 'MIT', copyright: 'Copyright (c) 2020 A' });
  });

  it('dedupes texts that differ only in line endings and trailing space', () => {
    const data = buildLicenceData(
      [
        pkg({ name: 'a' }),
        pkg({
          name: 'b',
          files: [{ name: 'LICENSE', text: MIT('A').replace(/\n/g, '\r\n') + '  ' }],
        }),
      ],
      {},
    );
    expect(data.texts).toHaveLength(1);
  });

  it('keeps every licence file, primary first', () => {
    const data = buildLicenceData(
      [
        pkg({
          licence: 'MIT AND OFL-1.1',
          files: [
            { name: 'LICENSE', text: MIT('Expo') },
            { name: 'LICENSE_FONT', text: 'SIL OPEN FONT LICENSE' },
          ],
        }),
      ],
      {},
    );
    expect(data.packages[0]?.texts).toEqual([0, 1]);
    expect(data.texts[1]).toBe('SIL OPEN FONT LICENSE');
  });

  it('collapses the same name and version found in two folders', () => {
    expect(buildLicenceData([pkg(), pkg()], {}).packages).toHaveLength(1);
  });

  it('uses a sourced licence for a package that ships none', () => {
    const data = buildLicenceData([pkg({ name: 'expo-router', files: [] })], {
      'expo-router': [{ name: 'LICENSE', text: MIT('650 Industries') }],
    });
    expect(data.packages[0]?.copyright).toBe('Copyright (c) 2020 650 Industries');
  });

  it('reports every problem at once', () => {
    const run = () =>
      buildLicenceData(
        [
          pkg({ name: 'gpl', licence: 'GPL-3.0' }),
          pkg({ name: 'bare', files: [] }),
          pkg({
            name: 'anon',
            files: [{ name: 'LICENSE', text: 'Permission is hereby granted.' }],
          }),
          pkg({ name: 'fontonly', files: [{ name: 'LICENSE_FONT', text: MIT('X') }] }),
        ],
        { gone: [{ name: 'LICENSE', text: MIT('G') }] },
      );
    expect(run).toThrow(/gpl@1\.0\.0: licence "GPL-3\.0" is not on the allowlist/);
    expect(run).toThrow(
      /bare@1\.0\.0: no licence file, and no entry in scripts\/licence-sources\.json/,
    );
    expect(run).toThrow(/anon@1\.0\.0: its licence file has no copyright line/);
    expect(run).toThrow(/fontonly@1\.0\.0: its licence file has no copyright line/);
    expect(run).toThrow(
      /gone: scripts\/licence-sources\.json names a package the bundle no longer contains/,
    );
  });

  it('reports a missing licence field', () => {
    expect(() => buildLicenceData([pkg({ licence: undefined })], {})).toThrow(
      /licence "\(none\)" is not on the allowlist/,
    );
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run scripts/licences.test.ts`
Expected: FAIL — cannot resolve `./licences`.

- [ ] **Step 3: Implement** — `scripts/licences.ts`

```ts
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

/** A licence text's copyright lines, verbatim and trimmed. Template lines never count. */
export function copyrightLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^(copyright\b|\(c\)|©)/i.test(line))
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
 * resolves, by package name, for packages whose npm tarball ships none. Throws
 * one error listing every problem, so a run names them all at once.
 */
export function buildLicenceData(
  packages: readonly PackageRead[],
  sourced: Readonly<Record<string, LicenceFile[]>>,
): LicenceData {
  const problems: string[] = [];
  const unique = new Map<string, PackageRead>();
  for (const p of packages) unique.set(`${p.name}@${p.version}`, p);
  const sorted = [...unique.values()].sort(byNameThenVersion);

  const names = new Set(sorted.map((p) => p.name));
  for (const name of Object.keys(sourced).sort()) {
    if (!names.has(name)) {
      problems.push(
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
      problems.push(
        `${id}: licence "${p.licence ?? '(none)'}" is not on the allowlist (scripts/licences.ts)`,
      );
    }
    const files = p.files.length > 0 ? p.files : sourced[p.name];
    if (!files || files.length === 0) {
      problems.push(`${id}: no licence file, and no entry in scripts/licence-sources.json`);
      continue;
    }
    const primary = files[0];
    const copyright =
      primary && isPrimaryLicenceFile(primary.name) ? copyrightLines(primary.text) : [];
    if (copyright.length === 0) {
      problems.push(`${id}: its licence file has no copyright line`);
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

  if (problems.length > 0) {
    throw new Error(
      `gen-licences: ${problems.length} problem(s)\n${problems.map((p) => `  - ${p}`).join('\n')}`,
    );
  }
  return { texts, packages: result };
}
```

- [ ] **Step 4: Run them and see them pass**

Run: `npx vitest run scripts/licences.test.ts`
Expected: PASS. Then `npx tsc --noEmit` — no errors.

- [ ] **Step 5: Commit**

```bash
git add scripts/licences.ts scripts/licences.test.ts
git commit -m "feat(licences): the generator's pure core and its rules (#156)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The generator, its sources, the generated file and the check

**Files:**

- Create: `scripts/gen-licences.ts`
- Create: `scripts/licence-sources.json`
- Create: `scripts/licence-texts/standard-navigation.LICENSE`
- Create (generated): `lib/licences.generated.ts`
- Modify: `package.json` (`scripts.gen:licences`, `scripts.check`)
- Modify: `lib/licencesView.test.ts` (tests over the generated file)
- Modify: `CLAUDE.md` (one bullet)

**Interfaces:**

- Consumes: everything Task 2 produces; `BundledPackage` from Task 1; `formatAndWrite(filePath, content)` from `../tools/squadctl/src/lib/write-json.ts`.
- Produces: `lib/licences.generated.ts` exporting `UNICODE_LICENSE: string`, `LICENCE_TEXTS: readonly string[]`, `PACKAGES: readonly BundledPackage[]`.

- [ ] **Step 1: Write the sources file** — `scripts/licence-sources.json`

```json
{
  "@react-native/assets-registry": {
    "from": "react-native",
    "reason": "Published from the React Native repository under its LICENSE."
  },
  "@react-native/js-polyfills": {
    "from": "react-native",
    "reason": "Published from the React Native repository under its LICENSE."
  },
  "@react-native/normalize-colors": {
    "from": "react-native",
    "reason": "Published from the React Native repository under its LICENSE."
  },
  "@react-native/virtualized-lists": {
    "from": "react-native",
    "reason": "Published from the React Native repository under its LICENSE."
  },
  "expo-router": {
    "from": "expo",
    "reason": "Published from the Expo repository under its MIT LICENSE."
  },
  "expo-updates": {
    "from": "expo",
    "reason": "Published from the Expo repository under its MIT LICENSE."
  },
  "standard-navigation": {
    "file": "scripts/licence-texts/standard-navigation.LICENSE",
    "url": "https://github.com/react-navigation/standard-navigation/blob/main/LICENSE",
    "reason": "Its repository carries an MIT LICENSE that the npm tarball omits."
  }
}
```

- [ ] **Step 2: Copy the upstream licence verbatim**

Run:

```bash
gh api repos/react-navigation/standard-navigation/contents/LICENSE --jq .content | base64 -d > scripts/licence-texts/standard-navigation.LICENSE
head -3 scripts/licence-texts/standard-navigation.LICENSE
```

Expected: `MIT License`, blank, `Copyright (c) 2026 React Navigation Contributors`. If `prettier --check .` later complains about this file, add nothing to `.prettierignore` unless it actually does (prettier ignores unknown extensions).

- [ ] **Step 3: Write the generator** — `scripts/gen-licences.ts`

```ts
// GENERATED FILE producer — run via `npm run gen:licences`. Regenerates
// lib/licences.generated.ts: the Unicode notice and every package Metro bundles
// into the iOS and Android apps, with their licence notices, for About →
// Licences. See docs/superpowers/specs/2026-10-20-licences-sheet-design.md.
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
  type LicenceFile,
  type PackageRead,
} from './licences.ts';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const GENERATED_TS_PATH = path.join(REPO_ROOT, 'lib', 'licences.generated.ts');
const SOURCES_PATH = path.join(REPO_ROOT, 'scripts', 'licence-sources.json');
const UNICODE_PATH = path.join(REPO_ROOT, 'i18n', 'UNICODE-LICENSE.txt');
const UNICODE_START = 'UNICODE LICENSE V3';
const PLATFORMS = ['ios', 'android'] as const;

interface LicenceSource {
  reason: string;
  from?: string;
  file?: string;
  url?: string;
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
    return maps.flatMap(
      (m) => (JSON.parse(readFileSync(path.join(dir, m), 'utf8')) as { sources: string[] }).sources,
    );
  });
}

function readLicenceFiles(folder: string): LicenceFile[] {
  return orderLicenceFiles(readdirSync(folder)).map((name) => ({
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

function resolveSources(): Record<string, LicenceFile[]> {
  const sources = JSON.parse(readFileSync(SOURCES_PATH, 'utf8')) as Record<string, LicenceSource>;
  return Object.fromEntries(
    Object.entries(sources).map(([name, source]) => {
      if (source.from)
        return [name, readLicenceFiles(path.join(REPO_ROOT, 'node_modules', source.from))];
      if (source.file) {
        return [
          name,
          [{ name: 'LICENSE', text: readFileSync(path.join(REPO_ROOT, source.file), 'utf8') }],
        ];
      }
      throw new Error(
        `gen-licences: scripts/licence-sources.json entry "${name}" has neither "from" nor "file"`,
      );
    }),
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
```

- [ ] **Step 4: Wire the scripts** — `package.json`

Add after `"gen:flags"`:

```json
    "gen:licences": "node scripts/gen-licences.ts",
```

and change `check` to (only the two additions differ):

```json
    "check": "npm run typecheck && npm run lint && npm run format:check && npm run test && npm run squadctl -- registry check && npm run gen:squads && npm run gen:flags && npm run gen:licences && git diff --exit-code -- lib/squads.generated.ts data/index.json assets/flags/generated.ts lib/licences.generated.ts",
```

- [ ] **Step 5: Run the generator**

Run: `npm run gen:licences`
Expected: `gen-licences: wrote 77 packages (… licence texts) to lib/licences.generated.ts` in about 30 s. If it reports problems, fix the cause (a missing `licence-sources.json` entry, a path), never the allowlist. If `EXPO_OFFLINE` breaks the export, drop it and note why in the comment. Then run it a second time and confirm `git diff --stat lib/licences.generated.ts` shows nothing new (determinism).

Spot-check: `grep -c "name:" lib/licences.generated.ts` ≈ 77; `grep -n "material-symbols\|standard-navigation\|semver" lib/licences.generated.ts`.

- [ ] **Step 6: Add tests over the generated file** — append to `lib/licencesView.test.ts`

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { LICENCE_TEXTS, PACKAGES, UNICODE_LICENSE } from './licences.generated';

describe('lib/licences.generated.ts', () => {
  it('resolves every text index, and gives every package a copyright and a text', () => {
    for (const p of PACKAGES) {
      expect(p.copyright, p.name).not.toBe('');
      expect(p.texts.length, p.name).toBeGreaterThan(0);
      for (const i of p.texts) expect(LICENCE_TEXTS[i], `${p.name} → ${i}`).toBeTypeOf('string');
    }
  });

  it('lists each package once, by name then version', () => {
    const keys = PACKAGES.map(packageKey);
    expect(new Set(keys).size).toBe(keys.length);
    const sorted = [...PACKAGES].sort((a, b) =>
      a.name < b.name
        ? -1
        : a.name > b.name
          ? 1
          : a.version < b.version
            ? -1
            : a.version > b.version
              ? 1
              : 0,
    );
    expect(PACKAGES.map(packageKey)).toEqual(sorted.map(packageKey));
  });

  it('carries the Unicode notice from its first line on, verbatim', () => {
    const file = readFileSync(path.resolve(__dirname, '../i18n/UNICODE-LICENSE.txt'), 'utf8');
    expect(UNICODE_LICENSE.startsWith('UNICODE LICENSE V3')).toBe(true);
    expect(file.trim().endsWith(UNICODE_LICENSE)).toBe(true);
  });

  it('includes React Native and the Unicode notice is not a package', () => {
    expect(PACKAGES.some((p) => p.name === 'react-native')).toBe(true);
  });
});
```

Merge the imports at the top of the file (one `import { … } from './licencesView'` line including `packageKey`).

Run: `npx vitest run lib/licencesView.test.ts scripts/licences.test.ts` → PASS.

- [ ] **Step 7: CLAUDE.md** — add one bullet to "Architecture rules", after the Telemetry bullet:

```markdown
- **Licence notices are generated.** `lib/licences.generated.ts` (About → Licences) is
  written by `npm run gen:licences` from the bundle's own source maps, and `npm run check`
  fails when it is stale. Its rules, and why widening the licence allowlist is the owner's
  call: `docs/license.md`.
```

- [ ] **Step 8: Run the full check**

Run: `git add lib/licences.generated.ts && npm run check`
Expected: passes end to end. (`git diff --exit-code` compares the working tree with the index, so the new file must be staged first.)

- [ ] **Step 9: Commit**

```bash
git add scripts/gen-licences.ts scripts/licence-sources.json scripts/licence-texts lib/licences.generated.ts lib/licencesView.test.ts package.json CLAUDE.md
git commit -m "feat(licences): generate the bundled packages' notices and check them (#156)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Catalog keys in five languages

**Files:**

- Modify: `i18n/en.ts` (new `about.licences` object, directly after `about.credits`)
- Modify: `i18n/budgets.ts` (two groups, in en.ts order)
- Modify: `i18n/de.ts`, `i18n/fr.ts`, `i18n/es.ts`, `i18n/it.ts`
- Modify: `i18n/__tests__/catalogs.test.ts` (`SAME_AS_ENGLISH`, the About hash)

**Interfaces:**

- Produces: `t.about.licences.label`, `.originalLanguage`, `.countryNames`, `.fonts`, `.software` (all `string`).

- [ ] **Step 1: English** — in `i18n/en.ts`, after the `credits: { … },` object inside `about`:

```ts
    /** About → Licences: the sheet of licence notices. The notices stay in English. */
    licences: {
      /** ≤ 16 chars: the row at the end of the credits, and the sheet's title. */
      label: 'Licences',
      /** Above the notices, which are never translated. */
      originalLanguage: 'Licence texts are shown as written, in English.',
      /** ≤ 24 chars: a section of the sheet, in small capitals. */
      countryNames: 'Country names',
      fonts: 'Fonts',
      software: 'Software',
    },
```

Read `i18n/__tests__/budgets.test.ts` first: if one `≤ N` comment must govern exactly the keys it sits above, the three section keys share one comment and one budget group.

- [ ] **Step 2: Budgets** — in `i18n/budgets.ts`, at the position matching en.ts order (after the last `about.*`/earlier group that precedes `about.licences` in the file):

```ts
  { budget: 16, texts: { 'about.licences.label': (m) => m.about.licences.label } },
  {
    budget: 24,
    texts: {
      'about.licences.countryNames': (m) => m.about.licences.countryNames,
      'about.licences.fonts': (m) => m.about.licences.fonts,
      'about.licences.software': (m) => m.about.licences.software,
    },
  },
```

- [ ] **Step 3: Translations** — the same object, same position, in each catalog. Section names reuse each catalog's existing credit headings ("Ländernamen", "Flaggen und Schriften", …) so the sheet and About agree:

| key                | de                                                      | fr                                                            | es                                                           | it                                                               |
| ------------------ | ------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------- |
| `label`            | Lizenzen                                                | Licences                                                      | Licencias                                                    | Licenze                                                          |
| `originalLanguage` | Lizenztexte werden im Original angezeigt, auf Englisch. | Les textes des licences sont affichés tels quels, en anglais. | Los textos de las licencias se muestran tal cual, en inglés. | I testi delle licenze sono riportati così come sono, in inglese. |
| `countryNames`     | Ländernamen                                             | Noms de pays                                                  | Nombres de países                                            | Nomi dei paesi                                                   |
| `fonts`            | Schriften                                               | Polices                                                       | Tipografías                                                  | Font                                                             |
| `software`         | Software                                                | Logiciels                                                     | Software                                                     | Software                                                         |

These are drafts; the controller's language review (Task 7) may change them.

- [ ] **Step 4: SAME_AS_ENGLISH** — in `i18n/__tests__/catalogs.test.ts`, add with reasons:

```ts
  de: [ …,
    // "Software" is the German word too.
    'about.licences.software',
  ],
  fr: [ …,
    // "Licences" is the French word too.
    'about.licences.label',
  ],
  es: [ …,
    // "Software" is the word Spanish uses.
    'about.licences.software',
  ],
  it: [ …,
    // "Font", as About's "Bandiere e font" says, and "Software": the words Italian uses.
    'about.licences.fonts',
    'about.licences.software',
  ],
```

- [ ] **Step 5: Run the i18n tests**

Run: `npx vitest run i18n scripts/i18n-review-sheet.test.ts`
Expected: only the About-hash test fails, printing the new hash. Update `'00f86a7d5df60222'` in `catalogs.test.ts` to the printed value and re-run → PASS. Then `npx tsc --noEmit` → clean.

- [ ] **Step 6: Commit**

```bash
git add i18n
git commit -m "feat(i18n): the Licences row and sheet in five languages (#156)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The sheet, the About row and the captures

**Files:**

- Create: `components/LicencesSheet.tsx`
- Modify: `app/about.tsx`
- Modify: `scripts/capture-screens.mjs` (one capture after `01a-about`)
- Modify: `design/SCREENS.md` (one row)
- Regenerate: `design/screens/*.png` via `npm run shots`

**Interfaces:**

- Consumes: `UNICODE_LICENSE`, `LICENCE_TEXTS`, `PACKAGES` (Task 3); `BUNDLED_FONTS`, `UNICODE_CREDIT`, `licenceParagraphs`, `packageKey` (Task 1); `t.about.licences.*` (Task 4); `Sheet` from `components/Sheet.tsx` (`{ visible, onClose, title, testID, children }`; children mount only while open, so local state resets at every opening).
- Produces: `export function LicencesSheet({ visible, onClose }: { visible: boolean; onClose: () => void })`; testIDs `about-licences` (row), `licences-sheet`/`licences-close` (from `Sheet`), `licence-unicode`, `licence-<name>@<version>`.

- [ ] **Step 1: Read before writing.** `components/Sheet.tsx`, `components/PhotoCredits.tsx` (the closest sheet: a `ScrollView` with `flexShrink: 1`), `theme/tokens.ts` `spacing` and `typography` names. Use only existing tokens: `captionEyebrow` (section names), `rowTitle` (package name), `secondarySmall` (meta lines and the note), `descriptionSmall` (licence text). If a needed role is missing, add it to `theme/tokens.ts` rather than inlining.

- [ ] **Step 2: Write** `components/LicencesSheet.tsx`

```tsx
import { Sheet } from '@/components/Sheet';
import { useT } from '@/i18n/useT';
import { LICENCE_TEXTS, PACKAGES, UNICODE_LICENSE } from '@/lib/licences.generated';
import { BUNDLED_FONTS, UNICODE_CREDIT, licenceParagraphs, packageKey } from '@/lib/licencesView';
import { spacing, typography } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const UNICODE_KEY = 'unicode';

// About → Licences (#156): the notices other people's data and code ask to
// travel with the app. The Unicode notice for the country names opens
// expanded, because it is the one this sheet exists for; the fonts are named,
// since each font file carries its own notice; every bundled package follows,
// its full text a tap away. Notices are shown in English, as written, and
// everything is in the bundle, so the sheet works offline and sends nothing.
export function LicencesSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useThemeColors();
  const t = useT();
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set([UNICODE_KEY]));
  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const styles = StyleSheet.create({
    // Shrinks, and scrolls, when the sheet is capped.
    list: { flexShrink: 1 },
    listContent: { gap: spacing.md, paddingBottom: spacing.md },
    note: { ...typography.secondarySmall, color: colors.textMuted },
    section: { gap: spacing.sm },
    sectionName: { ...typography.captionEyebrow, color: colors.textMuted },
    row: { gap: spacing.xxs },
    rowTitle: { ...typography.rowTitle, color: colors.textPrimary },
    meta: { ...typography.secondarySmall, color: colors.textMuted },
    text: { ...typography.descriptionSmall, color: colors.textSecondary, marginTop: spacing.xs },
  });

  const body = (texts: readonly string[]) =>
    texts.flatMap((text, n) =>
      licenceParagraphs(text).map((p, i) => (
        <Text key={`${n}-${i}`} style={styles.text}>
          {p}
        </Text>
      )),
    );

  const row = (key: string, title: string, meta: string, texts: readonly string[]) => {
    const expanded = open.has(key);
    return (
      <View key={key} style={styles.row}>
        <Pressable
          testID={`licence-${key}`}
          onPress={() => toggle(key)}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
        >
          <Text style={styles.rowTitle}>
            {title} {expanded ? '▾' : '▸'}
          </Text>
          <Text style={styles.meta}>{meta}</Text>
        </Pressable>
        {expanded && body(texts)}
      </View>
    );
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t.about.licences.label} testID="licences">
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        alwaysBounceVertical={false}
      >
        <Text style={styles.note}>{t.about.licences.originalLanguage}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionName}>{t.about.licences.countryNames}</Text>
          {row(UNICODE_KEY, UNICODE_CREDIT.source, UNICODE_CREDIT.licence, [UNICODE_LICENSE])}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionName}>{t.about.licences.fonts}</Text>
          {BUNDLED_FONTS.map((font) => (
            <View key={font.licence} style={styles.row}>
              <Text style={styles.rowTitle}>{font.families.join(' · ')}</Text>
              <Text style={styles.meta}>{font.licence}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionName}>
            {t.about.licences.software} · {PACKAGES.length}
          </Text>
          {PACKAGES.map((p) =>
            row(
              packageKey(p),
              `${p.name} ${p.version}`,
              `${p.licence} · ${p.copyright.replace(/\n/g, ' ')}`,
              p.texts.flatMap((i) => LICENCE_TEXTS[i] ?? []),
            ),
          )}
        </View>
      </ScrollView>
    </Sheet>
  );
}
```

Check: `spacing.xxs`/`spacing.xs` exist (if `xs` does not, use the nearest existing step). The `▾`/`▸` glyphs and `' · '` carry no letters, so the lint rule passes; if lint objects to anything, move the string into `lib/licencesView.ts`, never into `SILENT_PROPS`.

- [ ] **Step 3: The About row** — in `app/about.tsx`:

1. `import { useState } from 'react';` (merge with the `Fragment` import) and `import { LicencesSheet } from '@/components/LicencesSheet';`.
2. `const [licencesOpen, setLicencesOpen] = useState(false);` beside the other hooks.
3. Inside the credits card, after the `t.about.credits.sections.map(…)` block:

```tsx
<Pressable
  testID="about-licences"
  onPress={() => setLicencesOpen(true)}
  accessibilityRole="button"
  hitSlop={8}
>
  <Text style={[styles.subHeading, { marginBottom: 0 }]}>{t.about.licences.label} ›</Text>
</Pressable>
```

4. The credits' last paragraph no longer ends the card: drop `last(s, sections) && last(i, all) && { marginBottom: 0 }` from the credits paragraphs (and its comment), so the paragraph keeps its normal margin above the row.
5. Just before the closing `</View>` of the root: `<LicencesSheet visible={licencesOpen} onClose={() => setLicencesOpen(false)} />`.

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 5: The capture** — in `scripts/capture-screens.mjs`, right after `await capture.shoot('01a-about');`:

```js
await capture.tapId('about-licences', { wait: SHEET_MS });
await capture.shoot('01a-about-licences');
```

and in `design/SCREENS.md`'s Captures table, after the `01a-about.png` row:

```markdown
| `screens/01a-about-licences.png` | About — licences sheet |
```

(Run `npx prettier --write design/SCREENS.md` to realign the table.) In the Screens table's About row, append "and a Licences row that opens the licence notices" to its description.

- [ ] **Step 6: See it work and regenerate the shots**

Run: `npm run shots` (it starts the web build itself; read `scripts/capture-screens.mjs` if it needs a running server). Then open `design/screens/01a-about-licences.png` and its dark/light counterpart with the Read tool and check: the title "Licences", the note, the Unicode notice expanded as paragraphs, the fonts, "Software · 77", rows with name, version, licence and copyright. Fix anything that looks broken before committing.

- [ ] **Step 7: Commit**

```bash
git add components/LicencesSheet.tsx app/about.tsx scripts/capture-screens.mjs design
git commit -m "feat(about): the Licences sheet (#156)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: `docs/license.md`

**Files:**

- Modify: `docs/license.md`

- [ ] **Step 1: The opening line.** "What every image and font Escuadra ships is licensed under" → "What every image, font and bundled package Escuadra ships is licensed under".

- [ ] **Step 2: Three rows** in "What Escuadra ships", after the Archivo row:

```markdown
| Material Symbols (Android only) | Apache License 2.0 | `@expo-google-fonts/material-symbols`, through `expo-router` → `expo-symbols` |
| Bundled JavaScript packages | each package's own: MIT, ISC, MIT AND OFL-1.1, MIT AND Apache-2.0 | `lib/licences.generated.ts`, `scripts/gen-licences.ts` |
| Native libraries | not yet listed (#160) | podspecs and `build.gradle` files in `node_modules` |
```

(Run prettier on the file to realign.)

- [ ] **Step 3: Replace the Unicode paragraph's last three sentences** ("The app bundle does not carry it yet; #156 tracks … without #156.") with:

```markdown
In the app it does too: About → Licences shows the notice verbatim, read from that same
file by `scripts/gen-licences.ts`, so the repo and the app cannot carry different texts.
```

- [ ] **Step 4: A new subsection** before "## Player photos: the licences we accept":

```markdown
### Software licences

The JavaScript packages Metro bundles into the app ask, under MIT, ISC and the rest, that
their copyright and permission notice travel with every copy. About → Licences shows each
one's name, version, licence and copyright, with its full licence texts a tap away, and
names the fonts, whose notice is inside each font file.

The list is generated, never written: `npm run gen:licences` (`scripts/gen-licences.ts`)
exports the iOS and Android bundles with source maps and lists every package their sources
name, so it holds what ships and nothing the build only uses. `npm run check` regenerates
it and fails when `lib/licences.generated.ts` changes. When it does:

- **A version or a text changed** (a dependency bump): run `npm run gen:licences` and
  commit the file.
- **A licence is not on the allowlist** (`ALLOWED_LICENCES` in `scripts/licences.ts`): a
  new licence is the owner's decision, made the way "Changing the list" describes for
  photos. Never widen it to make the check pass.
- **A package ships no licence file:** find the licence in its repository and add it to
  `scripts/licence-sources.json`, either `from` the package published from the same
  repository or as a `file` copied verbatim into `scripts/licence-texts/`, with its URL.
- **A licence file has no copyright line:** read it, and source the package's licence as
  above.

Native libraries that the iOS and Android builds link (SDWebImage, Folly, Glide and
others) are not in the JavaScript bundle and are not listed yet: #160.
```

- [ ] **Step 5: "Where the app says it"** — append to its first paragraph: "About → Licences, at the end of the credits, shows the licence notices: the Unicode notice, the fonts by name and every bundled package (see Software licences above)."

- [ ] **Step 6: Format and commit**

```bash
npx prettier --write docs/license.md
git add docs/license.md
git commit -m "docs(license): how the Unicode and package notices now reach the app (#156)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7 (controller): language review, final check, PR

- [ ] **Step 1: Language review.** For each of de, fr, es, it, dispatch a fresh native-language expert subagent (France usage for fr) with: the five English texts and where each appears (row/title ≤ 16, note, section names ≤ 24 in small caps), the catalog's existing credit headings for consistency, the fact that the notices below the note are English licence texts shown verbatim, and the instruction to back-translate and flag only publication-blocking defects. Apply wording findings; re-dispatch fresh until "No findings". Any meaning change → owner.
- [ ] **Step 2:** `npm run check` and report its actual output.
- [ ] **Step 3:** Push `feat/156-licences-sheet` (`git push -u origin feat/156-licences-sheet`) and open a PR that closes #156, flagging: guardrail 7 (About gains the Licences row; nothing it states becomes untrue); the Material Symbols font (Apache-2.0) found in the Android bundle and put on the allowlist, for the owner's veto; the two spec refinements (paragraph display, the Unicode notice from its title line); #160 for native libraries.
