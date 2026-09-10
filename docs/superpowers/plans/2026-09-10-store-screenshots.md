# Store Screenshots (1320×2868) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `store` capture profile to `scripts/capture-screens.mjs` that renders every existing screen at 440×956 @3x (1320×2868 — Apple's 6.9″ class) into `design/store/`, with a self-verifying assertion that every output PNG is exactly that size, while leaving `npm run shots`'s existing 390×844 @2x `design/screens/` output byte-for-byte unchanged.

**Architecture:** Extract the two profiles' viewport/scale/output-dir/expected-dimensions facts into one small, pure, unit-testable module (`scripts/screenshot-profiles.ts`) that both a CLI flag parser and a PNG-header dimension reader live in. `capture-screens.mjs` resolves a `Profile` once from `process.argv` and threads it through the existing capture pipeline via the module-scope constant it already uses for `SEED`, `OUT` and `VIEWPORT` today — so the screen list, tap sequence, theme loop and dead-client guard are reused unmodified for both profiles rather than duplicated into a second script.

**Tech Stack:** Node 24 (native TS type-stripping, no build step), Playwright (already a devDependency), Vitest (`scripts/**/*.test.ts` is already in the test glob).

## Global Constraints

- Node 24+ required — run `nvm use` before any command below (`.nvmrc` pins it).
- TypeScript is strict, including `noUncheckedIndexedAccess` — do not weaken it; guard every indexed/record lookup explicitly.
- `.ts` files import each other with an explicit `.ts` extension when imported from a `.mjs` file (Node's native loader requires it); Vitest's own resolver accepts either — follow the existing pattern in `scripts/gen-squads.ts` (imports `.ts` with extension) and `scripts/roster-envelope.test.ts` (imports `.ts` without extension in a test file).
- No new npm dependency — parse the PNG header by hand (8-byte signature + IHDR chunk) rather than adding an image-dimensions package.
- `design/screens/` and its existing behaviour must stay **completely unchanged** — `npm run shots` (no flag) must still write byte-identical output to what it writes today.
- `SEED` (`20260821`) and the `assertLive()` dead-client guard in `capture-screens.mjs` must not change.
- Every store-profile PNG must be exactly 1320×2868; the script itself must fail (non-zero exit, thrown error) if any one isn't.
- Run `npm run check` before calling any task done, and paste its actual output.

---

### Task 1: Profile registry + CLI resolution

**Files:**

- Create: `scripts/screenshot-profiles.ts`
- Test: `scripts/screenshot-profiles.test.ts`

**Interfaces:**

- Produces: `interface Profile { name: string; viewport: { width: number; height: number }; deviceScaleFactor: number; outDir: string; expectedDimensions: { width: number; height: number } | null }`, `PROFILES: Record<string, Profile>` (keys `'design'` and `'store'`), `resolveProfile(argv: readonly string[]): Profile`.

- [ ] **Step 1: Write the failing tests**

Create `scripts/screenshot-profiles.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PROFILES, resolveProfile } from './screenshot-profiles';

describe('resolveProfile', () => {
  it('defaults to the design profile with no flag', () => {
    expect(resolveProfile([])).toBe(PROFILES.design);
  });

  it('resolves --profile=store to the store profile', () => {
    expect(resolveProfile(['--profile=store'])).toBe(PROFILES.store);
  });

  it('resolves --profile=design explicitly', () => {
    expect(resolveProfile(['--profile=design'])).toBe(PROFILES.design);
  });

  it('throws on an unknown profile name, naming the known ones', () => {
    expect(() => resolveProfile(['--profile=ipad'])).toThrow(/unknown --profile "ipad"/);
    expect(() => resolveProfile(['--profile=ipad'])).toThrow(/design, store/);
  });

  it('ignores unrelated argv entries', () => {
    expect(resolveProfile(['--headless', '--profile=store', '--foo=bar'])).toBe(PROFILES.store);
  });
});

describe('PROFILES', () => {
  it('design profile has no dimension constraint — it is a handoff aid, not a store asset', () => {
    expect(PROFILES.design.expectedDimensions).toBeNull();
  });

  it('store profile targets exactly Apple 6.9" class dimensions', () => {
    expect(PROFILES.store.viewport).toEqual({ width: 440, height: 956 });
    expect(PROFILES.store.deviceScaleFactor).toBe(3);
    expect(PROFILES.store.expectedDimensions).toEqual({ width: 1320, height: 2868 });
    expect(PROFILES.store.outDir).toBe('design/store');
  });

  it('design profile keeps its current viewport and output directory', () => {
    expect(PROFILES.design.viewport).toEqual({ width: 390, height: 844 });
    expect(PROFILES.design.deviceScaleFactor).toBe(2);
    expect(PROFILES.design.outDir).toBe('design/screens');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `nvm use && npx vitest run scripts/screenshot-profiles.test.ts`
Expected: FAIL — `Cannot find module './screenshot-profiles'` (the module doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `scripts/screenshot-profiles.ts`:

```ts
// The viewport/scale/output facts capture-screens.mjs needs per profile.
// Kept here, pure and dependency-free, so both the CLI flag parsing and the
// PNG dimension assertion can be unit-tested without spinning up a browser.

export interface Profile {
  readonly name: string;
  readonly viewport: { readonly width: number; readonly height: number };
  readonly deviceScaleFactor: number;
  readonly outDir: string;
  /** Non-null when a profile's output must land on an exact pixel size. */
  readonly expectedDimensions: { readonly width: number; readonly height: number } | null;
}

export const PROFILES: Record<'design' | 'store', Profile> = {
  design: {
    name: 'design',
    viewport: { width: 390, height: 844 }, // iPhone 14 logical size
    deviceScaleFactor: 2,
    outDir: 'design/screens',
    expectedDimensions: null,
  },
  store: {
    name: 'store',
    viewport: { width: 440, height: 956 },
    deviceScaleFactor: 3,
    outDir: 'design/store',
    // Apple's 6.9" class requirement — off-by-a-few is rejected at upload, not at review.
    expectedDimensions: { width: 1320, height: 2868 },
  },
};

const DEFAULT_PROFILE = 'design';

/** Reads `--profile=<name>` out of argv (default: design). Throws on an unrecognised name. */
export function resolveProfile(argv: readonly string[]): Profile {
  const flag = argv.find((arg) => arg.startsWith('--profile='));
  const name = flag ? flag.slice('--profile='.length) : DEFAULT_PROFILE;
  const profile = (PROFILES as Record<string, Profile | undefined>)[name];
  if (!profile) {
    throw new Error(
      `unknown --profile "${name}" — known profiles: ${Object.keys(PROFILES).join(', ')}`,
    );
  }
  return profile;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run scripts/screenshot-profiles.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both clean.

- [ ] **Step 6: Commit**

```bash
git add scripts/screenshot-profiles.ts scripts/screenshot-profiles.test.ts
git commit -m "$(cat <<'EOF'
feat(shots): add design/store capture profile registry

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: PNG dimension reader + assertion

**Files:**

- Modify: `scripts/screenshot-profiles.ts`
- Modify: `scripts/screenshot-profiles.test.ts`

**Interfaces:**

- Consumes: `Profile` from Task 1.
- Produces: `readPngDimensions(buffer: Buffer): { width: number; height: number }`, `assertProfileDimensions(profile: Profile, dims: { width: number; height: number }, filePath: string): void`.

- [ ] **Step 1: Write the failing tests**

Append to `scripts/screenshot-profiles.test.ts` (add the import too):

```ts
import {
  PROFILES,
  assertProfileDimensions,
  readPngDimensions,
  resolveProfile,
} from './screenshot-profiles';

// A minimal buffer readPngDimensions can parse: real 8-byte PNG signature,
// then an IHDR chunk header (4-byte length + "IHDR") and width/height as
// big-endian uint32s. The remaining IHDR fields and CRC are irrelevant to a
// reader that only looks at width/height, so they're left zeroed.
function fakePng(width: number, height: number): Buffer {
  const buf = Buffer.alloc(29);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.writeUInt32BE(13, 8);
  buf.write('IHDR', 12, 'ascii');
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

describe('readPngDimensions', () => {
  it('reads width and height out of the IHDR chunk', () => {
    expect(readPngDimensions(fakePng(1320, 2868))).toEqual({ width: 1320, height: 2868 });
  });

  it('rejects a buffer with the wrong signature', () => {
    const buf = fakePng(100, 100);
    buf[0] = 0x00;
    expect(() => readPngDimensions(buf)).toThrow(/bad signature/);
  });

  it('rejects a buffer whose first chunk is not IHDR', () => {
    const buf = fakePng(100, 100);
    buf.write('IDAT', 12, 'ascii');
    expect(() => readPngDimensions(buf)).toThrow(/expected IHDR.*got "IDAT"/);
  });

  it('rejects a truncated buffer', () => {
    expect(() => readPngDimensions(Buffer.alloc(10))).toThrow(/not a PNG/);
  });
});

describe('assertProfileDimensions', () => {
  it('is a no-op for a profile with no dimension constraint', () => {
    expect(() =>
      assertProfileDimensions(PROFILES.design, { width: 780, height: 1688 }, 'x.png'),
    ).not.toThrow();
  });

  it('passes silently when dimensions match exactly', () => {
    expect(() =>
      assertProfileDimensions(PROFILES.store, { width: 1320, height: 2868 }, 'x.png'),
    ).not.toThrow();
  });

  it('throws, naming the file, the actual size and the expected size, on a mismatch', () => {
    expect(() =>
      assertProfileDimensions(
        PROFILES.store,
        { width: 1319, height: 2868 },
        'design/store/01-home.png',
      ),
    ).toThrow(/design\/store\/01-home\.png is 1319×2868, expected exactly 1320×2868/);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run scripts/screenshot-profiles.test.ts`
Expected: FAIL — `readPngDimensions` / `assertProfileDimensions` are not exported.

- [ ] **Step 3: Write the implementation**

Append to `scripts/screenshot-profiles.ts`:

```ts
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Reads the IHDR-chunk width/height out of a PNG buffer — no PNG-decoding dependency needed for that. */
export function readPngDimensions(buffer: Buffer): { width: number; height: number } {
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('not a PNG file (bad signature)');
  }
  // IHDR is always the first chunk: signature(8) + length(4) + type(4), then
  // width and height as big-endian uint32s.
  const chunkType = buffer.toString('ascii', 12, 16);
  if (chunkType !== 'IHDR') {
    throw new Error(`expected IHDR as the first chunk, got "${chunkType}"`);
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

/** Throws if `dims` doesn't match the profile's required output size; no-op when the profile doesn't constrain dimensions. */
export function assertProfileDimensions(
  profile: Profile,
  dims: { width: number; height: number },
  filePath: string,
): void {
  const expected = profile.expectedDimensions;
  if (!expected) return;
  if (dims.width !== expected.width || dims.height !== expected.height) {
    throw new Error(
      `${filePath} is ${dims.width}×${dims.height}, expected exactly ${expected.width}×${expected.height} for the "${profile.name}" profile`,
    );
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run scripts/screenshot-profiles.test.ts`
Expected: PASS, all tests (8 from Task 1 + 8 new).

- [ ] **Step 5: Typecheck, lint, format**

Run: `npm run typecheck && npm run lint && npm run format:check`
Expected: all clean. If `format:check` fails, run `npm run format` and re-check.

- [ ] **Step 6: Commit**

```bash
git add scripts/screenshot-profiles.ts scripts/screenshot-profiles.test.ts
git commit -m "$(cat <<'EOF'
feat(shots): add PNG dimension reader and profile assertion

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Wire the profile into capture-screens.mjs, add `shots:store`

**Files:**

- Modify: `scripts/capture-screens.mjs`
- Modify: `package.json`

**Interfaces:**

- Consumes: `resolveProfile`, `readPngDimensions`, `assertProfileDimensions` from `./screenshot-profiles.ts` (Tasks 1–2).

- [ ] **Step 1: Update the header comment**

In `scripts/capture-screens.mjs`, replace lines 1–10:

```js
// Captures every Escuadra screen from the web build into design/screens/, for
// the Claude Design handoff. See design/SCREENS.md for what each file shows.
//
// These are web-rendered, not device truth: safe-area insets are zero on web,
// so padding reads differently than on an iPhone. Good enough for structure
// and hierarchy, not for exact spacing.
//
// Every capture is deterministic on purpose — fixed seeds, fixed answers, a
// fixed viewport — so a re-run only moves a PNG when the app actually changed
// and design can diff a capture against the previous turn's.
```

with:

```js
// Captures every Escuadra screen from the web build. Default (`npm run
// shots`) writes design/screens/, for the Claude Design handoff. `--profile=
// store` (`npm run shots:store`) instead writes design/store/ at Apple's
// 6.9" App Store dimensions — see scripts/screenshot-profiles.ts for both
// profiles' exact viewport/scale/output facts.
//
// These are web-rendered, not device truth: safe-area insets are zero on web,
// so padding reads differently than on an iPhone. Good enough for structure
// and hierarchy, not for exact spacing.
//
// Every capture is deterministic on purpose — fixed seeds, fixed answers, a
// fixed viewport — so a re-run only moves a PNG when the app actually changed
// and design can diff a capture against the previous turn's.
```

- [ ] **Step 2: Update imports and resolve the profile**

Replace lines 11–18:

```js
import { spawn, spawnSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const PORT = 8082;
const BASE = `http://localhost:${PORT}`;
const OUT = 'design/screens';
const VIEWPORT = { width: 390, height: 844 }; // iPhone 14 logical size
```

with:

```js
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import {
  assertProfileDimensions,
  readPngDimensions,
  resolveProfile,
} from './screenshot-profiles.ts';

const PORT = 8082;
const BASE = `http://localhost:${PORT}`;
const PROFILE = resolveProfile(process.argv.slice(2));
```

- [ ] **Step 3: Use the profile's viewport/scale in `openCapture`**

In `openCapture`, replace:

```js
const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 2, colorScheme });
```

with:

```js
const page = await browser.newPage({
  viewport: PROFILE.viewport,
  deviceScaleFactor: PROFILE.deviceScaleFactor,
  colorScheme,
});
```

- [ ] **Step 4: Use the profile's output dir and assert dimensions in `shoot()`**

Replace:

```js
    async shoot(base) {
      capture.assertLive();
      await page.screenshot({ path: `${OUT}/${capture.file(base)}` });
      console.log(`captured ${capture.file(base)}`);
    },
```

with:

```js
    async shoot(base) {
      capture.assertLive();
      const filePath = `${PROFILE.outDir}/${capture.file(base)}`;
      await page.screenshot({ path: filePath });
      if (PROFILE.expectedDimensions) {
        assertProfileDimensions(PROFILE, readPngDimensions(await readFile(filePath)), filePath);
      }
      console.log(`captured ${capture.file(base)}`);
    },
```

- [ ] **Step 5: Use the profile's output dir at startup**

Replace:

```js
await mkdir(OUT, { recursive: true });
```

with:

```js
await mkdir(PROFILE.outDir, { recursive: true });
```

- [ ] **Step 6: Add the `shots:store` npm script**

In `package.json`, in `"scripts"`, change:

```json
    "shots": "node scripts/capture-screens.mjs",
```

to:

```json
    "shots": "node scripts/capture-screens.mjs",
    "shots:store": "node scripts/capture-screens.mjs --profile=store",
```

- [ ] **Step 7: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both clean. (`typecheck` covers `capture-screens.mjs` importing the now-larger `screenshot-profiles.ts` surface; confirm no type errors from the `Profile` fields used.)

- [ ] **Step 8: Verify `design/screens/` is unchanged**

Run: `nvm use && npm run shots`
Expected: completes with no thrown error (design profile has `expectedDimensions: null`, so the new assertion is a no-op), then:

Run: `git status --porcelain design/screens && git diff --stat design/screens`
Expected: empty output — no files added, removed or changed. This is the acceptance check for "leave `design/screens/` and its existing behaviour completely unchanged."

- [ ] **Step 9: Verify the store profile**

Run: `npm run shots:store`
Expected: completes with no thrown error, printing 22 `captured ...` lines (11 screens × 2 themes) to `design/store/`.

Run (`--input-type=module` is required for the top-level `await` below):

```bash
node --input-type=module -e "
import { readPngDimensions } from './scripts/screenshot-profiles.ts';
import { readdir, readFile } from 'node:fs/promises';
const files = await readdir('design/store');
for (const f of files) {
  const { width, height } = readPngDimensions(await readFile(\`design/store/\${f}\`));
  if (width !== 1320 || height !== 2868) throw new Error(\`\${f}: \${width}x\${height}\`);
}
console.log(\`all \${files.length} store screenshots are 1320x2868\`);
"
```

Expected: `all 22 store screenshots are 1320x2868` (adjust the count in the expectation only if the actual printed count differs — that would mean a capture step silently didn't run, which is itself worth investigating before proceeding).

- [ ] **Step 10: Full check**

Run: `npm run check`
Expected: passes end to end. Paste the actual output.

- [ ] **Step 11: Commit**

```bash
git add scripts/capture-screens.mjs package.json
git commit -m "$(cat <<'EOF'
feat(shots): add store profile — 1320x2868 to design/store/

Adds `npm run shots:store`, writing the same screens and themes
npm run shots already captures, at Apple's 6.9" App Store dimensions
instead of the design-handoff size. Every output PNG is asserted to
be exactly 1320x2868, failing the script otherwise. design/screens/
and its existing output are unchanged.

Refs #28

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Out of scope (maintainer judgement calls, per the issue)

Do not build any of the following — they are explicitly the maintainer's to decide, not mechanical:

- Choosing the 5–6 strongest screens for the actual listing.
- The safe-area-insets risk (issue #28's "Known risk" section) — capture the store profile, then the maintainer looks at the real PNGs and decides between accepting it, emulating insets on the web build, or capturing from a real TestFlight build (#29).
- Captions or device-frame compositing.
- Comparing against a TestFlight build on a physical iPhone.

If asked to go further than this plan, stop and flag it rather than making that call.
