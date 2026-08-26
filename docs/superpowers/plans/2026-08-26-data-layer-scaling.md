# Data Layer Scaling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure Escuadra's squad data layer so it scales past a
handful of hand-maintained files: nested `data/squads/` folders by
kind/league, a codegen script that derives `lib/squads.generated.ts` and
`data/index.json` from the squad files themselves, and a `npm run check`
guard that fails if either generated file is stale.

**Architecture:** A new `scripts/gen-squads.ts` walks `data/squads/**/*.json`,
derives each squad's `kind`/`league` from its folder path, and writes two
generated artifacts: `lib/squads.generated.ts` (the `SQUAD_FILES` import
map Metro's static-import requirement forces us to hand-maintain today) and
`data/index.json` (today's hand-duplicated picker manifest). `lib/squads.ts`
keeps its existing hand-written `getSquad`/`getPlayer`/`getRoster`/`listSquads`
logic, only its `SQUAD_FILES` source changes. `npm run check` runs the
generator and then fails on any resulting git diff, so a squad file edited
without a regen is caught the same way a stale lockfile is.

**Tech Stack:** TypeScript, Node's built-in `node:fs`/`node:path` (no new
npm dependency — `fs.readdirSync(..., { recursive: true })` covers the
glob), Vitest (existing suite, unchanged in shape), Prettier (existing
config, invoked by the generator on its own output).

**Spec:** `docs/superpowers/specs/2026-08-26-data-layer-scaling-design.md`
— read it alongside this plan; this plan argues from it and defers to it on
anything this document doesn't spell out.

## Global Constraints

- Folder layout: `data/squads/nation/<id>.json` and
  `data/squads/club/<league>/<id>.json`. No other shape is valid.
- `League = 'la-liga' | 'serie-a' | 'bundesliga' | 'ligue-1' | 'premier-league' | 'ucl'`
  — closed set, matches the folder names under `data/squads/club/`.
- `SquadManifestEntry` gains `league?: League` (present for club entries,
  absent for nation entries). No other change to `Squad`, `Player`,
  `RosterEntry`, or `TeamMarker`.
- `data/index.json` and `lib/squads.generated.ts` become generated files.
  Never hand-edit either after this plan lands.
- `npm run check` must fail if `data/index.json` or
  `lib/squads.generated.ts` differs from what `npm run gen:squads` produces.
- No new runtime or dev dependency. The codegen script uses only Node
  built-ins already available (`node:fs`, `node:path`, `node:child_process`)
  plus the repo's existing `prettier`.
- `players.json` is unchanged in shape and stays a single global file — out
  of scope for this plan.
- On Windows, `node`/`npm` may not be on the shell's PATH by default. If a
  bare `npm`/`node`/`npx` call fails, prepend `C:\Program Files\nodejs` to
  `PATH` for that command (confirmed present at that path in this repo's
  environment) rather than trying alternate invocations.
- Run `npm run check` (or the specific sub-command a step names) after each
  task's code changes and report its actual output — don't claim a step
  works without having run it.

---

### Task 1: `League` type and manifest field

**Files:**

- Modify: `types/squad.ts`

**Interfaces:**

- Produces: `export type League = 'la-liga' | 'serie-a' | 'bundesliga' | 'ligue-1' | 'premier-league' | 'ucl';` and `SquadManifestEntry.league?: League`. Task 2's codegen script and Task 2's edit to `lib/squads.ts` both import `League` from `@/types/squad`.

- [ ] **Step 1: Add the `League` type and the manifest field**

In `types/squad.ts`, add the new exported type near the top (after the
existing `Position` type is a reasonable spot, but any top-level placement
is fine — there's no ordering requirement elsewhere in the file):

```typescript
export type League = 'la-liga' | 'serie-a' | 'bundesliga' | 'ligue-1' | 'premier-league' | 'ucl';
```

Then add the new optional field to `SquadManifestEntry` (currently at the
bottom of the file). The existing interface is:

```typescript
export interface SquadManifestEntry {
  id: string;
  kind: 'club' | 'nation';
  name: string;
  season: string;
  primaryColor: string;
  secondaryColor: string;
  verified: boolean;
  /** Mirrors the squad file's `marker`, since the picker never imports full
   *  squad JSON. Kept in sync by lib/squads.test.ts. */
  marker: TeamMarker;
}
```

Change it to:

```typescript
export interface SquadManifestEntry {
  id: string;
  kind: 'club' | 'nation';
  name: string;
  season: string;
  primaryColor: string;
  secondaryColor: string;
  verified: boolean;
  /** Mirrors the squad file's `marker`, since the picker never imports full
   *  squad JSON. Kept in sync by lib/squads.test.ts. */
  marker: TeamMarker;
  /** Which big-5 league (or `ucl`, for a UCL group-stage club with no big-5
   *  home) a club plays in. Present for `kind: 'club'` entries, absent for
   *  `kind: 'nation'` entries. Derived from the squad file's folder path by
   *  `scripts/gen-squads.ts`, not authored by hand. */
  league?: League;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck` (prepend `C:\Program Files\nodejs` to `PATH` first
if `npm` isn't found — see Global Constraints).

Expected: no errors. This is a purely additive type change — nothing
consumes `League` or `.league` yet, so nothing else should need to change
for this to pass.

- [ ] **Step 3: Commit**

```bash
git add types/squad.ts
git commit -m "feat(types): add League type and optional league field to SquadManifestEntry"
```

---

### Task 2: Migrate squad files, add the codegen script, rewire `lib/squads.ts`

This task is larger than the others because its three parts leave the repo
in a broken state individually — moving the squad files without the
generator breaks every existing hardcoded import in `lib/squads.ts`, and
the generator has nothing correctly-shaped to run against until the files
are moved. They land as one task so the repo builds and tests pass at every
commit.

**Files:**

- Move (git mv): all 11 files under `data/squads/*.json` into the new
  nested layout (exact moves in Step 1).
- Create: `scripts/gen-squads.ts`
- Modify (generated by the script, not by hand): `lib/squads.generated.ts` (new file), `data/index.json`
- Modify: `lib/squads.ts`

**Interfaces:**

- Consumes: `League`, `SquadManifestEntry.league` from Task 1 (`@/types/squad`).
- Produces: `lib/squads.generated.ts` exports `SQUAD_FILES: Record<string, Squad>` — `lib/squads.ts` imports this instead of hand-listing files. `scripts/gen-squads.ts` is invoked as `node scripts/gen-squads.ts` (wired into an npm script in Task 3).

- [ ] **Step 1: Move the 11 existing squad files into the new layout**

The current 5 club squads' real leagues: Arsenal → Premier League, Real
Madrid → La Liga, Barcelona → La Liga, Inter Milan → Serie A, PSG → Ligue 1.
The other 6 files are nation squads.

```bash
mkdir -p data/squads/nation data/squads/club/premier-league data/squads/club/la-liga data/squads/club/serie-a data/squads/club/ligue-1
git mv data/squads/ars.json data/squads/club/premier-league/ars.json
git mv data/squads/rma.json data/squads/club/la-liga/rma.json
git mv data/squads/bar.json data/squads/club/la-liga/bar.json
git mv data/squads/int.json data/squads/club/serie-a/int.json
git mv data/squads/psg.json data/squads/club/ligue-1/psg.json
git mv data/squads/arg.json data/squads/nation/arg.json
git mv data/squads/arm.json data/squads/nation/arm.json
git mv data/squads/bra.json data/squads/nation/bra.json
git mv data/squads/esp.json data/squads/nation/esp.json
git mv data/squads/fra.json data/squads/nation/fra.json
git mv data/squads/jpn.json data/squads/nation/jpn.json
```

Don't create a `club/bundesliga/` or `club/ucl/` directory — no current
squad belongs there. The generator (Step 2) only needs directories that
actually contain a file; `data/squads/club/bundesliga/` would be empty and
`fs.readdirSync` wouldn't find it anyway.

Do not commit yet — `lib/squads.ts` still hardcodes the old flat paths, so
the repo won't build until Steps 2-4 land. Keep working in the same
uncommitted change.

- [ ] **Step 2: Write `scripts/gen-squads.ts`**

Create `scripts/gen-squads.ts` with this exact content:

```typescript
// GENERATED FILE producer — run via `npm run gen:squads`. Regenerates
// lib/squads.generated.ts and data/index.json from every file under
// data/squads/. See docs/superpowers/specs/2026-08-26-data-layer-scaling-design.md.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import type { League, Squad, SquadManifestEntry } from '../types/squad';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const SQUADS_DIR = path.join(REPO_ROOT, 'data', 'squads');
const GENERATED_TS_PATH = path.join(REPO_ROOT, 'lib', 'squads.generated.ts');
const INDEX_JSON_PATH = path.join(REPO_ROOT, 'data', 'index.json');

const LEAGUES: League[] = ['la-liga', 'serie-a', 'bundesliga', 'ligue-1', 'premier-league', 'ucl'];

function isLeague(value: string): value is League {
  return (LEAGUES as string[]).includes(value);
}

interface Discovered {
  id: string;
  kind: 'club' | 'nation';
  league?: League;
  relPath: string; // posix-style, relative to data/squads, e.g. "nation/esp.json"
  squad: Squad;
}

function discoverSquadFiles(): Discovered[] {
  const relFiles = readdirSync(SQUADS_DIR, { recursive: true })
    .map((f) => f.split(path.sep).join('/'))
    .filter((f) => f.endsWith('.json'));

  const discovered: Discovered[] = [];
  for (const relPath of relFiles) {
    const parts = relPath.split('/');
    let kind: 'club' | 'nation';
    let league: League | undefined;
    let fileName: string;

    if (parts.length === 2 && parts[0] === 'nation') {
      kind = 'nation';
      fileName = parts[1]!;
    } else if (parts.length === 3 && parts[0] === 'club' && isLeague(parts[1]!)) {
      kind = 'club';
      league = parts[1] as League;
      fileName = parts[2]!;
    } else {
      throw new Error(
        `gen-squads: unrecognized squad file path "data/squads/${relPath}". ` +
          `Expected "nation/<id>.json" or "club/<league>/<id>.json" with <league> one of: ${LEAGUES.join(', ')}.`,
      );
    }

    const id = fileName.replace(/\.json$/, '');
    const squad = JSON.parse(readFileSync(path.join(SQUADS_DIR, relPath), 'utf-8')) as Squad;

    if (squad.id !== id) {
      throw new Error(
        `gen-squads: data/squads/${relPath} has id "${squad.id}", but its filename implies "${id}".`,
      );
    }
    if (squad.kind !== kind) {
      throw new Error(
        `gen-squads: data/squads/${relPath} has kind "${squad.kind}", but its folder implies "${kind}".`,
      );
    }

    discovered.push({ id, kind, league, relPath, squad });
  }

  const seenIds = new Set<string>();
  for (const d of discovered) {
    if (seenIds.has(d.id)) {
      throw new Error(`gen-squads: duplicate squad id "${d.id}" across multiple files.`);
    }
    seenIds.add(d.id);
  }

  discovered.sort((a, b) => a.id.localeCompare(b.id));
  return discovered;
}

function toImportIdent(id: string): string {
  const camel = id.replace(/[-_]+(.)/g, (_match, ch: string) => ch.toUpperCase());
  return `squad${camel.charAt(0).toUpperCase()}${camel.slice(1)}`;
}

function buildGeneratedTs(discovered: Discovered[]): string {
  const seenIdents = new Set<string>();
  const importLines: string[] = [];
  const mapLines: string[] = [];

  for (const d of discovered) {
    const ident = toImportIdent(d.id);
    if (seenIdents.has(ident)) {
      throw new Error(
        `gen-squads: import identifier "${ident}" (derived from id "${d.id}") collides with another squad.`,
      );
    }
    seenIdents.add(ident);
    importLines.push(`import ${ident} from '@/data/squads/${d.relPath}';`);
    mapLines.push(`  ${d.id}: ${ident} as Squad,`);
  }

  return [
    '// GENERATED FILE — run `npm run gen:squads` to regenerate. Do not hand-edit.',
    "import type { Squad } from '@/types/squad';",
    ...importLines,
    '',
    'export const SQUAD_FILES: Record<string, Squad> = {',
    ...mapLines,
    '};',
    '',
  ].join('\n');
}

function buildIndexJson(discovered: Discovered[]): string {
  const entries: SquadManifestEntry[] = discovered.map((d) => {
    const entry: SquadManifestEntry = {
      id: d.squad.id,
      kind: d.squad.kind,
      name: d.squad.name,
      season: d.squad.season,
      primaryColor: d.squad.primaryColor,
      secondaryColor: d.squad.secondaryColor,
      verified: d.squad.verified,
      marker: d.squad.marker,
    };
    if (d.kind === 'club' && d.league) entry.league = d.league;
    return entry;
  });
  return JSON.stringify(entries, null, 2) + '\n';
}

function formatWithPrettier(filePaths: string[]): void {
  const result = spawnSync('npx', ['prettier', '--write', ...filePaths], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    throw new Error(`gen-squads: prettier --write failed on ${filePaths.join(', ')}`);
  }
}

function main(): void {
  const discovered = discoverSquadFiles();
  writeFileSync(GENERATED_TS_PATH, buildGeneratedTs(discovered));
  writeFileSync(INDEX_JSON_PATH, buildIndexJson(discovered));
  formatWithPrettier([GENERATED_TS_PATH, INDEX_JSON_PATH]);
  console.log(
    `gen-squads: wrote ${discovered.length} squads to lib/squads.generated.ts and data/index.json`,
  );
}

main();
```

Notes for the implementer:

- `readdirSync(SQUADS_DIR, { recursive: true })` returns file _and_
  directory paths as strings relative to `SQUADS_DIR`; the `.endsWith('.json')`
  filter drops the directory entries.
- On Windows those relative paths use `\` — `.split(path.sep).join('/')`
  normalizes to `/` before the path is used both for path-segment parsing
  and for the generated import specifier (Metro/the `@/` alias expects
  forward slashes).
- This file is executed directly with `node scripts/gen-squads.ts` (wired
  up in Task 3) — Node's built-in TypeScript support strips the type
  annotations at runtime. Running it prints one `[MODULE_TYPELESS_PACKAGE_JSON]`
  warning to stderr because `package.json` has no `"type"` field; this is
  expected and harmless (the script still runs and exits 0) — don't try to
  silence it by adding `"type": "module"` to `package.json`, which would
  change module resolution for the whole app.

- [ ] **Step 3: Run the generator once**

```bash
node scripts/gen-squads.ts
```

(Prepend `C:\Program Files\nodejs` to `PATH` first if `node` isn't found.)

Expected: prints `gen-squads: wrote 11 squads to lib/squads.generated.ts and
data/index.json`, and creates/overwrites `lib/squads.generated.ts` and
`data/index.json`.

Confirm the new `data/index.json` is field-for-field identical to the old
hand-written one for all 11 squads, aside from `league` being present now
on the 5 club entries (`ars`/`rma`/`bar`/`int`/`psg`) and absent on the 6
nation entries. In particular, `esp`'s and `arm`'s `verified` fields should
now read `false` in the generated file — before this task, `data/index.json`
had them hand-set to `true` while their squad files already carried
`verified: false` (a pre-existing drift this migration fixes as a
byproduct, since the manifest is no longer hand-maintained).

- [ ] **Step 4: Rewire `lib/squads.ts` to import from the generated file**

Replace the current hand-written import block and `SQUAD_FILES` constant.
Today's file:

```typescript
// Static-data accessor + join layer. Squad JSON is imported directly (never
// held in a store, per CLAUDE.md) and joined against players.json here.
//
// Metro requires string-literal imports — no `require(`./squads/${id}.json`)`.
// Adding a squad means one import line + one SQUAD_FILES entry below. Fine at
// this scale (a handful of squads); a codegen step would be worth it well
// beyond that.
import indexData from '@/data/index.json';
import playersData from '@/data/players.json';
import squadArg from '@/data/squads/arg.json';
import squadArm from '@/data/squads/arm.json';
import squadArs from '@/data/squads/ars.json';
import squadBar from '@/data/squads/bar.json';
import squadBra from '@/data/squads/bra.json';
import squadEsp from '@/data/squads/esp.json';
import squadFra from '@/data/squads/fra.json';
import squadInt from '@/data/squads/int.json';
import squadJpn from '@/data/squads/jpn.json';
import squadPsg from '@/data/squads/psg.json';
import squadRma from '@/data/squads/rma.json';
import type { Player, RosterEntry, Squad, SquadManifestEntry } from '@/types/squad';

export { getAge } from './age';

const SQUAD_FILES: Record<string, Squad> = {
  ars: squadArs as Squad,
  arm: squadArm as Squad,
  rma: squadRma as Squad,
  bar: squadBar as Squad,
  int: squadInt as Squad,
  psg: squadPsg as Squad,
  bra: squadBra as Squad,
  arg: squadArg as Squad,
  esp: squadEsp as Squad,
  fra: squadFra as Squad,
  jpn: squadJpn as Squad,
};
```

Replace it with:

```typescript
// Static-data accessor + join layer. Squad JSON is imported directly (never
// held in a store, per CLAUDE.md) and joined against players.json here.
//
// SQUAD_FILES comes from lib/squads.generated.ts, produced by
// `npm run gen:squads` from every file under data/squads/. Never hand-edit
// that file or data/index.json — see scripts/gen-squads.ts.
import indexData from '@/data/index.json';
import playersData from '@/data/players.json';
import { SQUAD_FILES } from './squads.generated';
import type { Player, RosterEntry, SquadManifestEntry } from '@/types/squad';

export { getAge } from './age';
```

Everything below that (`players`, `listSquads`, `getSquad`, `getPlayer`,
`getRoster`) is unchanged — leave it exactly as it is.

- [ ] **Step 5: Verify the full suite**

```bash
npm run check
```

Expected: `typecheck`, `lint`, `format:check`, and `test` all pass. The
`gen:squads`/`git diff --exit-code` step from Task 3 doesn't exist yet at
this point in the plan — `npm run check` right now still ends at `test`, so
this command only runs the four steps that exist today. All 238 tests
should pass (the two pre-existing `verified`-flag failures for Spain and
Armenia are gone now that `data/index.json` is generated from the squad
files instead of hand-duplicated).

- [ ] **Step 6: Commit**

```bash
git add data/squads lib/squads.ts lib/squads.generated.ts data/index.json scripts/gen-squads.ts
git commit -m "feat(data): migrate squads to nested layout, generate index.json and squads.generated.ts"
```

---

### Task 3: Wire `gen:squads` into npm scripts and `check`

**Files:**

- Modify: `package.json`

**Interfaces:**

- Consumes: `scripts/gen-squads.ts` (Task 2), runnable as `node scripts/gen-squads.ts`.

- [ ] **Step 1: Add the `gen:squads` script and extend `check`**

In `package.json`'s `"scripts"` block, add a `gen:squads` entry and append
the regeneration/diff guard to the end of `check`. Current relevant lines:

```json
    "test": "vitest run",
    "check": "npm run typecheck && npm run lint && npm run format:check && npm run test",
```

Change to:

```json
    "test": "vitest run",
    "gen:squads": "node scripts/gen-squads.ts",
    "check": "npm run typecheck && npm run lint && npm run format:check && npm run test && npm run gen:squads && git diff --exit-code -- lib/squads.generated.ts data/index.json",
```

- [ ] **Step 2: Verify the guard catches drift**

First confirm a clean run passes (the committed generated files should
already match what the generator produces, since Task 2 committed the
generator's own output):

```bash
npm run check
```

Expected: passes end-to-end, including the new `git diff --exit-code` step.

Then verify the guard actually fires on drift. Hand-edit `data/index.json`
(e.g. change `"season": "2025/26"` to `"season": "2099/00"` on any entry),
save, and run:

```bash
npm run gen:squads && git diff --exit-code -- lib/squads.generated.ts data/index.json
```

Expected: the `git diff --exit-code` command exits non-zero and prints a
diff showing the hand-edit being overwritten back to the generated value
(confirming the generator is the source of truth and the guard would fail
CI on drift). Then restore the file:

```bash
git checkout -- data/index.json
```

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore(data): wire gen:squads into npm run check"
```

---

### Task 4: Update the `squad-updater` skill for the nested layout

**Files:**

- Modify: `.claude/skills/squad-updater/SKILL.md`

**Interfaces:**

- Consumes: the folder convention from Task 2 (`data/squads/nation/<id>.json`, `data/squads/club/<league>/<id>.json`) and the `npm run gen:squads` command from Task 3.

- [ ] **Step 1: Add folder guidance and change step 8's write path**

In step 8 ("Write `data/squads/<id>.json`, matching the existing shape
exactly..."), the opening line currently reads:

```markdown
8. **Write `data/squads/<id>.json`**, matching the existing shape exactly:
   `id, kind, name, season, primaryColor, secondaryColor, verified, marker,
lastUpdated, source, members`.
```

Change it to:

```markdown
8. **Write the squad file at its nested path**, matching the existing shape
   exactly: `id, kind, name, season, primaryColor, secondaryColor, verified,
marker, lastUpdated, source, members`.

   The path depends on `kind`:
   - Nation squad → `data/squads/nation/<id>.json`.
   - Club squad → `data/squads/club/<league>/<id>.json`, where `<league>` is
     whichever of these the club's real domestic league is:
     `la-liga`, `serie-a`, `bundesliga`, `ligue-1`, `premier-league`. Use
     `ucl` only for a UEFA Champions League group-stage club with no big-5
     domestic home. If a club's domestic league isn't one of the big 5,
     don't invent a folder for it — ask the user how to proceed rather than
     guessing a `League` value the codegen script doesn't recognize.
```

- [ ] **Step 2: Replace steps 10 and 10a**

The current steps 10 and 10a:

```markdown
10. **Update `data/index.json`** — add a new manifest entry, or update the
    existing one's `season`/colours in step with the squad file. Keep it in
    sync; the picker reads this file only, never the full squad JSON.

10a. **If this is a brand-new squad** (no prior entry in `data/index.json`),
it also needs wiring into `lib/squads.ts`: add a static `import` for the
new `data/squads/<id>.json` and a matching entry in `SQUAD_FILES`. Metro
requires string-literal imports, so this can't be done dynamically — the
file's own header comment says as much. Skipping this step doesn't error
at write time; it silently makes `getRoster()` return an empty array for
the new squad, which only surfaces later as failing
`lib/squads.test.ts` assertions. Do it in the same pass as writing the
squad file, not as a follow-up fix.
```

Replace both with a single step 10 (renumber nothing else):

```markdown
10. **Run `npm run gen:squads`.** This regenerates `data/index.json` and
    `lib/squads.generated.ts` from every file under `data/squads/`,
    including the one you just wrote. Never hand-edit either generated
    file, for a new squad or a refresh — `npm run check` fails if either
    one doesn't match what the generator produces from the current squad
    files.
```

- [ ] **Step 3: Update step 11 and the "Common mistakes" list**

Step 11 currently reads:

```markdown
11. **Run `npm run check`** before reporting the team done, and report its
    actual output. On Windows, `node`/`npm` may not be on the shell's PATH by
    default — if a bare `npm` call fails, locate `node.exe`'s directory
    (commonly `C:\Program Files\nodejs`) and prepend it to `PATH` for that
    command rather than trying alternate invocations one at a time.
```

Leave it as-is — `npm run check` already runs `gen:squads` again internally
(Task 3), so this step still holds; it's a useful double-check even though
step 10 above already ran the generator once.

In "Common mistakes", find this bullet:

```markdown
- Writing a brand-new squad's JSON file without also wiring it into
  `lib/squads.ts` (step 10a) — the write succeeds silently; only the test
  suite catches the omission.
```

Replace it with:

```markdown
- Writing a brand-new squad's JSON file without running `npm run gen:squads`
  (step 10) afterward — the write succeeds silently; the new squad won't
  appear in the picker or resolve in `getRoster()` until the generator
  picks it up, and `npm run check`'s diff guard is what catches the
  omission if you forget.
- Guessing a `League` folder for a club instead of checking its actual
  domestic league — the codegen script fails generation outright on an
  unrecognized folder name under `data/squads/club/`.
```

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/squad-updater/SKILL.md
git commit -m "docs(squad-updater): update for nested data/squads layout and gen:squads"
```

---

### Task 5: Update the `squad-verifier` skill's path references

**Files:**

- Modify: `.claude/skills/squad-verifier/SKILL.md`

**Interfaces:**

- Consumes: the folder convention from Task 2. Behavior is otherwise
  unchanged (per spec: "still only ever flips `verified` inside the squad
  file").

- [ ] **Step 1: Update the frontmatter description and overview**

Line 4 (frontmatter `description`) currently reads in part: `an existing
Escuadra squad file (data/squads/<id>.json)`. Change `data/squads/<id>.json`
to `data/squads/nation/<id>.json` (or `data/squads/club/<league>/<id>.json`
for a club)` in that sentence.

Line 13 (`and diff it against what's stored in `data/squads/<id>.json` and`)
— same substitution: `data/squads/<id>.json` → `data/squads/nation/<id>.json`
(or `data/squads/club/<league>/<id>.json` for a club)`.

- [ ] **Step 2: Add a path-resolution note and update step 1**

Step 1 of the Procedure currently reads:

```markdown
1. **Read the stored squad file** `data/squads/<id>.json` — note `kind`,
   `source`, and every `members` entry (`playerId`, `no`, `captain?`).
   `name`, `season`, `primaryColor`, `secondaryColor`, and `marker` are out
   of scope (see Scope above) — read past them, don't verify them.
```

Change it to:

```markdown
1. **Locate and read the stored squad file.** The path depends on `kind`
   and, for a club, `league` — check `data/index.json` for this squad's
   `kind`/`league`, or search under `data/squads/` for the file whose `id`
   matches if you're unsure. Nation squads live at
   `data/squads/nation/<id>.json`; club squads live at
   `data/squads/club/<league>/<id>.json`. Note `kind`, `source`, and every
   `members` entry (`playerId`, `no`, `captain?`). `name`, `season`,
   `primaryColor`, `secondaryColor`, and `marker` are out of scope (see
   Scope above) — read past them, don't verify them.
```

- [ ] **Step 3: Update step 6's write-path reference**

Step 6 currently ends with:

```markdown
Write only that one field in
`data/squads/<id>.json`; never touch `players.json` or `index.json`.
```

Change to:

```markdown
Write only that one field, in the squad file at its nested path
(`data/squads/nation/<id>.json` or `data/squads/club/<league>/<id>.json`);
never touch `players.json` or `index.json` — `index.json` is generated
from the squad files by `npm run gen:squads` and will pick up the flip
next time someone regenerates it (`npm run check`'s diff guard catches
the interim staleness rather than this skill needing to run the
generator itself).
```

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/squad-verifier/SKILL.md
git commit -m "docs(squad-verifier): update for nested data/squads layout"
```

---

### Task 6: Update CLAUDE.md's data model section

**Files:**

- Modify: `CLAUDE.md`

**Interfaces:**

- Consumes: the folder layout, `League` type, and generated-file rule established in Tasks 1-3. This task is documentation-only — no code interface.

- [ ] **Step 1: Replace the file-layout block**

Find this block in the "Data model" section:

```
data/index.json        squad manifest
data/players.json      { id, name, birth, position, nationality, photo: null }
data/squads/<id>.json  { id, kind: 'club'|'nation', name, season, verified,
                         primaryColor, secondaryColor, marker,
                         members: [{ playerId, no, captain? }] }
```

Replace with:

```
data/index.json                       squad manifest — GENERATED, see below
data/players.json                     { id, name, birth, position, nationality, photo: null }
data/squads/nation/<id>.json          { id, kind: 'nation', name, season, verified,
                                         primaryColor, secondaryColor, marker,
                                         members: [{ playerId, no, captain? }] }
data/squads/club/<league>/<id>.json   same shape, kind: 'club'. <league> is one of
                                       la-liga, serie-a, bundesliga, ligue-1,
                                       premier-league, ucl (see League in types/squad.ts)
```

- [ ] **Step 2: Replace the "must be duplicated identically" sentence**

Find this sentence in the "Data model" section (in the `marker` paragraph):

```
Both `data/index.json` (the picker manifest) and each squad file carry
`primaryColor`/`secondaryColor`/`marker`, since the picker never imports full
squad JSON — `marker` must be duplicated identically into `data/index.json`
(`lib/squads.test.ts` asserts the two agree).
```

Replace with:

```
Both `data/index.json` (the picker manifest) and each squad file carry
`primaryColor`/`secondaryColor`/`marker`, since the picker never imports full
squad JSON. `data/index.json` is generated from the squad files by
`npm run gen:squads` (`scripts/gen-squads.ts`) — never hand-edit it;
`npm run check` fails if it's out of sync with what the generator produces.
```

- [ ] **Step 3: Add a note on the `League` type near the shirt-number paragraph**

Immediately after the "One file per squad, so a future contribution
touches exactly one file." sentence (near the end of the Data model
section, just before the `⚠️ Squad data is LLM-generated` warning),
add a new paragraph:

```
`League` (`types/squad.ts`) is the closed set of big-5-league folder names
under `data/squads/club/`, plus `ucl` for a Champions League group-stage
club with no big-5 domestic home. `SquadManifestEntry.league` carries it on
club entries (absent on nation entries) — not consumed by any screen yet,
but available for a future picker that groups clubs by league.
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update data model section for nested squads layout and generated index.json"
```

---

## Self-Review Notes (for the plan author, already applied above)

- **Spec coverage:** folder layout (Task 2), `League` type/manifest field
  (Task 1), codegen script and its exact steps 1-4 (Task 2), `npm run check`
  guard (Task 3), migration of the 11 existing squads (Task 2 Step 1),
  `squad-updater`/`squad-verifier`/CLAUDE.md downstream updates (Tasks 4-6).
  The spec's "Scope note (nations)" and "Future scaling" sections are
  explicitly non-binding/deferred — no task needed for them.
- **No placeholders:** every step above contains literal file content, not
  a description of what to write.
- **Type/name consistency checked:** `League`, `SquadManifestEntry.league`,
  `SQUAD_FILES`, `scripts/gen-squads.ts`, `gen:squads` are spelled
  identically everywhere they're referenced across tasks.
