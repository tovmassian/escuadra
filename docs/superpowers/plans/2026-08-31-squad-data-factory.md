# Squad Data Factory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the manually-orchestrated `squad-updater` / `squad-verifier` pair with three single-purpose skills and a thin orchestrator, so a whole-repo squad audit-and-repair is one command instead of a human relaying prose between agents.

**Architecture:** Split by write hazard, not subject matter. `squad-fetcher` and `squad-verifier` are parallel-safe readers that both emit the same JSON artifact (the roster envelope); `squad-writer` is the sole owner of every shared file and runs strictly sequentially; `squad-factory` dispatches, partitions by status, and reports. The envelope contract is enforced by tested TypeScript rather than prose, because a malformed envelope from a subagent must be caught before it can mutate `players.json`.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`), Node 22.21 native type-stripping, vitest, husky, Claude Code skills (markdown + YAML frontmatter). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-31-squad-data-factory-design.md`

## Global Constraints

Every task's requirements implicitly include this section.

- **No new dependencies.** The Expo SDK is pinned to what App Store Expo Go supports; do not upgrade it and do not add runtime packages. Validation is hand-rolled, not zod/ajv.
- **TypeScript is strict, including `noUncheckedIndexedAccess`.** Do not weaken it. Avoid bare indexed access (`arr[i]`) in new code — iterate with `for...of` or `.forEach` so elements arrive already narrowed.
- **`verified` is always written `false` by the writer**, including when overwriting a squad that was previously `true`. Only `squad-verifier` may set it `true`, and only on a clean VALID verdict.
- **`photo` stays `null`.** Hard constraint #1 — no player photographs in v0, regardless of what Wikipedia carries.
- **Never invent, rotate, or arbitrarily assign a team's colour.** `primaryColor`/`secondaryColor`/`marker` are real-world fact; they are only ever written on new-team intake, from a real source.
- **Regenerate with `node scripts/gen-squads.ts`**, never `npm run gen:squads` (skips the npm wrapper, which dominates cost on Windows), and never once per team.
- **The product is called Escuadra.** "Squad Trainer"/"Squad Quiz" and similar are stale; fix on sight.
- **Run `npm run check` and report actual output** before claiming any task complete. On Windows prepend Node to PATH for the command if a bare `npm` call fails: `export PATH="/c/Program Files/nodejs:$PATH"`.
- **Never trust a prose summary of a roster table.** Always parse raw wikitext. WebFetch summarises through a model and is the wrong tool for every roster fetch in this plan.

---

### Task 1: Roster envelope contract

The keystone. Every later task references these types and helpers.

**Files:**

- Create: `scripts/roster-envelope.ts`
- Create: `scripts/roster-envelope.test.ts`
- Modify: `vitest.config.ts:13-18` (add `scripts/` to the include allowlist)
- Modify: `.gitignore` (add `.claude/tmp/`)

**Interfaces:**

- Consumes: `League`, `TeamMarker` from `types/squad.ts`
- Produces: `RosterEnvelope`, `EnvelopeMember`, `EnvelopeStatus`, `Position`, `validateEnvelope(value: unknown): string[]`, `normalizeName(name: string): string`, `changeRatio(stored: string[], parsed: string[]): number`, `BLAST_RADIUS_THRESHOLD: number`

- [ ] **Step 1: Extend the vitest allowlist**

`scripts/` now holds pure logic worth unit-testing, so it belongs in the same allowlist as `lib/`. Update the include array and the explanatory comment above it:

```ts
// lib/ and stores/ hold pure logic worth unit-testing (per CLAUDE.md,
// lib/questionEngine.ts in particular must stay React-free and testable).
// scripts/ holds the roster-envelope contract shared by the squad data
// skills — pure and equally worth pinning. theme/ and design/ are plain
// data — tokens, mark geometry, handoff re-exports — and are tested for
// internal consistency only. Screens and components are verified
// on-device instead: no RN test renderer is configured here on purpose.
export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'lib/**/*.test.ts',
      'scripts/**/*.test.ts',
      'stores/**/*.test.ts',
      'theme/**/*.test.ts',
      'design/**/*.test.ts',
    ],
  },
```

- [ ] **Step 2: Ignore the envelope scratch directory**

Append to `.gitignore`:

```
# squad-factory run scratch (roster envelopes)
.claude/tmp/
```

- [ ] **Step 3: Write the failing tests**

Create `scripts/roster-envelope.test.ts`. Note the `validEnvelope()` helper — tests mutate a copy of a known-good envelope so each case isolates exactly one defect.

```ts
import { describe, expect, it } from 'vitest';
import {
  BLAST_RADIUS_THRESHOLD,
  changeRatio,
  normalizeName,
  validateEnvelope,
  type RosterEnvelope,
} from './roster-envelope';

function validEnvelope(): RosterEnvelope {
  return {
    status: 'OK',
    team: {
      id: 'esp',
      kind: 'nation',
      name: 'Spain',
      season: '2026',
      source: 'https://en.wikipedia.org/wiki/Spain_national_football_team',
      sectionTitle: 'Current squad',
      asOf: '2026-06-10',
    },
    members: [
      {
        name: 'David Raya',
        no: 1,
        position: 'GK',
        club: 'Arsenal',
        birth: '1995-09-15',
        raw: '{{nat fs g player|no=1|pos=GK|name=[[David Raya]]}}',
      },
    ],
    warnings: [],
  };
}

describe('validateEnvelope', () => {
  it('accepts a well-formed nation envelope', () => {
    expect(validateEnvelope(validEnvelope())).toEqual([]);
  });

  it('rejects a status outside the closed set', () => {
    const env = { ...validEnvelope(), status: 'FINE' };
    expect(validateEnvelope(env).join(' ')).toMatch(/status must be one of/);
  });

  it('rejects OK with zero members, because an empty roster is never written', () => {
    const env = { ...validEnvelope(), members: [] };
    expect(validateEnvelope(env).join(' ')).toMatch(/zero parsed members is PARSE_FAILED/);
  });

  it('allows zero members when the status is already a failure', () => {
    const env = { ...validEnvelope(), status: 'PARSE_FAILED' as const, members: [] };
    expect(validateEnvelope(env)).toEqual([]);
  });

  it('rejects duplicate shirt numbers within one squad', () => {
    const env = validEnvelope();
    const first = env.members[0];
    if (!first) throw new Error('fixture must have a member');
    env.members = [first, { ...first, name: 'Someone Else' }];
    expect(validateEnvelope(env).join(' ')).toMatch(/duplicate shirt number 1/);
  });

  it('requires league on a club squad', () => {
    const env = validEnvelope();
    env.team = { ...env.team, kind: 'club' };
    expect(validateEnvelope(env).join(' ')).toMatch(/team\.league is required/);
  });

  it('forbids league on a nation squad', () => {
    const env = validEnvelope();
    env.team = { ...env.team, league: 'la-liga' };
    expect(validateEnvelope(env).join(' ')).toMatch(/team\.league must be absent/);
  });

  it('rejects a member with a position outside GK/DF/MF/FW', () => {
    const env = validEnvelope();
    const first = env.members[0];
    if (!first) throw new Error('fixture must have a member');
    env.members = [{ ...first, position: 'ST' as never }];
    expect(validateEnvelope(env).join(' ')).toMatch(/position must be one of/);
  });

  it('requires the raw wikitext line on every member', () => {
    const env = validEnvelope();
    const first = env.members[0];
    if (!first) throw new Error('fixture must have a member');
    env.members = [{ ...first, raw: '' }];
    expect(validateEnvelope(env).join(' ')).toMatch(/raw must be a non-empty string/);
  });

  it('rejects identity colours that are not six-digit hex', () => {
    const env = validEnvelope();
    env.identity = {
      primaryColor: 'red',
      secondaryColor: '#FFCC00',
      marker: { bands: ['#AA151B'], orientation: 'horizontal' },
    };
    expect(validateEnvelope(env).join(' ')).toMatch(/primaryColor must be a six-digit hex/);
  });
});

describe('normalizeName', () => {
  it('strips diacritics and case so the same player matches across pages', () => {
    expect(normalizeName('Lautaro Martínez')).toBe('lautaro martinez');
  });

  it('collapses incidental whitespace', () => {
    expect(normalizeName('  Kepa   Arrizabalaga ')).toBe('kepa arrizabalaga');
  });

  it('leaves an already-normal name alone', () => {
    expect(normalizeName('Tommy Setford')).toBe('tommy setford');
  });
});

describe('changeRatio', () => {
  it('is 0 for identical rosters regardless of order', () => {
    expect(changeRatio(['A B', 'C D'], ['C D', 'A B'])).toBe(0);
  });

  it('is 0 for rosters differing only by diacritics', () => {
    expect(changeRatio(['Lautaro Martínez'], ['Lautaro Martinez'])).toBe(0);
  });

  it('is 1 for wholly disjoint rosters', () => {
    expect(changeRatio(['A B'], ['C D'])).toBe(1);
  });

  it('stays under the blast-radius threshold for one change in a full squad', () => {
    const stored = Array.from({ length: 26 }, (_, i) => `Player ${i}`);
    const parsed = [...stored.slice(0, 25), 'New Signing'];
    expect(changeRatio(stored, parsed)).toBeLessThan(BLAST_RADIUS_THRESHOLD);
  });

  it('exceeds the blast-radius threshold when most of a squad changes', () => {
    const stored = Array.from({ length: 26 }, (_, i) => `Player ${i}`);
    const parsed = Array.from({ length: 26 }, (_, i) => `Other ${i}`);
    expect(changeRatio(stored, parsed)).toBeGreaterThan(BLAST_RADIUS_THRESHOLD);
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

```bash
export PATH="/c/Program Files/nodejs:$PATH"
npx vitest run scripts/roster-envelope.test.ts
```

Expected: FAIL — `Failed to resolve import "./roster-envelope"`.

- [ ] **Step 5: Write the implementation**

Create `scripts/roster-envelope.ts`:

```ts
// The contract between the squad data skills. squad-fetcher and
// squad-verifier both produce a RosterEnvelope; squad-writer consumes one.
// Kept as tested code rather than prose in a SKILL.md because a malformed
// envelope must be caught before it can mutate the shared players.json.
import type { League, TeamMarker } from '../types/squad';

export type EnvelopeStatus = 'OK' | 'NEEDS_DECISION' | 'SOURCE_BROKEN' | 'PARSE_FAILED';
export type Position = 'GK' | 'DF' | 'MF' | 'FW';

export interface EnvelopeMember {
  name: string;
  fullName?: string;
  no: number;
  position: Position;
  captain?: true;
  nationality?: string;
  club?: string | null;
  clubNat?: string;
  birth?: string;
  /** The literal wikitext template line this member was parsed from. */
  raw: string;
}

export interface EnvelopeIdentity {
  primaryColor: string;
  secondaryColor: string;
  marker: TeamMarker;
}

export interface RosterEnvelope {
  status: EnvelopeStatus;
  team: {
    id: string;
    kind: 'nation' | 'club';
    name: string;
    league?: League;
    season: string;
    source: string;
    sectionTitle: string;
    asOf: string | null;
  };
  /** Present ONLY on new-team intake. Absent means "not inspected" — the
   *  writer preserves whatever is stored. See the spec's identity section. */
  identity?: EnvelopeIdentity;
  members: EnvelopeMember[];
  warnings: string[];
  decisions?: string[];
}

/** Fraction of a roster that may change before the run is treated as
 *  suspicious (page restructure or vandalism, not a transfer window). */
export const BLAST_RADIUS_THRESHOLD = 0.4;

const STATUSES: EnvelopeStatus[] = ['OK', 'NEEDS_DECISION', 'SOURCE_BROKEN', 'PARSE_FAILED'];
const POSITIONS: Position[] = ['GK', 'DF', 'MF', 'FW'];
const HEX = /^#[0-9a-fA-F]{6}$/;

/** Case- and diacritic-insensitive form used for every player match.
 *  Bugs here silently merge two real people, which is why it is tested. */
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/** 1 minus the Jaccard similarity of two rosters, by normalised name.
 *  0 means identical, 1 means wholly disjoint. */
export function changeRatio(stored: string[], parsed: string[]): number {
  const a = new Set(stored.map(normalizeName));
  const b = new Set(parsed.map(normalizeName));
  let shared = 0;
  for (const name of a) {
    if (b.has(name)) shared += 1;
  }
  const union = a.size + b.size - shared;
  return union === 0 ? 0 : (union - shared) / union;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/** Returns a list of human-readable problems; empty means valid. */
export function validateEnvelope(value: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) return ['envelope must be a JSON object'];

  const status = value.status;
  if (!STATUSES.includes(status as EnvelopeStatus)) {
    errors.push(`status must be one of ${STATUSES.join(', ')}; got ${JSON.stringify(status)}`);
  }

  if (!isRecord(value.team)) {
    errors.push('team is required and must be an object');
  } else {
    const team = value.team;
    for (const field of ['id', 'name', 'season', 'source', 'sectionTitle'] as const) {
      if (!nonEmptyString(team[field])) {
        errors.push(`team.${field} must be a non-empty string`);
      }
    }
    if (team.kind !== 'nation' && team.kind !== 'club') {
      errors.push(`team.kind must be "nation" or "club"; got ${JSON.stringify(team.kind)}`);
    }
    if (team.kind === 'club' && !nonEmptyString(team.league)) {
      errors.push('team.league is required on club squads');
    }
    if (team.kind === 'nation' && team.league !== undefined) {
      errors.push('team.league must be absent on nation squads');
    }
    if (team.asOf !== null && typeof team.asOf !== 'string') {
      errors.push('team.asOf must be a string or null');
    }
  }

  if (!Array.isArray(value.members)) {
    errors.push('members must be an array');
  } else {
    if (status === 'OK' && value.members.length === 0) {
      errors.push(
        'status OK requires a non-empty members array; zero parsed members is PARSE_FAILED',
      );
    }
    const seenNumbers = new Set<number>();
    const seenNames = new Set<string>();
    value.members.forEach((entry, index) => {
      const at = `members[${index}]`;
      if (!isRecord(entry)) {
        errors.push(`${at} must be an object`);
        return;
      }
      if (!nonEmptyString(entry.name)) errors.push(`${at}.name must be a non-empty string`);
      if (!nonEmptyString(entry.raw)) errors.push(`${at}.raw must be a non-empty string`);
      if (!POSITIONS.includes(entry.position as Position)) {
        errors.push(`${at}.position must be one of ${POSITIONS.join(', ')}`);
      }
      if (typeof entry.no !== 'number' || !Number.isInteger(entry.no)) {
        errors.push(`${at}.no must be an integer shirt number`);
      } else if (seenNumbers.has(entry.no)) {
        errors.push(`${at} duplicate shirt number ${entry.no}`);
      } else {
        seenNumbers.add(entry.no);
      }
      if (nonEmptyString(entry.name)) {
        const key = normalizeName(entry.name);
        if (seenNames.has(key)) errors.push(`${at} duplicate player name ${entry.name}`);
        seenNames.add(key);
      }
    });
  }

  if (!Array.isArray(value.warnings)) {
    errors.push('warnings must be an array (use [] when there are none)');
  }

  if (value.identity !== undefined) {
    if (!isRecord(value.identity)) {
      errors.push('identity, when present, must be an object');
    } else {
      const identity = value.identity;
      for (const field of ['primaryColor', 'secondaryColor'] as const) {
        if (typeof identity[field] !== 'string' || !HEX.test(identity[field] as string)) {
          errors.push(`identity.${field} must be a six-digit hex colour like #AA151B`);
        }
      }
      if (!isRecord(identity.marker) || !Array.isArray(identity.marker.bands)) {
        errors.push('identity.marker must be a TeamMarker with a bands array');
      }
    }
  }

  return errors;
}
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
npx vitest run scripts/roster-envelope.test.ts
```

Expected: PASS, 18 tests.

- [ ] **Step 7: Run the full check**

```bash
npm run check
```

Expected: PASS. If `format:check` fails, run `npx prettier --write scripts/ vitest.config.ts` and re-run.

- [ ] **Step 8: Commit**

```bash
git add scripts/roster-envelope.ts scripts/roster-envelope.test.ts vitest.config.ts .gitignore
git commit -m "feat(scripts): add the roster envelope contract shared by the squad skills"
```

---

### Task 2: Envelope validation CLI

The interface the skills actually invoke. A skill cannot import a module; it runs a command.

**Files:**

- Create: `scripts/envelope-check.ts`

**Interfaces:**

- Consumes: `validateEnvelope`, `changeRatio`, `BLAST_RADIUS_THRESHOLD`, `RosterEnvelope` from `scripts/roster-envelope.ts` (Task 1)
- Produces: CLI `node scripts/envelope-check.ts [--against <storedSquad.json>] <path...>` — exit 0 when every envelope is valid, exit 1 with one problem per line otherwise. The `--against` form additionally prints the change ratio against a stored squad, warning past `BLAST_RADIUS_THRESHOLD` **without** affecting the exit code.

Without `--against`, `changeRatio` and `BLAST_RADIUS_THRESHOLD` would be exported, tested and never called, and the spec's blast-radius rule would degrade to a skill eyeballing a percentage. This mode is what makes the tested threshold the one actually enforced.

- [ ] **Step 1: Write the implementation**

Create `scripts/envelope-check.ts`:

> Execution note: the shipped code imports `'./roster-envelope.ts'`; the extensionless specifier below cannot resolve under Node 22 type-stripping.

```ts
// CLI guard the squad skills run against every roster envelope before it is
// acted on. Skills cannot import a module, so the contract is reachable as a
// command:
//   node scripts/envelope-check.ts <envelope.json...>
//   node scripts/envelope-check.ts --against <storedSquad.json> <envelope.json...>
// The --against form also reports how much of the stored roster the envelope
// changes, warning past BLAST_RADIUS_THRESHOLD. That warning is advisory by
// design: an on-demand run has an operator reading the report. Promoting it to
// a hard failure is the documented change if this ever runs on a schedule.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  BLAST_RADIUS_THRESHOLD,
  changeRatio,
  validateEnvelope,
  type RosterEnvelope,
} from './roster-envelope';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');

function readJson(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

/** Display names of a stored squad's members, resolved through players.json. */
function storedMemberNames(squadPath: string): string[] {
  const squad = readJson(squadPath) as { members?: { playerId?: string }[] };
  const players = readJson(path.join(REPO_ROOT, 'data', 'players.json')) as {
    id: string;
    name: string;
  }[];
  const nameById = new Map(players.map((player) => [player.id, player.name]));
  const names: string[] = [];
  for (const member of squad.members ?? []) {
    const name = member.playerId === undefined ? undefined : nameById.get(member.playerId);
    if (name !== undefined) names.push(name);
  }
  return names;
}

const argv = process.argv.slice(2);
let againstPath: string | undefined;
let paths = argv;

const flagIndex = argv.indexOf('--against');
if (flagIndex !== -1) {
  const value = argv[flagIndex + 1];
  if (value === undefined) {
    console.error('--against needs the path of a stored squad file');
    process.exit(2);
  }
  againstPath = value;
  paths = [...argv.slice(0, flagIndex), ...argv.slice(flagIndex + 2)];
}

if (paths.length === 0) {
  console.error(
    'usage: node scripts/envelope-check.ts [--against <storedSquad.json>] <envelope.json...>',
  );
  process.exit(2);
}

let failed = false;
for (const filePath of paths) {
  let parsed: unknown;
  try {
    parsed = readJson(filePath);
  } catch (error) {
    console.error(`${filePath}: not readable as JSON — ${(error as Error).message}`);
    failed = true;
    continue;
  }

  const errors = validateEnvelope(parsed);
  if (errors.length > 0) {
    for (const message of errors) console.error(`${filePath}: ${message}`);
    failed = true;
    continue;
  }

  console.log(`${filePath}: OK`);

  if (againstPath !== undefined) {
    const envelope = parsed as RosterEnvelope;
    const ratio = changeRatio(
      storedMemberNames(againstPath),
      envelope.members.map((member) => member.name),
    );
    const percent = Math.round(ratio * 100);
    if (ratio > BLAST_RADIUS_THRESHOLD) {
      console.warn(
        `${filePath}: BLAST RADIUS — ${percent}% of the stored roster changes ` +
          `(threshold ${Math.round(BLAST_RADIUS_THRESHOLD * 100)}%). Confirm the source page ` +
          `was not restructured or vandalised before writing.`,
      );
    } else {
      console.log(`${filePath}: change ratio ${percent}%`);
    }
  }
}

process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Verify it accepts a valid envelope**

```bash
mkdir -p .claude/tmp/squad-factory/plan-check
cat > .claude/tmp/squad-factory/plan-check/esp.json <<'JSON'
{
  "status": "OK",
  "team": {
    "id": "esp", "kind": "nation", "name": "Spain", "season": "2026",
    "source": "https://en.wikipedia.org/wiki/Spain_national_football_team",
    "sectionTitle": "Current squad", "asOf": "2026-06-10"
  },
  "members": [
    { "name": "David Raya", "no": 1, "position": "GK", "club": "Arsenal",
      "birth": "1995-09-15", "raw": "{{nat fs g player|no=1|pos=GK|name=[[David Raya]]}}" }
  ],
  "warnings": []
}
JSON
node scripts/envelope-check.ts .claude/tmp/squad-factory/plan-check/esp.json
echo "exit: $?"
```

Expected: prints `... esp.json: OK`, `exit: 0`.

- [ ] **Step 3: Verify it rejects a malformed envelope**

```bash
cat > .claude/tmp/squad-factory/plan-check/bad.json <<'JSON'
{ "status": "OK", "team": { "id": "x", "kind": "club", "name": "X", "season": "2026",
  "source": "https://example.org", "sectionTitle": "Current squad", "asOf": null },
  "members": [], "warnings": [] }
JSON
node scripts/envelope-check.ts .claude/tmp/squad-factory/plan-check/bad.json
echo "exit: $?"
```

Expected: two errors — `team.league is required on club squads` and `status OK requires a non-empty members array` — and `exit: 1`.

- [ ] **Step 4: Verify the blast-radius mode warns without failing**

The step-2 fixture holds one member; Spain's stored squad holds a full roster, so almost all of it "changes". That is exactly the shape of a page restructure, and it must warn rather than fail:

```bash
node scripts/envelope-check.ts --against data/squads/nation/esp.json .claude/tmp/squad-factory/plan-check/esp.json
echo "exit: $?"
```

Expected: `... esp.json: OK`, then a `BLAST RADIUS — <N>% of the stored roster changes` line with `<N>` well above 40, and `exit: 0`. A non-zero exit here is a bug: the warning is advisory and must not fail an on-demand run.

- [ ] **Step 5: Clean up the scratch fixtures and run the full check**

```bash
rm -rf .claude/tmp/squad-factory/plan-check
npm run check
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/envelope-check.ts
git commit -m "feat(scripts): add envelope-check CLI for the squad data skills"
```

---

### Task 3: Pre-commit data-integrity guardrail

Moves the "generated files match the squad files" guarantee from push time to commit time, so a broken commit never needs a follow-up fix commit.

**Files:**

- Create: `.husky/pre-commit`

**Interfaces:**

- Consumes: `scripts/gen-squads.ts` (existing)
- Produces: nothing importable — a git hook

- [ ] **Step 1: Write the hook**

Create `.husky/pre-commit`, matching the house comment style of `.husky/pre-push`:

```sh
# Gate: a commit can never contain squad data out of sync with its generated
# index. Cheap subset of `npm run check` (one node start, no typecheck/lint/
# tests) — the full suite still runs at pre-push.
# Bypass in a genuine emergency with `git commit --no-verify`.
node scripts/gen-squads.ts
git diff --exit-code -- lib/squads.generated.ts data/index.json
```

This deliberately **fails rather than auto-staging**. `gen-squads.ts` reads the working tree, not the index, so a `git add` inside the hook would leak unstaged squad edits into a partial commit.

- [ ] **Step 2: Verify the hook passes on a clean tree**

```bash
git add .husky/pre-commit
git commit -m "chore(husky): block commits whose generated squad files are stale"
```

Expected: commit succeeds. The generator runs and produces no diff.

- [ ] **Step 3: Verify the hook actually blocks a stale commit**

Confirm the tree is otherwise clean first, then make a squad edit that changes generator output and try to commit only that file:

```bash
git status --short   # must be empty before proceeding
node -e "const p='data/squads/nation/esp.json';const fs=require('fs');const s=JSON.parse(fs.readFileSync(p,'utf8'));s.season='9999';fs.writeFileSync(p,JSON.stringify(s,null,2)+'\n');"
git add data/squads/nation/esp.json
git commit -m "test: this commit must be rejected"
echo "exit: $?"
```

Expected: non-zero exit — the hook regenerates `data/index.json`, `git diff --exit-code` sees it changed, and the commit is refused.

- [ ] **Step 4: Restore the deliberately-broken state**

```bash
git reset
git checkout -- data/squads/nation/esp.json data/index.json lib/squads.generated.ts
git status --short   # must be empty
```

Expected: empty output. If anything else appears, stop and investigate before continuing.

---

### Task 4: Shared wikitext parsing reference

One home for rules currently duplicated as prose in two SKILL.md files.

**Files:**

- Create: `.claude/skills/squad-factory/references/wikitext-roster-parsing.md`

**Interfaces:**

- Produces: a reference path that `squad-fetcher` and `squad-verifier` both cite instead of restating rules

- [ ] **Step 1: Write the reference**

The file has no frontmatter (it is a reference, not a skill). Port these rules verbatim from the current `squad-updater` SKILL.md so nothing is lost — this is a move, not a rewrite:

1. **The never-trust-prose rule**, stated first and in full: asking a fetch tool to list players runs the page through a summarising model that paraphrases, drops or reorders tabular detail with no signal that it did. Always pull raw wikitext and parse the template lines. WebFetch always summarises, so it is the wrong tool regardless of prompt; use a direct HTTP GET.
2. **The two-step fetch**, with both URL forms literal:
   - `https://en.wikipedia.org/w/api.php?action=parse&page=<Title>&prop=sections&format=json`
   - `https://en.wikipedia.org/w/index.php?title=<Title>&action=raw&section=<N>`
3. **Section selection**: prefer "Current squad"; fall back to "Recent call-ups" and record that it is a call-up list rather than a contract roster, plus the section's "as of" date.
4. **The two template families**, with a full literal example of each:
   - `{{Fs player|no=1|nat=ESP|pos=GK|name=[[Josep Martínez]]}}` — clubs; `nat` is a 3-letter FIFA nationality code.
   - `{{nat fs g player|no=1|pos=GK|name=[[David Raya]]|age={{birth date and age|df=y|1995|9|15}}|caps=14|goals=0|club=[[Arsenal F.C.|Arsenal]]|clubnat=ENG}}` — nations; no `nat`, but `club`/`clubnat` and an exact birth date.
5. **Field extraction**: `no`, `pos` (already GK/DF/MF/FW — use as-is), display name (text after `|` inside `[[...]]`, else the link target), `other=[[Captain (association football)|captain]]` → `captain: true` (ignore vice-captain — no field for it).
6. **The drop rule**: a row with no `no=` value is dropped from `members`. A membership without a shirt number cannot be quizzed and `no` is required by the data model.
7. **Page title resolution**: clubs are usually `<Club_Name>`; nations are `<Country>_national_football_team`.
8. **The field-source table**, ported verbatim from `squad-updater`'s "Quick reference" (shirt number, position, player nationality, current club, birth date, captain — club column vs nation column).

Close with a pointer back to `docs/superpowers/specs/2026-08-31-squad-data-factory-design.md` and a note that both `squad-fetcher` and `squad-verifier` read this file rather than restating it.

- [ ] **Step 2: Verify the contractual details survived the move**

```bash
grep -c "action=raw" .claude/skills/squad-factory/references/wikitext-roster-parsing.md
grep -c "nat fs g player" .claude/skills/squad-factory/references/wikitext-roster-parsing.md
grep -c "Fs player" .claude/skills/squad-factory/references/wikitext-roster-parsing.md
```

Expected: each at least 1.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/squad-factory/references/wikitext-roster-parsing.md
git commit -m "docs(skills): extract shared wikitext roster parsing reference"
```

---

### Task 5: squad-fetcher skill

The read half of the retired `squad-updater` (its steps 1-6). Parallel-safe, writes only its own envelope.

**Files:**

- Create: `.claude/skills/squad-fetcher/SKILL.md`

**Interfaces:**

- Consumes: the Task 4 reference; the Task 2 CLI
- Produces: an envelope at `.claude/tmp/squad-factory/<runId>/<squadId>.json`, and a one-line return of the form `<status> <squadId> <path>`

- [ ] **Step 1: Write the frontmatter**

```yaml
---
name: squad-fetcher
context: fork
description: Use when fetching an Escuadra team's current roster from Wikipedia into a roster envelope — new-team intake, or a full re-read of a squad. Read-only: parses raw wikitext and writes one envelope JSON file, never touching players.json, squad files, or the generated index.
---
```

- [ ] **Step 2: Write the skill body**

Required content, each item non-negotiable:

- **Overview** naming the one output (an envelope file) and the one guarantee (nothing else on disk is touched).
- **A pointer to `.claude/skills/squad-factory/references/wikitext-roster-parsing.md`** for all parsing rules, explicitly instructing the reader to follow it rather than improvise. Do not restate the rules here.
- **Procedure**: resolve page title → find section index → fetch raw wikitext → parse members → determine squad id (reuse from `data/index.json` when the team is known; otherwise mint a unique 3-4 letter lowercase id following the existing convention, e.g. `ars`, `rma`, `int`, `bra`) → on intake only, read real identity colours and build the `marker`.
- **The identity rule**, stated explicitly: include the `identity` key **only** on new-team intake. On a re-read of an existing squad, omit it entirely — an absent key means "not inspected" and preserves what is stored. Never emit `identity` with guessed or rotated colours; a single-colour club gets a one-entry `bands` array, and a nation's marker is its flag with national emblems and coats of arms omitted by design.
- **The output contract**: write the envelope to `.claude/tmp/squad-factory/<runId>/<squadId>.json` using the `RosterEnvelope` shape, then run `node scripts/envelope-check.ts <path>` and fix any reported problem before returning. Return one line: `<status> <squadId> <path>`. Never return the envelope contents as prose.
- **The no-questions rule**: this skill runs as one of many parallel subagents and cannot prompt the operator. An ambiguous team name (e.g. "Milan" → AC Milan vs Inter Milan) sets `status: NEEDS_DECISION` and lists the candidates in `decisions[]`. A club whose domestic league is outside the closed `League` set is also `NEEDS_DECISION` — never invent a league folder.
- **Failure statuses**: `SOURCE_BROKEN` when the page 404s, has moved, or has neither a "Current squad" nor a "Recent call-ups" section; `PARSE_FAILED` when zero members parse or the template block is malformed. State plainly that zero parsed members is `PARSE_FAILED`, never an empty `OK` squad.
- **Common mistakes**, at minimum: using WebFetch or any summarising tool for the roster; writing to `players.json` or running the generator (neither is this skill's job); emitting `identity` on a maintenance re-read; guessing a `League`; returning `OK` with an empty roster.

- [ ] **Step 3: Verify the contractual terms are present**

```bash
for term in NEEDS_DECISION SOURCE_BROKEN PARSE_FAILED envelope-check wikitext-roster-parsing; do
  printf '%s: ' "$term"; grep -c "$term" .claude/skills/squad-fetcher/SKILL.md
done
```

Expected: every count at least 1.

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/squad-fetcher/SKILL.md
git commit -m "feat(skills): add squad-fetcher, the read half of the retired squad-updater"
```

---

### Task 6: squad-writer skill

The write half of the retired `squad-updater` (its steps 7-11). Sole owner of every shared file.

**Files:**

- Create: `.claude/skills/squad-writer/SKILL.md`

**Interfaces:**

- Consumes: envelope paths produced by Task 5 or Task 7; `normalizeName` semantics from Task 1
- Produces: written squad files, an updated `players.json`, regenerated `data/index.json` and `lib/squads.generated.ts`; a per-team change summary

- [ ] **Step 1: Write the frontmatter**

```yaml
---
name: squad-writer
context: fork
description: Use when applying one or more validated roster envelopes to Escuadra's data — writing squad files, reconciling players.json, and regenerating the index. The only skill that writes shared squad data; runs teams strictly sequentially and never in parallel.
---
```

- [ ] **Step 2: Write the skill body**

Required content:

- **Overview** stating that this skill accepts a **list** of envelope paths for one batch, processes them one team at a time, and is the only component permitted to write `players.json` or the generated files.
- **The parallel prohibition**, with its reason: every team writes to the same `players.json` and the same generated outputs, so concurrent runs race and clobber. Never dispatch teams here in parallel, and never run two `squad-writer` invocations at once.
- **The entry gate**: run `node scripts/envelope-check.ts <path...>` across every envelope first, and refuse the batch if any fails. Process only envelopes whose `status` is `OK`.
- **Per-team procedure**, in order: reconcile members against `players.json` → write the squad file at its nested path (`data/squads/nation/<id>.json`, or `data/squads/club/<league>/<id>.json`) → set `verified: false` → set `lastUpdated` to today's ISO date and `source` to the envelope's `team.source`.
- **The merge rule**, stated as the hard invariant it is: `members` is always a **full replace**; `identity` is **merged only when the envelope carries it**. An absent `identity` key preserves the stored `primaryColor`, `secondaryColor`, and `marker`. Note the consequence in the skill itself — getting this wrong wipes every marker in the repo on the first maintenance sweep.
- **Player reconciliation rules**: match on normalised name (case-insensitive, diacritics stripped, whitespace collapsed — the `normalizeName` in `scripts/roster-envelope.ts` is the reference implementation) **plus `birth` where both sides have it**; fall back to name alone only when no birth date is available. On match, reuse the `id` and update whichever of `club`, `position`, `nationality` changed, never `photo`. On no match, create an entry following the id conventions already in the file (kebab-case surname; a first-name or disambiguated form where the existing data already does so, e.g. `lautaro`, `pio-esposito`). Record that the real player record shape is `{ id, name, fullName, birth, position, nationality, club, photo }`.
- **The ambiguity rule**: on multiple candidate matches, or a name match whose `birth` conflicts, **do not guess and do not partially write**. Abandon that team with a `NEEDS_DECISION` finding naming the candidates, leaving its files untouched. State the reason: a half-written squad file, or two real people merged into one record, is far worse than one team deferred. Atomicity is per team — a team lands completely or not at all.
- **`verified: false`, always**, including when overwriting a previously-`true` squad, because scraping is not the source check the flag requires. Say so in the report when downgrading.
- **The batch-end regenerate**: after the last team, run `node scripts/gen-squads.ts` **once**. Not once per team — the generator rebuilds from every file under `data/squads/` on each run, so per-team invocation is O(n) redundant work. Use the direct `node` call, not `npm run gen:squads`.
- **Report**: per team, players added / removed / moved club, number changes, the captain, the section "as of" date, and the `source` and `lastUpdated` written.
- **Common mistakes**, at minimum: running teams in parallel; regenerating per team; overwriting identity fields from an envelope that has no `identity` key; duplicating a player rather than matching an existing entry; guessing through an ambiguous name match; setting or leaving `verified: true`; populating `photo`; hand-editing `data/index.json` or `lib/squads.generated.ts`.

- [ ] **Step 3: Verify the contractual terms are present**

```bash
for term in "full replace" "gen-squads.ts" "verified" "NEEDS_DECISION" "envelope-check"; do
  printf '%s: ' "$term"; grep -c "$term" .claude/skills/squad-writer/SKILL.md
done
```

Expected: every count at least 1.

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/squad-writer/SKILL.md
git commit -m "feat(skills): add squad-writer, sole owner of shared squad data"
```

---

### Task 7: squad-verifier modifications

Three changes. Scope, verdicts, parallel dispatch and the `verified`-only write rule all stay as they are.

**Files:**

- Modify: `.claude/skills/squad-verifier/SKILL.md`

**Interfaces:**

- Consumes: the Task 4 reference; the Task 2 CLI
- Produces: unchanged worksheet/verdict, **plus** an envelope per team at the Task 5 path, so `squad-writer` can consume a verifier result directly

- [ ] **Step 1: Replace the duplicated parsing rules with a reference pointer**

The "Critical rule: never trust prose extraction of the roster table" section and the two-URL fetch detail in step 3 both restate what now lives in `.claude/skills/squad-factory/references/wikitext-roster-parsing.md`. Replace them with a pointer instructing the reader to follow that file, keeping a one-line summary of the never-trust-prose rule so the warning is not lost at a glance.

- [ ] **Step 2: Add the envelope output to the per-team procedure**

Add a step after the diff (current step 4) requiring the subagent to write a `RosterEnvelope` describing the **live Wikipedia roster it just parsed** to `.claude/tmp/squad-factory/<runId>/<squadId>.json`, then validate it with `node scripts/envelope-check.ts <path>`.

State explicitly:

- **Omit the `identity` key.** This skill is forbidden from checking `primaryColor`, `secondaryColor`, `marker` and `season`, so it must not emit them — an absent key is what tells `squad-writer` to preserve the stored values.
- The envelope is the machine handoff; the worksheet remains the human report. Neither replaces the other.
- Set `status` to `OK` when the page parsed cleanly, regardless of the _verdict_ — `status` describes the fetch, `verdict` describes the comparison. A `STALE` team still produces an `OK` envelope. Use `SOURCE_BROKEN` / `PARSE_FAILED` only when the fetch or parse itself failed.

- [ ] **Step 3: Add the blast-radius warning**

Require that when the parsed roster differs from the stored one in more than 40% of members, the envelope gains a `warnings[]` entry naming the ratio. Note that on-demand this is advisory — the operator reads the report — and that it is the designated promotion point to a hard block if the factory is ever moved to a schedule.

- [ ] **Step 4: Correct the now-false absolute about writes**

The skill currently says `verified` is "the only thing this skill may write — nothing else, ever," which stops being true once this skill writes an envelope and the orchestrator regenerates `index.json` after a verify pass. Rewrite the rule to its true form: **`verified` is the only field of committed squad data this skill may write.** Envelope files under `.claude/tmp/` are run scratch, not data; `index.json` changing as a downstream consequence of regeneration is derived state, not this skill's write. Keep the prohibition on touching rosters, `players.json`, and any other squad-file field exactly as strict as it is now.

Also update the corresponding "Common mistakes" bullet so it matches the corrected rule.

- [ ] **Step 5: Verify the changes landed and nothing was lost**

```bash
for term in "wikitext-roster-parsing" "envelope-check" "identity" "40%"; do
  printf '%s: ' "$term"; grep -c "$term" .claude/skills/squad-verifier/SKILL.md
done
grep -c "primaryColor" .claude/skills/squad-verifier/SKILL.md   # scope section must survive
```

Expected: every count at least 1.

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/squad-verifier/SKILL.md
git commit -m "feat(skills): have squad-verifier emit a roster envelope for the writer"
```

---

### Task 8: squad-factory orchestrator

Dispatches, partitions, sequences, reports. Performs no data work of its own.

**Files:**

- Create: `.claude/skills/squad-factory/SKILL.md`

**Interfaces:**

- Consumes: `squad-fetcher` (Task 5), `squad-writer` (Task 6), `squad-verifier` (Task 7)
- Produces: the operator-facing run report

- [ ] **Step 1: Write the frontmatter**

```yaml
---
name: squad-factory
description: Use when adding or maintaining Escuadra squad data at batch scale — auditing and repairing existing teams, or taking on new clubs and nations. Orchestrates squad-verifier, squad-fetcher and squad-writer across many teams, running reads in parallel and writes sequentially, and reports what changed.
---
```

No `context: fork` — the orchestrator dispatches subagents and compiles their results, so it stays in the session.

- [ ] **Step 2: Write the skill body**

Required content:

- **The prime rule, stated first**: this skill orchestrates and never performs data work. It does not fetch Wikipedia, parse wikitext, reconcile a player, or edit a data file. If it finds itself doing any of those, the boundary has been drawn wrong and it must dispatch instead.
- **Two modes**: `intake` (new teams by name; phase 1 dispatches `squad-fetcher`) and `maintain` (existing teams by id, or `all`; phase 1 dispatches `squad-verifier`). Every phase after the first is shared.
- **A run id**, minted once per run (an ISO timestamp is fine), giving `.claude/tmp/squad-factory/<runId>/` as the envelope directory passed to every subagent.
- **The six phases**, in order, with concurrency stated for each:
  1. **read** — parallel. One `Agent` call per team: `subagent_type: general-purpose`, `model: "sonnet"` pinned explicitly, no `isolation`, prompt instructing the subagent to invoke `squad-fetcher` or `squad-verifier` via the Skill tool with that team and the run's envelope directory. Run in the background and collect results.
  2. **partition** — by returned status. Only `OK` proceeds. On `maintain`, also drop teams whose verdict was `VALID`: there is nothing to write.
  3. **write** — sequential. A single `squad-writer` invocation taking the whole list of surviving envelope paths. Never one call per team, and never parallel.
  4. **regenerate** — this is `squad-writer`'s own batch-end generator run, not a separate actor. It is listed as a phase because phase 5 must read a consistent tree.
  5. **re-verify** — parallel. `squad-verifier` over the teams just written, because the writer's own parse can be wrong or incomplete; without this the report says "we ran the fix" rather than "the fix is correct".
  6. **report** — compile.
- **The final regenerate**: after phase 5, run `node scripts/gen-squads.ts` once more. Phase 5 flips `verified` flags that `data/index.json` must pick up. Two generator runs per batch, never 2N.
- **Completion**: a run is done when every dispatched team holds a terminal status. A team may terminate at any phase; failing at phase 1 is terminal and must not block or delay the rest of the batch.
- **No mid-run questions.** Subagents cannot prompt, so every decision surfaces in the final report. The orchestrator must not stop a batch to ask about one team.
- **No auto-commit.** The run leaves the working tree dirty and reports; reviewing and committing stay with the operator.
- **Report format**, given as a literal template: a summary line (`squad-factory <mode> — N teams, N valid, N refreshed, N need a decision`), then a `NEEDS DECISION` block first because it is the only section asking anything of the operator, then `Refreshed` with per-team change detail, then `Valid` as one line per team. Preserve `squad-verifier`'s philosophy: a clean team is one line, and detail appears only where the operator must act.
- **Common mistakes**, at minimum: doing the fetching or writing itself instead of dispatching; running `squad-writer` in parallel or once per team; skipping phase 5 and reporting a fix as verified; blocking the batch on one team's failure; regenerating per team; committing on the operator's behalf.

- [ ] **Step 3: Verify the phase contract is present**

```bash
for term in "sonnet" "sequential" "parallel" "gen-squads.ts" "NEEDS DECISION" "re-verify"; do
  printf '%s: ' "$term"; grep -c "$term" .claude/skills/squad-factory/SKILL.md
done
```

Expected: every count at least 1.

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/squad-factory/SKILL.md
git commit -m "feat(skills): add squad-factory orchestrator"
```

---

### Task 9: Retire squad-updater and fix documentation drift

**Files:**

- Delete: `.claude/skills/squad-updater/SKILL.md`
- Modify: `CLAUDE.md` (data model section; reference to the skill set)

**Interfaces:**

- Consumes: Tasks 5, 6, 8 (nothing may be deleted until its replacement exists)

- [ ] **Step 1: Confirm every squad-updater rule has a new home**

Before deleting, walk the retired skill's twelve steps and confirm each landed: steps 1-6 → `squad-fetcher`, steps 7-11 → `squad-writer`, step 12 → `squad-factory`'s report phase, parsing rules → the Task 4 reference. Confirm each "Common mistakes" bullet also survives somewhere. Report any rule with no new home and add it before continuing — this step is a gate, not a formality.

- [ ] **Step 2: Delete the skill**

```bash
git rm -r .claude/skills/squad-updater
```

- [ ] **Step 3: Correct the players.json shape in CLAUDE.md**

The data model section describes `data/players.json` as `{ id, name, birth, position, nationality, photo: null }`. The real records also carry `fullName` and `club`. Update it to `{ id, name, fullName, birth, position, nationality, club, photo: null }`.

- [ ] **Step 4: Point CLAUDE.md at the new skill set**

Replace any reference to `squad-updater` with the new arrangement, in one or two sentences: squad data is managed by `squad-factory`, which orchestrates `squad-fetcher` (parallel reads), `squad-writer` (sequential shared writes) and `squad-verifier` (parallel audit). Keep the existing ⚠️ warning about LLM-generated data and `verified: false` exactly as it is.

- [ ] **Step 5: Run the full check**

```bash
npm run check
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A CLAUDE.md .claude/skills
git commit -m "refactor(skills): retire squad-updater in favour of the factory skills"
```

---

### Task 10: End-to-end smoke run

The first real exercise of the whole pipeline. Verifies the skills compose, not just that the files exist.

**Files:**

- No source changes expected. Data changes are the output under test.

- [ ] **Step 1: Confirm a clean starting tree**

```bash
git status --short
```

Expected: empty. Stop if not — the smoke run's whole signal is which files it changes.

- [ ] **Step 2: Run maintain over two known teams**

Invoke `squad-factory` in `maintain` mode over exactly two existing squads, one nation and one club (`esp` and `ars`). Two teams is enough to exercise parallel dispatch, sequential writing, and the report, while staying small enough to check by hand.

- [ ] **Step 3: Check the pipeline's mechanics, not just its verdict**

Confirm all of the following, and report the actual observations:

- Two envelopes exist under `.claude/tmp/squad-factory/<runId>/`, and `node scripts/envelope-check.ts` passes on both.
- Neither envelope carries an `identity` key (this was a `maintain` run).
- `git status` shows changes only to squad files, `data/players.json`, `data/index.json` and `lib/squads.generated.ts` — nothing under `.claude/tmp/` appears, confirming the Task 1 gitignore entry works.
- If either team was rewritten, its `verified` reflects the **re-verification** verdict, not a stale value.
- The report has a summary line and lists any clean team on a single line.

- [ ] **Step 4: Verify the tree is consistent**

```bash
npm run check
```

Expected: PASS. A failure on the `git diff --exit-code` guard means a generator run was missed — that is the bug this step exists to catch.

- [ ] **Step 5: Review and commit the data changes**

Squad data is LLM-generated and unverified by default. Read the diff before committing, and commit only if the changes look like real roster movement rather than a parse failure:

```bash
git diff --stat
git add -A data/ lib/squads.generated.ts
git commit -m "data: refresh esp and ars via squad-factory"
```

If the diff looks wrong, do not commit — restore with `git checkout -- data/ lib/squads.generated.ts` and report what the pipeline got wrong.
