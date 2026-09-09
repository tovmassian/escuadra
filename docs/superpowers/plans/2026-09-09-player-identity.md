# Player Identity by Wikipedia Article Title — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop `squadctl` merging two different real people into one player record when their Wikipedia display names collide, by matching on the article title instead of the display name.

**Architecture:** `Player` gains `wikiTitle`. `reconcile.ts` matches a parsed row to a stored player by title first and by normalised name second, comparing titles by _equivalence_ (an article can be linked through a redirect) rather than byte-equality. A row whose title contradicts the record it would otherwise match holds its squad slot and raises a new `title-mismatch` conflict, answered by one of three commands: `retitle`, `alias --title`, or `fork`.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`), Node 24 native type stripping, oclif 5, vitest, prettier.

**Spec:** `docs/superpowers/specs/2026-09-09-player-identity-design.md`. Read it before Task 1.

## Global Constraints

- **Node 24+.** Run `nvm use` once per shell before anything. On Node 22 every `.ts` entry point dies with `ERR_UNKNOWN_FILE_EXTENSION`.
- **TypeScript is strict, including `noUncheckedIndexedAccess`.** `array[0]` is `T | undefined`. Never weaken the config to silence an error; guard the access.
- **`lib/questionEngine.ts` stays pure.** Untouched by this plan.
- **Never hand-edit generated files:** `data/squads/**/*.json`, `data/index.json`, `lib/squads.generated.ts`.
- **`verified` is never set by hand.** It is `assess()`'s output.
- **Existing player ids are never rewritten.** Every squad file references them.
- **No network calls anywhere in this plan.** Every pipeline run uses `fetch --offline` against the warm `.cache/wikitext/`.
- **Run `npm run check` before reporting the work complete**, and report its actual output.
- The product is called **Escuadra**. Never "Squad Trainer" / "Squad Quiz" in code, comments or docs.

---

### Task 1: Title equivalence helpers

Two titles can name one article: Real Madrid links `[[Endrick]]` where Brazil links `[[Endrick (footballer, born 2006)]]`. Byte-equality would call those two people. These two pure helpers decide when two titles are the same article.

**Files:**

- Modify: `scripts/roster-envelope.ts` (add exports next to `isTransliterationVariant`, around line 125)
- Test: `scripts/roster-envelope.test.ts`

**Interfaces:**

- Consumes: `normalizeName(name: string): string`, already exported from the same file.
- Produces:
  - `baseTitle(title: string): string` — the title with a trailing parenthetical disambiguator stripped.
  - `titlesEquivalent(a: string, b: string): boolean` — true when both titles name the same article.

- [ ] **Step 1: Write the failing test**

Append to `scripts/roster-envelope.test.ts`:

```ts
describe('titlesEquivalent', () => {
  // Every row is a real pair from the envelope cache. The `true` rows are one
  // person linked through a redirect; the `false` rows are two different real
  // people. If a change makes any row flip, it merges or splits real players.
  const cases: [string, string, boolean, string][] = [
    ['Endrick', 'Endrick (footballer, born 2006)', true, 'link to the undisambiguated redirect'],
    [
      'Eric Garcia (footballer, born 2001)',
      'Eric García (footballer, born 2001)',
      true,
      'same title, one source drops the accent',
    ],
    [
      'Otávio (footballer, born November 2005)',
      'Otávio (footballer, born 2002)',
      false,
      'two Brazilian defenders, Frankfurt and Paris FC',
    ],
    [
      'Vitinha (footballer, born February 2000)',
      'Vitinha (footballer, born March 2000)',
      false,
      'two Portuguese midfielders, PSG and Genoa',
    ],
    [
      'Ederson (footballer, born 1993)',
      'Éderson (footballer, born 1999)',
      false,
      'both in the Brazil squad; the base folds together, the year does not',
    ],
    [
      'Nico González (footballer, born 2002)',
      'Nicolás González (footballer, born 1998)',
      false,
      'Newcastle and Juventus, both rendered "Nico González"',
    ],
    ['Endrick', 'Endrick', true, 'identical'],
  ];

  for (const [a, b, expected, why] of cases) {
    it(`${expected ? 'relates' : 'separates'} ${a} / ${b} — ${why}`, () => {
      expect(titlesEquivalent(a, b)).toBe(expected);
      expect(titlesEquivalent(b, a)).toBe(expected);
    });
  }
});

describe('baseTitle', () => {
  it('strips a trailing parenthetical disambiguator', () => {
    expect(baseTitle('Endrick (footballer, born 2006)')).toBe('Endrick');
  });

  it('leaves an undisambiguated title alone', () => {
    expect(baseTitle('Endrick')).toBe('Endrick');
  });

  it('leaves a parenthetical that is not trailing alone', () => {
    expect(baseTitle('Sporting CP (B) squad')).toBe('Sporting CP (B) squad');
  });
});
```

Add `baseTitle` and `titlesEquivalent` to the existing `import { ... } from './roster-envelope.ts';` at the top of the test file.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- scripts/roster-envelope.test.ts`
Expected: FAIL — `baseTitle is not exported` / `titlesEquivalent is not exported`.

- [ ] **Step 3: Write minimal implementation**

In `scripts/roster-envelope.ts`, immediately after `isTransliterationVariant`:

```ts
/** A title with its trailing parenthetical disambiguator removed:
 *  `Endrick (footballer, born 2006)` -> `Endrick`. Only a trailing group is
 *  stripped, because a parenthetical anywhere else is part of the name. */
export function baseTitle(title: string): string {
  return title.replace(/\s*\([^()]*\)\s*$/, '').trim();
}

/** True when two article titles name the same article.
 *
 *  Byte-equality is wrong here: Wikipedia lets an article be reached through
 *  a redirect, so one person legitimately has more than one link target. Real
 *  Madrid links `[[Endrick]]` where Brazil links
 *  `[[Endrick (footballer, born 2006)]]`, and Barcelona links
 *  `Eric Garcia (footballer, born 2001)` where Spain links
 *  `Eric García (footballer, born 2001)`.
 *
 *  Two relations, both local — resolving a redirect properly would cost a
 *  request per link and break `--offline`:
 *
 *  1. One side is the other's base title, i.e. a link to the undisambiguated
 *     redirect.
 *  2. The whole titles are equal once normalised.
 *
 *  NOT `isTransliterationVariant`, which is the obvious candidate and is
 *  wrong: it requires the NFD fold itself to differ, so it fires only on
 *  `ø đ ð ł æ œ ß þ ı ŋ ħ` and returns false for the Eric García pair.
 *
 *  Deliberately conservative about the disambiguator: two titles that share a
 *  base but carry *different* disambiguators are two people, which is exactly
 *  the Otávio and Vitinha collisions this whole mechanism exists to catch. */
export function titlesEquivalent(a: string, b: string): boolean {
  if (a === b) return true;
  if (normalizeName(a) === normalizeName(b)) return true;
  const strippedA = baseTitle(a);
  const strippedB = baseTitle(b);
  // Only when one side carries no disambiguator at all. Otherwise
  // `Otávio (born 2002)` and `Otávio (born November 2005)` would relate.
  const oneIsBare = strippedA === a || strippedB === b;
  return oneIsBare && normalizeName(strippedA) === normalizeName(strippedB);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- scripts/roster-envelope.test.ts`
Expected: PASS, all 10 new assertions.

- [ ] **Step 5: Commit**

```bash
git add scripts/roster-envelope.ts scripts/roster-envelope.test.ts
git commit -m "feat(squadctl): title equivalence, so a redirect is not a second person"
```

---

### Task 2: `Player.wikiTitle` and one shared players.json reader

The field itself, plus the one place it gets normalised. `apply`, `rename` and `alias` each hand-roll `JSON.parse(readFileSync(...))` today; adding `retitle` and `fork` would make five copies, and one of them forgetting to normalise `wikiTitle` is a silent identity bug.

**Files:**

- Modify: `types/squad.ts` (the `Player` interface, after `photo`)
- Create: `tools/squadctl/src/lib/players-file.ts`
- Test: `tools/squadctl/src/lib/players-file.test.ts`
- Modify: `tools/squadctl/src/commands/apply.ts:79-81`, `tools/squadctl/src/commands/apply.ts:194-201`
- Modify: `tools/squadctl/src/commands/rename.ts:32-33`, `:43-50`
- Modify: `tools/squadctl/src/commands/alias.ts:37-39`
- Modify (add `wikiTitle: null,` beside `photo: null,` in the `player` factory): `lib/questionEngine.test.ts:6`, `stores/session.test.ts:6`, `tools/squadctl/src/lib/reconcile.test.ts:12`, `tools/squadctl/src/lib/rename.test.ts:5`, `tools/squadctl/src/lib/apply-plan.test.ts:58`, `tools/squadctl/src/commands/apply.integration.test.ts:116`
- Modify: `tools/squadctl/src/lib/reconcile.ts:359` (the created-player literal)
- Modify: `CLAUDE.md` (the `data/players.json` line in the Data model section)

That list of seven type-break sites is complete and was produced by making the change and reading `tsc`'s output. `lib/squads.ts:14`'s `as Player[]` cast on the raw JSON does **not** break, so no back-fill of `data/players.json` is needed to typecheck.

**Interfaces:**

- Consumes: `formatAndWrite(filePath: string, content: string): Promise<void>` from `./write-json.ts`.
- Produces:
  - `Player.wikiTitle: string | null`
  - `readPlayers(dataDir: string): Player[]`
  - `writePlayers(dataDir: string, players: readonly Player[]): Promise<void>`

- [ ] **Step 1: Write the failing test**

Create `tools/squadctl/src/lib/players-file.test.ts`:

```ts
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readPlayers, writePlayers } from './players-file.ts';

function dataDirWith(json: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'players-file-'));
  writeFileSync(path.join(dir, 'players.json'), json);
  return dir;
}

const RECORD = {
  id: 'raya',
  name: 'David Raya',
  fullName: 'David Raya Martín',
  birth: '1995-09-15',
  position: 'GK',
  nationality: 'Spain',
  club: 'Arsenal',
  photo: null,
};

describe('readPlayers', () => {
  it('reads a record written before wikiTitle existed as null, not undefined', () => {
    const dir = dataDirWith(JSON.stringify([RECORD]));
    const [player] = readPlayers(dir);
    expect(player?.wikiTitle).toBeNull();
    expect('wikiTitle' in (player ?? {})).toBe(true);
  });

  it('keeps a stored title', () => {
    const dir = dataDirWith(JSON.stringify([{ ...RECORD, wikiTitle: 'David Raya' }]));
    expect(readPlayers(dir)[0]?.wikiTitle).toBe('David Raya');
  });
});

describe('writePlayers', () => {
  it('sorts by id, so a no-op run produces an empty git diff', async () => {
    const dir = dataDirWith(JSON.stringify([]));
    await writePlayers(dir, [
      { ...RECORD, id: 'zubimendi', wikiTitle: null, position: 'MF' as const },
      { ...RECORD, id: 'raya', wikiTitle: null, position: 'GK' as const },
    ]);
    const written = JSON.parse(readFileSync(path.join(dir, 'players.json'), 'utf8')) as {
      id: string;
    }[];
    expect(written.map((p) => p.id)).toEqual(['raya', 'zubimendi']);
  });

  it('round-trips a title through write and read', async () => {
    const dir = dataDirWith(JSON.stringify([]));
    await writePlayers(dir, [{ ...RECORD, position: 'GK' as const, wikiTitle: 'David Raya' }]);
    expect(readPlayers(dir)[0]?.wikiTitle).toBe('David Raya');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tools/squadctl/src/lib/players-file.test.ts`
Expected: FAIL — cannot resolve `./players-file.ts`.

- [ ] **Step 3: Add the field**

In `types/squad.ts`, inside `interface Player`, replace the `photo` line with:

```ts
photo: string | null; // reserved for v1
/** Wikipedia article title this record was created from. Unique per person
 *  by construction, where a display name is not: two different real people
 *  are both rendered "Otávio" and only the title separates them.
 *
 *  Null when unknown — a record predating this field, or a row the source
 *  lists as plain text with no article, which is ~2.5% of parsed rows and
 *  therefore permanent, not merely transitional.
 *
 *  Data-layer identity only. No screen reads it and it is never a quiz
 *  answer. */
wikiTitle: string | null;
```

- [ ] **Step 4: Create the shared reader and writer**

Create `tools/squadctl/src/lib/players-file.ts`:

```ts
// The single reader and writer for data/players.json.
//
// Shared rather than repeated per command: `wikiTitle` has to be normalised on
// the way in, because every record written before the field existed carries no
// such key, and one command out of five forgetting to do it is a silent
// identity bug rather than a loud one.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Player } from '../../../../types/squad.ts';
import { formatAndWrite } from './write-json.ts';

/** Normalises `wikiTitle` to null so every consumer sees the field, whether or
 *  not the stored record predates it. The next write stamps it in. */
export function readPlayers(dataDir: string): Player[] {
  const raw = JSON.parse(readFileSync(path.join(dataDir, 'players.json'), 'utf8')) as (Omit<
    Player,
    'wikiTitle'
  > & { wikiTitle?: string | null })[];
  return raw.map((player) => ({ ...player, wikiTitle: player.wikiTitle ?? null }));
}

/** Always sorted by id, so a run that changed nothing produces an empty git
 *  diff. Goes through `formatAndWrite` for the same reason every other writer
 *  does: two writers with drifting prettier options is how a no-op sweep
 *  starts churning the diff. */
export async function writePlayers(dataDir: string, players: readonly Player[]): Promise<void> {
  await formatAndWrite(
    path.join(dataDir, 'players.json'),
    `${JSON.stringify(
      [...players].sort((a, b) => a.id.localeCompare(b.id)),
      null,
      2,
    )}\n`,
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tools/squadctl/src/lib/players-file.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Fix every type break**

Run: `npm run typecheck`
Expected: 7 errors, at exactly the sites listed under **Files** above.

In each of these six test files, add `wikiTitle: null,` immediately after the `photo: null,` line inside the `player` factory:

- `lib/questionEngine.test.ts:6`
- `stores/session.test.ts:6`
- `tools/squadctl/src/lib/reconcile.test.ts:12`
- `tools/squadctl/src/lib/rename.test.ts:5`
- `tools/squadctl/src/lib/apply-plan.test.ts:58`
- `tools/squadctl/src/commands/apply.integration.test.ts:116`

In `tools/squadctl/src/lib/reconcile.ts`, the `const created: Player = {` literal near line 359, add after `photo: null,`:

```ts
      wikiTitle: null,
```

(Task 4 replaces that `null` with the row's title. Leave it null here so this task's diff is only the type.)

- [ ] **Step 7: Rewire the three commands onto the shared pair**

`tools/squadctl/src/commands/apply.ts` — replace the read at lines 79-81:

```ts
let players: Player[] = readPlayers(this.dataDir);
```

and the write near line 194 (`formatAndWrite(path.join(this.dataDir, 'players.json'), ...)`) with:

```ts
await writePlayers(this.dataDir, players);
```

`tools/squadctl/src/commands/rename.ts` — replace lines 32-33 with:

```ts
const players = readPlayers(this.dataDir);
```

and the `formatAndWrite(playersPath, ...)` call with:

```ts
await writePlayers(this.dataDir, result.players);
```

Delete the now-unused `playersPath` const and any import that goes unused.

`tools/squadctl/src/commands/alias.ts` — replace the read at lines 37-39 with:

```ts
const players = readPlayers(this.dataDir);
```

Add `import { readPlayers, writePlayers } from '../lib/players-file.ts';` to each (only `readPlayers` in `alias.ts`, which does not write players.json).

- [ ] **Step 8: Update CLAUDE.md**

In the Data model section, the `data/players.json` line becomes:

```
data/players.json                     { id, name, fullName, birth, position, nationality, club, photo: null, wikiTitle }
```

Directly under the `players.json` mention, add:

```
`wikiTitle` is the Wikipedia article title the record came from — the only
field that is unique per person, since two different real people are both
rendered "Otávio". Null when the source links no article. Never a quiz answer;
identity only.
```

- [ ] **Step 9: Verify the whole suite still passes**

Run: `npm run typecheck && npm test`
Expected: typecheck clean, all tests pass.

- [ ] **Step 10: Commit**

```bash
git add types/squad.ts CLAUDE.md tools/squadctl/src/lib/players-file.ts tools/squadctl/src/lib/players-file.test.ts tools/squadctl/src/commands/apply.ts tools/squadctl/src/commands/rename.ts tools/squadctl/src/commands/alias.ts tools/squadctl/src/lib/reconcile.ts lib/questionEngine.test.ts stores/session.test.ts tools/squadctl/src/lib/reconcile.test.ts tools/squadctl/src/lib/rename.test.ts tools/squadctl/src/lib/apply-plan.test.ts tools/squadctl/src/commands/apply.integration.test.ts
git commit -m "feat(squadctl): Player.wikiTitle and one shared players.json reader"
```

---

### Task 3: `titleAliases` in decisions.json

The one title fact that cannot be re-derived offline: a source links a redirect unrelated to the stored title, like Atlético's `Alejandro Grimaldo` against Spain's `Álex Grimaldo`.

**Files:**

- Modify: `tools/squadctl/src/lib/reconcile.ts` (add the `TitleAlias` interface beside `AcceptedAlias`, around line 40)
- Modify: `tools/squadctl/src/lib/decisions.ts`
- Test: `tools/squadctl/src/lib/decisions.test.ts`

**Interfaces:**

- Consumes: `DecisionFile`, `addAlias`, `validateDecisions` from `./decisions.ts`.
- Produces:
  - `interface TitleAlias { player: string; title: string }` exported from `reconcile.ts`
  - `DecisionFile.titleAliases?: TitleAlias[]`
  - `addTitleAlias(file: DecisionFile, alias: TitleAlias): DecisionFile | null` — null when already recorded.

- [ ] **Step 1: Write the failing test**

Append to `tools/squadctl/src/lib/decisions.test.ts`:

```ts
describe('addTitleAlias', () => {
  const empty: DecisionFile = { splits: [], aliases: [], titleAliases: [] };

  it('records an extra article title one player is known by', () => {
    const updated = addTitleAlias(empty, { player: 'grimaldo', title: 'Alejandro Grimaldo' });
    expect(updated?.titleAliases).toEqual([{ player: 'grimaldo', title: 'Alejandro Grimaldo' }]);
  });

  it('is idempotent, so re-running after a failed apply piles up nothing', () => {
    const once = addTitleAlias(empty, { player: 'grimaldo', title: 'Alejandro Grimaldo' });
    expect(addTitleAlias(once!, { player: 'grimaldo', title: 'Alejandro Grimaldo' })).toBeNull();
  });

  it('sorts, so two people editing the file do not fight over order', () => {
    const a = addTitleAlias(empty, { player: 'zubimendi', title: 'Martín Zubimendi' })!;
    const b = addTitleAlias(a, { player: 'grimaldo', title: 'Alejandro Grimaldo' })!;
    expect(b.titleAliases?.map((t) => t.player)).toEqual(['grimaldo', 'zubimendi']);
  });

  it('leaves an older file that predates the field alone', () => {
    const updated = addTitleAlias(
      { splits: [], aliases: [] },
      {
        player: 'grimaldo',
        title: 'Alejandro Grimaldo',
      },
    );
    expect(updated?.titleAliases).toHaveLength(1);
  });
});

describe('validateDecisions with titleAliases', () => {
  it('accepts a file with no titleAliases at all', () => {
    expect(validateDecisions({ splits: [], aliases: [] })).toEqual([]);
  });

  it('rejects a non-array titleAliases', () => {
    expect(validateDecisions({ splits: [], titleAliases: 'nope' })).toEqual([
      'decisions.json "titleAliases" must be an array when present',
    ]);
  });

  it('names the offending entry and field', () => {
    expect(validateDecisions({ splits: [], titleAliases: [{ player: 'x' }] })).toEqual([
      'titleAliases[0].title must be a non-empty string',
    ]);
  });
});
```

Add `addTitleAlias` to the file's existing import from `./decisions.ts`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tools/squadctl/src/lib/decisions.test.ts`
Expected: FAIL — `addTitleAlias is not exported`.

- [ ] **Step 3: Add the interface to reconcile.ts**

In `tools/squadctl/src/lib/reconcile.ts`, directly after `AcceptedAlias`:

```ts
/** An extra article title one player is known by, recorded because a source
 *  links a redirect rather than the canonical title — Atlético links
 *  `Alejandro Grimaldo` where Spain links `Álex Grimaldo`. Unlike a stored
 *  title this cannot be re-derived offline, which is why it is a decision. */
export interface TitleAlias {
  player: string;
  title: string;
}
```

- [ ] **Step 4: Extend decisions.ts**

Add `TitleAlias` to the existing `import type { AcceptedAlias, AcceptedSplit } from './reconcile.ts';`.

In `interface DecisionFile`, after `aliases`:

```ts
  /** Extra article titles a player is known by. Optional for the same reason
   *  `aliases` is: every decision file on disk predates it. */
  titleAliases?: TitleAlias[];
```

Update `EMPTY_DECISIONS`:

```ts
export const EMPTY_DECISIONS: DecisionFile = { splits: [], aliases: [], titleAliases: [] };
```

In `validateDecisions`, after the `aliases` block:

```ts
if (value.titleAliases !== undefined && !Array.isArray(value.titleAliases)) {
  return ['decisions.json "titleAliases" must be an array when present'];
}
for (const [index, entry] of (value.titleAliases ?? []).entries()) {
  if (!isRecord(entry)) {
    errors.push(`titleAliases[${index}] must be an object`);
    continue;
  }
  for (const field of ['player', 'title'] as const) {
    if (typeof entry[field] !== 'string' || entry[field] === '') {
      errors.push(`titleAliases[${index}].${field} must be a non-empty string`);
    }
  }
}
```

And after `addAlias`:

```ts
/** Idempotent, like `addAlias`. Returns null when already recorded. */
export function addTitleAlias(file: DecisionFile, alias: TitleAlias): DecisionFile | null {
  const existing = file.titleAliases ?? [];
  if (existing.some((t) => t.player === alias.player && t.title === alias.title)) return null;
  return {
    ...file,
    titleAliases: [...existing, alias].sort(
      (a, b) => a.player.localeCompare(b.player) || a.title.localeCompare(b.title),
    ),
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tools/squadctl/src/lib/decisions.test.ts`
Expected: PASS.

- [ ] **Step 6: Load titleAliases in apply**

In `tools/squadctl/src/commands/apply.ts`, find `loadDecisions()` and make sure the returned object carries `titleAliases: loaded.titleAliases ?? []` alongside the existing `aliases: loaded.aliases ?? []`. Task 4 passes it into `reconcileTeam`.

- [ ] **Step 7: Commit**

```bash
git add tools/squadctl/src/lib/decisions.ts tools/squadctl/src/lib/decisions.test.ts tools/squadctl/src/lib/reconcile.ts tools/squadctl/src/commands/apply.ts
git commit -m "feat(squadctl): titleAliases decision, for a source that links a redirect"
```

---

### Task 4: Title-decisive matching in reconcile

An equivalent title identifies the player, whatever the display names say. This is also a straight upgrade for a case that misfires today: Juventus renders `Nico González` where the record stores `Nicolás González`, and only the shared title `Nicolás González (footballer, born 1998)` can join them.

**Files:**

- Modify: `tools/squadctl/src/lib/reconcile.ts`
- Test: `tools/squadctl/src/lib/reconcile.test.ts`

**Interfaces:**

- Consumes: `titlesEquivalent(a: string, b: string): boolean` (Task 1); `TitleAlias` (Task 3); `Player.wikiTitle` (Task 2); `EnvelopeMember.title?: string`.
- Produces:
  - `ReconcileInput.titleAliases?: readonly TitleAlias[]`
  - Rows now match by title before name at both match points, and a matched player with `wikiTitle: null` is back-filled from the row.

- [ ] **Step 1: Write the failing tests**

Add to `tools/squadctl/src/lib/reconcile.test.ts`. The `row` factory takes `EnvelopeMember`, which already has an optional `title`.

```ts
describe('title-decisive matching', () => {
  it('matches on title even when the display names differ', () => {
    // Juventus renders "Nico González"; the record stores "Nicolás González".
    // Only the shared article title can join these two.
    const stored = [
      player({
        id: 'gonzalez',
        name: 'Nicolás González',
        wikiTitle: 'Nicolás González (footballer, born 1998)',
      }),
    ];
    const plan = reconcileTeam({
      envelope: envelope([
        row({ name: 'Nico González', title: 'Nicolás González (footballer, born 1998)' }),
      ]),
      storedSquad: squad([{ playerId: 'gonzalez', no: 10 }]),
      players: stored,
    });
    expect(plan.squad.members.map((m) => m.playerId)).toEqual(['gonzalez']);
    expect(plan.newPlayers).toEqual([]);
    expect(plan.possibleRenames).toEqual([]);
  });

  it('relates a redirect to the article it redirects to', () => {
    // Real Madrid links [[Endrick]]; Brazil links the disambiguated title.
    const stored = [player({ id: 'endrick', name: 'Endrick', wikiTitle: 'Endrick' })];
    const plan = reconcileTeam({
      envelope: envelope([row({ name: 'Endrick', title: 'Endrick (footballer, born 2006)' })]),
      storedSquad: squad([{ playerId: 'endrick', no: 9 }]),
      players: stored,
    });
    expect(plan.squad.members.map((m) => m.playerId)).toEqual(['endrick']);
    expect(plan.newPlayers).toEqual([]);
  });

  it('back-fills a null stored title from the row', () => {
    const stored = [player({ id: 'raya', name: 'David Raya', wikiTitle: null })];
    const plan = reconcileTeam({
      envelope: envelope([row({ name: 'David Raya', title: 'David Raya' })]),
      storedSquad: squad([{ playerId: 'raya', no: 1 }]),
      players: stored,
    });
    expect(plan.updatedPlayers[0]?.wikiTitle).toBe('David Raya');
  });

  it('never overwrites a stored title from the row — that is retitle', () => {
    const stored = [player({ id: 'endrick', name: 'Endrick', wikiTitle: 'Endrick' })];
    const plan = reconcileTeam({
      envelope: envelope([row({ name: 'Endrick', title: 'Endrick (footballer, born 2006)' })]),
      storedSquad: squad([{ playerId: 'endrick', no: 9 }]),
      players: stored,
    });
    expect(
      plan.updatedPlayers.some((p) => p.id === 'endrick' && p.wikiTitle !== 'Endrick'),
    ).toBe(false);
  });

  it('gives a genuinely new player the row title', () => {
    const plan = reconcileTeam({
      envelope: envelope([row({ name: 'Otávio', title: 'Otávio (footballer, born 2002)' })]),
      storedSquad: null,
      players: [],
    });
    expect(plan.newPlayers[0]?.wikiTitle).toBe('Otávio (footballer, born 2002)');
  });

  it('leaves a row with no title to name matching, exactly as before', () => {
    const stored = [player({ id: 'raya', name: 'David Raya', wikiTitle: 'David Raya' })];
    const plan = reconcileTeam({
      envelope: envelope([row({ name: 'David Raya' })]),
      storedSquad: squad([{ playerId: 'raya', no: 1 }]),
      players: stored,
    });
    expect(plan.squad.members.map((m) => m.playerId)).toEqual(['raya']);
  });

  it('matches a recorded title alias', () => {
    // Atlético links "Alejandro Grimaldo"; the record stores Spain's title.
    const stored = [player({ id: 'grimaldo', name: 'Álex Grimaldo', wikiTitle: 'Álex Grimaldo' })];
    const plan = reconcileTeam({
      envelope: envelope([row({ name: 'Alejandro Grimaldo', title: 'Alejandro Grimaldo' })]),
      storedSquad: squad([{ playerId: 'grimaldo', no: 3 }]),
      players: stored,
      titleAliases: [{ player: 'grimaldo', title: 'Alejandro Grimaldo' }],
    });
    expect(plan.squad.members.map((m) => m.playerId)).toEqual(['grimaldo']);
    expect(plan.newPlayers).toEqual([]);
  });

  it('holds the group when a bare title relates to two stored people', () => {
    // A bare [[Otávio]] against two stored Otávios: base equivalence relates
    // it to both and picking one would be a coin flip.
    const stored = [
      player({ id: 'otavio', name: 'Otávio', wikiTitle: 'Otávio (footballer, born 2002)' }),
      player({
        id: 'otavio-2',
        name: 'Otávio',
        wikiTitle: 'Otávio (footballer, born November 2005)',
      }),
    ];
    const plan = reconcileTeam({
      envelope: envelope([row({ name: 'Otávio', title: 'Otávio' })]),
      storedSquad: squad([
        { playerId: 'otavio', no: 6 },
        { playerId: 'otavio-2', no: 5 },
      ]),
      players: stored,
    });
    expect(plan.ambiguous[0]?.candidateIds.sort()).toEqual(['otavio', 'otavio-2']);
    expect(plan.newPlayers).toEqual([]);
  });
});
```

Add `wikiTitle: null,` to the `player` factory default in this file if Task 2 did not already (it did — verify it is there, beside `photo: null`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tools/squadctl/src/lib/reconcile.test.ts`
Expected: FAIL — `titleAliases` is not a known property, and the name-differ / redirect cases produce a `possible-rename` or a new player.

- [ ] **Step 3: Implement**

In `tools/squadctl/src/lib/reconcile.ts`:

Add `titlesEquivalent` to the import from `../../../../scripts/roster-envelope.ts`.

Add to `ReconcileInput`, after `aliases`:

```ts
  /** Extra article titles players are known by, so a source that links a
   *  redirect matches the person it belongs to rather than looking like a
   *  second person. */
  titleAliases?: readonly TitleAlias[];
```

Destructure `titleAliases = []` in the `reconcileTeam` parameter list beside `aliases = []`.

After the existing `namesOf` helper, add:

```ts
/** Every article title a player answers to: the one stored on the record
 *  plus any recorded alias. */
const titlesOf = (player: Player): string[] => [
  ...(player.wikiTitle === null ? [] : [player.wikiTitle]),
  ...titleAliases.filter((t) => t.player === player.id).map((t) => t.title),
];

/** How a row's article title relates to a candidate record.
 *
 *  `match`   — the same article, decisively, whatever the names say.
 *  `unknown` — one side carries no title. Fall back to the name, which is
 *              exactly the behaviour that predates this field.
 *  `clash`   — both sides are titled and the titles are unrelated. Not this
 *              person. Handled by the caller, never by guessing. */
const titleVerdict = (
  candidate: Player,
  rowTitle: string | undefined,
): 'match' | 'unknown' | 'clash' => {
  if (rowTitle === undefined || rowTitle === '') return 'unknown';
  const stored = titlesOf(candidate);
  if (stored.length === 0) return 'unknown';
  return stored.some((title) => titlesEquivalent(title, rowTitle)) ? 'match' : 'clash';
};
```

Inside the `for (const row of envelope.members)` loop, immediately after `let player: Player | undefined;`, insert the new step 1a and wrap the existing step 1 so it only runs when 1a found nothing:

```ts
// 1a. A stored member of THIS squad whose article title is the row's.
//     Decisive whatever the display names say: Juventus renders
//     "Nico González" where the record stores "Nicolás González", and
//     the title is the only thing that can join them.
const titled = storedList.filter((m) => {
  const candidate = byId.get(m.playerId);
  return (
    candidate !== undefined &&
    !consumed.has(m.playerId) &&
    titleVerdict(candidate, row.title) === 'match'
  );
});
if (titled.length === 1) {
  player = byId.get(titled[0]?.playerId ?? '');
} else if (titled.length > 1) {
  // A bare [[Otávio]] against two stored Otávios. Base equivalence relates
  // it to both, and picking one is a coin flip — HOLD the group.
  heldGroups.add(key);
  ambiguous.push({ name: row.name, candidateIds: titled.map((m) => m.playerId) });
  for (const member of titled) {
    consumed.add(member.playerId);
    members.push(buildMember(member.playerId, member.no, member.captain));
  }
  continue;
}

// 1b. A stored member of THIS squad, by normalised name.
if (!player) {
  const group = (storedByNorm.get(key) ?? []).filter((m) => !consumed.has(m.playerId));
  if (group.length === 1) {
    player = byId.get(group[0]?.playerId ?? '');
  } else if (group.length > 1) {
    const resolved = separate(group, row);
    if (resolved === undefined || resolved === null) {
      if (!heldGroups.has(key)) {
        heldGroups.add(key);
        ambiguous.push({ name: row.name, candidateIds: group.map((m) => m.playerId) });
        for (const member of group) {
          consumed.add(member.playerId);
          members.push(buildMember(member.playerId, member.no, member.captain));
        }
      }
      continue;
    }
    player = byId.get(resolved.playerId);
  }
}
```

Leave the existing `if (player) { consumed.add(player.id); matchedCount += 1; }` immediately after — both 1a and 1b fall into it.

In step 2, add a global title lookup before the existing global name lookup:

```ts
// 2a. Otherwise look up players.json globally, by title first.
if (!player) {
  const globallyTitled = players.filter(
    (candidate) => !consumed.has(candidate.id) && titleVerdict(candidate, row.title) === 'match',
  );
  if (globallyTitled.length === 1) {
    player = globallyTitled[0];
    if (player) consumed.add(player.id);
  } else if (globallyTitled.length > 1) {
    ambiguous.push({
      name: row.name,
      candidateIds: globallyTitled.map((c) => c.id),
    });
    omitted.push({
      name: row.name,
      reason: `ambiguous by title against ${globallyTitled.map((c) => c.id).join(', ')}`,
    });
    continue;
  }
}
```

In the `merged` object, add:

```ts
        // Filled when unknown, never overwritten — changing a stored title is
        // what `retitle` is for.
        wikiTitle: player.wikiTitle ?? row.title ?? null,
```

In the step 4 `created` literal, replace `wikiTitle: null,` with:

```ts
      wikiTitle: row.title ?? null,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tools/squadctl/src/lib/reconcile.test.ts`
Expected: PASS, including every pre-existing test in the file.

- [ ] **Step 5: Pass the aliases through apply**

In `tools/squadctl/src/commands/apply.ts`, at the `reconcileTeam({ ... })` call, add:

```ts
        titleAliases: decisions.titleAliases ?? [],
```

- [ ] **Step 6: Verify the whole suite**

Run: `npm run typecheck && npm test`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add tools/squadctl/src/lib/reconcile.ts tools/squadctl/src/lib/reconcile.test.ts tools/squadctl/src/commands/apply.ts
git commit -m "feat(squadctl): match a row to a player by article title first"
```

---

### Task 5: A clashing title holds the row

The bug itself. A row whose title contradicts the record it would otherwise match by name is not that person — and is not provably a new one either, because Wikipedia moves articles. So it holds, exactly as `possible-rename` does.

**Files:**

- Modify: `tools/squadctl/src/lib/reconcile.ts`
- Test: `tools/squadctl/src/lib/reconcile.test.ts`

**Interfaces:**

- Consumes: `titleVerdict`, `titlesOf` (Task 4, function-local to `reconcileTeam`).
- Produces:
  - `interface TitleMismatch { playerId: string; storedTitle: string; sourceTitle: string; rowName: string }`
  - `TeamPlan.titleMismatches: TitleMismatch[]`

- [ ] **Step 1: Write the failing tests**

Add to `tools/squadctl/src/lib/reconcile.test.ts`:

```ts
describe('a clashing title holds the row', () => {
  // The live bug: Frankfurt's Otávio and Paris FC's Otávio are two Brazilian
  // defenders rendered identically, and one record was serving both squads.
  const frankfurtRow = row({
    name: 'Otávio',
    no: 5,
    position: 'DF',
    title: 'Otávio (footballer, born November 2005)',
  });

  it('does not match a stored member whose title says someone else', () => {
    const stored = [
      player({
        id: 'otavio',
        name: 'Otávio',
        position: 'DF',
        wikiTitle: 'Otávio (footballer, born 2002)',
      }),
    ];
    const plan = reconcileTeam({
      envelope: envelope([frankfurtRow]),
      storedSquad: squad([{ playerId: 'otavio', no: 5 }]),
      players: stored,
    });
    expect(plan.titleMismatches).toEqual([
      {
        playerId: 'otavio',
        storedTitle: 'Otávio (footballer, born 2002)',
        sourceTitle: 'Otávio (footballer, born November 2005)',
        rowName: 'Otávio',
      },
    ]);
  });

  it('creates nothing, because a moved article looks identical to a new person', () => {
    const stored = [
      player({
        id: 'otavio',
        name: 'Otávio',
        position: 'DF',
        wikiTitle: 'Otávio (footballer, born 2002)',
      }),
    ];
    const plan = reconcileTeam({
      envelope: envelope([frankfurtRow]),
      storedSquad: squad([{ playerId: 'otavio', no: 5 }]),
      players: stored,
    });
    expect(plan.newPlayers).toEqual([]);
  });

  it('keeps the squad slot, so an unresolved clash never shortens a squad', () => {
    const stored = [
      player({
        id: 'otavio',
        name: 'Otávio',
        position: 'DF',
        wikiTitle: 'Otávio (footballer, born 2002)',
      }),
    ];
    const plan = reconcileTeam({
      envelope: envelope([frankfurtRow]),
      storedSquad: squad([{ playerId: 'otavio', no: 5 }]),
      players: stored,
    });
    expect(plan.squad.members).toEqual([{ playerId: 'otavio', no: 5 }]);
    expect(plan.departed).toEqual([]);
  });

  it('omits the row when the clashing record is not in this squad', () => {
    // Genoa's Vitinha against the stored PSG one. There is no slot to hold,
    // so the row is left out and said so — never dropped in silence.
    const stored = [
      player({
        id: 'vitinha',
        name: 'Vitinha',
        wikiTitle: 'Vitinha (footballer, born February 2000)',
      }),
    ];
    const plan = reconcileTeam({
      envelope: envelope([
        row({ name: 'Vitinha', title: 'Vitinha (footballer, born March 2000)' }),
      ]),
      storedSquad: null,
      players: stored,
    });
    expect(plan.titleMismatches).toHaveLength(1);
    expect(plan.omitted).toHaveLength(1);
    expect(plan.newPlayers).toEqual([]);
  });

  it('does not clash when the stored title is unknown', () => {
    const stored = [player({ id: 'otavio', name: 'Otávio', position: 'DF', wikiTitle: null })];
    const plan = reconcileTeam({
      envelope: envelope([frankfurtRow]),
      storedSquad: squad([{ playerId: 'otavio', no: 5 }]),
      players: stored,
    });
    expect(plan.titleMismatches).toEqual([]);
    expect(plan.updatedPlayers[0]?.wikiTitle).toBe('Otávio (footballer, born November 2005)');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tools/squadctl/src/lib/reconcile.test.ts`
Expected: FAIL — `titleMismatches` does not exist on the plan.

- [ ] **Step 3: Implement**

In `tools/squadctl/src/lib/reconcile.ts`, beside the other conflict interfaces:

```ts
/** A row whose article title contradicts the record its name would match.
 *  Two different real people, or one whose article moved — indistinguishable
 *  from the data, so this never resolves itself. */
export interface TitleMismatch {
  playerId: string;
  storedTitle: string;
  sourceTitle: string;
  rowName: string;
}
```

Add to `TeamPlan`:

```ts
  titleMismatches: TitleMismatch[];
```

Declare the accumulator beside `nameVariants`:

```ts
const titleMismatches: TitleMismatch[] = [];
```

In step 1b, filter the name group by verdict and hold when nothing usable is left:

```ts
if (!player) {
  const named = (storedByNorm.get(key) ?? []).filter((m) => !consumed.has(m.playerId));
  const group = named.filter((m) => {
    const candidate = byId.get(m.playerId);
    return candidate === undefined || titleVerdict(candidate, row.title) !== 'clash';
  });
  if (named.length > 0 && group.length === 0) {
    // Same display name, different article. HOLD the stored record on its
    // slot: creating one here is the unrecoverable direction, because a
    // moved article and a second person look identical from the data.
    const held = named[0];
    const candidate = held === undefined ? undefined : byId.get(held.playerId);
    if (held !== undefined && candidate !== undefined && row.title !== undefined) {
      heldGroups.add(key);
      titleMismatches.push({
        playerId: candidate.id,
        storedTitle: titlesOf(candidate)[0] ?? '',
        sourceTitle: row.title,
        rowName: row.name,
      });
      consumed.add(held.playerId);
      members.push(buildMember(held.playerId, row.no, held.captain));
    }
    continue;
  }
  // ... the existing group.length === 1 / > 1 handling, unchanged
}
```

In the global name lookup, do the same but omit rather than hold, since there is no slot:

```ts
const named = (byNorm.get(key) ?? []).filter((c) => !consumed.has(c.id));
const candidates = named.filter((c) => titleVerdict(c, row.title) !== 'clash');
if (named.length > 0 && candidates.length === 0) {
  const candidate = named[0];
  if (candidate !== undefined && row.title !== undefined) {
    titleMismatches.push({
      playerId: candidate.id,
      storedTitle: titlesOf(candidate)[0] ?? '',
      sourceTitle: row.title,
      rowName: row.name,
    });
    omitted.push({
      name: row.name,
      reason: `title clashes with ${candidate.id}, which is not in this squad`,
    });
  }
  continue;
}
// ... the existing candidates.length === 1 / > 1 handling, unchanged
```

Add `titleMismatches,` to the returned object.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tools/squadctl/src/lib/reconcile.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify the whole suite**

Run: `npm run typecheck && npm test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add tools/squadctl/src/lib/reconcile.ts tools/squadctl/src/lib/reconcile.test.ts
git commit -m "feat(squadctl): a clashing article title holds the row instead of merging"
```

---

### Task 6: The `title-mismatch` conflict

Surfaces the hold as `verified: false`, exit `4`, and a report naming all three answers.

**Files:**

- Modify: `tools/squadctl/src/lib/assertions.ts`
- Test: `tools/squadctl/src/lib/assertions.test.ts`

**Interfaces:**

- Consumes: `TeamPlan.titleMismatches` (Task 5).
- Produces: `Conflict` gains `{ kind: 'title-mismatch'; playerId: string; storedTitle: string; sourceTitle: string; rowName: string }`.

- [ ] **Step 1: Write the failing tests**

Add to `tools/squadctl/src/lib/assertions.test.ts`. That file already has a `plan(over: Partial<TeamPlan> = {}): TeamPlan` builder at line 19 — use it, and add `titleMismatches: []` to its defaults so every existing test keeps compiling.

```ts
describe('title-mismatch', () => {
  const mismatch = {
    playerId: 'otavio',
    storedTitle: 'Otávio (footballer, born 2002)',
    sourceTitle: 'Otávio (footballer, born November 2005)',
    rowName: 'Otávio',
  };

  it('is a conflict, so the team is written but not verified', () => {
    const result = assess(plan({ titleMismatches: [mismatch] }));
    expect(result.verified).toBe(false);
    expect(result.failures).toEqual([]);
    expect(result.conflicts).toContainEqual({ kind: 'title-mismatch', ...mismatch });
  });

  it('names both titles, since the reader has to judge which is which', () => {
    expect(describeConflict({ kind: 'title-mismatch', ...mismatch })).toBe(
      'identity conflict on otavio — stored "Otávio (footballer, born 2002)", source lists "Otávio (footballer, born November 2005)"',
    );
  });

  it('offers all three answers, because none is expressible as another', () => {
    const command = conflictCommand({ kind: 'title-mismatch', ...mismatch });
    expect(command).toContain('retitle otavio "Otávio (footballer, born November 2005)"');
    expect(command).toContain('alias otavio --title "Otávio (footballer, born November 2005)"');
    expect(command).toContain('fork otavio "Otávio (footballer, born November 2005)"');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tools/squadctl/src/lib/assertions.test.ts`
Expected: FAIL — no such conflict kind.

- [ ] **Step 3: Implement**

In `tools/squadctl/src/lib/assertions.ts`, add to the `Conflict` union after `name-variant`:

```ts
  | {
      kind: 'title-mismatch';
      playerId: string;
      storedTitle: string;
      sourceTitle: string;
      rowName: string;
    }
```

In `assess`, after the `nameVariants` loop:

```ts
// Two different real people, or one whose article moved. Neither is provable
// from the data, and merging the wrong pair is unrecoverable.
for (const mismatch of plan.titleMismatches) {
  conflicts.push({ kind: 'title-mismatch', ...mismatch });
}
```

In `describeConflict`:

```ts
    case 'title-mismatch':
      return `identity conflict on ${conflict.playerId} — stored "${conflict.storedTitle}", source lists "${conflict.sourceTitle}"`;
```

In `conflictCommand`, beside the `possible-rename` case:

```ts
    // The same three answers as possible-rename, one level up. "Both titles
    // are his" is no more expressible as either of the others than "both
    // names are his" was.
    case 'title-mismatch':
      return (
        `same person, article moved:  npm run squadctl -- retitle ${conflict.playerId} ${JSON.stringify(conflict.sourceTitle)}\n` +
        `      same person, both titles:    npm run squadctl -- alias ${conflict.playerId} --title ${JSON.stringify(conflict.sourceTitle)}\n` +
        `      two different people:        npm run squadctl -- fork ${conflict.playerId} ${JSON.stringify(conflict.sourceTitle)}`
      );
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tools/squadctl/src/lib/assertions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/squadctl/src/lib/assertions.ts tools/squadctl/src/lib/assertions.test.ts
git commit -m "feat(squadctl): title-mismatch conflict with all three answers"
```

---

### Task 7: `retitle`

Same person, article moved.

**Files:**

- Modify: `tools/squadctl/src/lib/rename.ts`
- Create: `tools/squadctl/src/commands/retitle.ts`
- Test: `tools/squadctl/src/lib/rename.test.ts`
- Modify: `tools/squadctl/README.md`

**Interfaces:**

- Consumes: `readPlayers` / `writePlayers` (Task 2).
- Produces: `retitlePlayer(players: readonly Player[], id: string, title: string): { players: Player[]; before: string | null; after: string } | null`.

- [ ] **Step 1: Write the failing test**

Add to `tools/squadctl/src/lib/rename.test.ts`:

```ts
describe('retitlePlayer', () => {
  const stored = [
    player({ id: 'endrick', name: 'Endrick', wikiTitle: 'Endrick' }),
    player({ id: 'dro', name: 'Dro', wikiTitle: null }),
  ];

  it('points the record at the new title without touching the id', () => {
    const result = retitlePlayer(stored, 'endrick', 'Endrick (footballer, born 2006)');
    expect(result?.players.find((p) => p.id === 'endrick')?.wikiTitle).toBe(
      'Endrick (footballer, born 2006)',
    );
    expect(result?.players.map((p) => p.id)).toEqual(['endrick', 'dro']);
  });

  it('leaves the display name alone — that is what rename is for', () => {
    const result = retitlePlayer(stored, 'endrick', 'Endrick (footballer, born 2006)');
    expect(result?.players.find((p) => p.id === 'endrick')?.name).toBe('Endrick');
  });

  it('reports the previous title, including when there was none', () => {
    expect(retitlePlayer(stored, 'dro', 'Dro Fernández')?.before).toBeNull();
  });

  it('returns null for an unknown id rather than inventing a record', () => {
    expect(retitlePlayer(stored, 'nobody', 'Nobody')).toBeNull();
  });
});
```

Add `retitlePlayer` to the file's import from `./rename.ts`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tools/squadctl/src/lib/rename.test.ts`
Expected: FAIL — `retitlePlayer is not exported`.

- [ ] **Step 3: Implement the pure function**

In `tools/squadctl/src/lib/rename.ts`:

```ts
export interface RetitleResult {
  players: Player[];
  /** Null when the record carried no title yet. */
  before: string | null;
  after: string;
}

/** Points a record at a different Wikipedia article title. One of the three
 *  answers to a `title-mismatch`: the person is the same and their article
 *  moved. Never touches `name` — that is `rename` — and never touches the id,
 *  which every squad file referencing this player depends on. */
export function retitlePlayer(
  players: readonly Player[],
  id: string,
  title: string,
): RetitleResult | null {
  const target = players.find((p) => p.id === id);
  if (target === undefined) return null;
  return {
    players: players.map((p) => (p.id === id ? { ...p, wikiTitle: title } : p)),
    before: target.wikiTitle,
    after: title,
  };
}
```

- [ ] **Step 4: Write the command**

Create `tools/squadctl/src/commands/retitle.ts`:

```ts
import { Args } from '@oclif/core';
import { BaseCommand } from '../base-command.ts';
import { readPlayers, writePlayers } from '../lib/players-file.ts';
import { retitlePlayer } from '../lib/rename.ts';

interface RetitleReport {
  id: string;
  before: string | null;
  after: string;
}

/** One of the three answers to a `title-mismatch`: same person, and Wikipedia
 *  moved their article. `fork` says two people; `alias --title` says one
 *  person under two titles, both of them right. */
export default class Retitle extends BaseCommand<RetitleReport> {
  static description =
    'Point an existing player record at a different Wikipedia article title, when the article moved and the person did not.';

  static args = {
    playerId: Args.string({ description: 'Existing player id, e.g. endrick', required: true }),
    title: Args.string({
      description: 'Article title as the source links it',
      required: true,
    }),
  };

  static examples = ['<%= config.bin %> retitle endrick "Endrick (footballer, born 2006)"'];

  async run(): Promise<RetitleReport> {
    const { args } = await this.parse(Retitle);
    const players = readPlayers(this.dataDir);

    const result = retitlePlayer(players, args.playerId, args.title);
    if (result === null) {
      this.error(`no player with id "${args.playerId}" in data/players.json`, { exit: 5 });
    }
    if (result.before === result.after) {
      this.error(`"${args.playerId}" already carries that title`, { exit: 5 });
    }

    await writePlayers(this.dataDir, result.players);

    this.report(`retitled ${args.playerId}: ${result.before ?? '(none)'} -> "${result.after}"`);
    this.report('  now re-run: npm run squadctl -- apply <envelopes> --dry-run');

    return { id: args.playerId, before: result.before, after: result.after };
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tools/squadctl/src/lib/rename.test.ts && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 6: Verify the command runs**

Run: `npm run squadctl -- retitle --help`
Expected: the description and both args print, exit 0.

- [ ] **Step 7: Document it**

In `tools/squadctl/README.md`, under Commands after `### rename`:

````markdown
### `retitle`

```bash
npm run squadctl -- retitle <playerId> "<article title as the source links it>"
```

Points a record at a different Wikipedia article title, for when the article
moved and the person did not. One of the three answers to a `title-mismatch`.
Never touches `name` — that is `rename` — and never rewrites an id.
````

In the "Commands own" table, add `retitle` to the row for `data/players.json`.

- [ ] **Step 8: Commit**

```bash
git add tools/squadctl/src/lib/rename.ts tools/squadctl/src/lib/rename.test.ts tools/squadctl/src/commands/retitle.ts tools/squadctl/README.md
git commit -m "feat(squadctl): retitle command for a moved article"
```

---

### Task 8: `fork`

Two different people. Writes the second record.

**Files:**

- Modify: `tools/squadctl/src/lib/rename.ts`
- Create: `tools/squadctl/src/commands/fork.ts`
- Test: `tools/squadctl/src/lib/rename.test.ts`
- Modify: `tools/squadctl/README.md`

**Interfaces:**

- Consumes: `playerId(name: string, taken: ReadonlySet<string>): string` exported from `./reconcile.ts`; `readPlayers` / `writePlayers`.
- Produces: `forkPlayer(players: readonly Player[], id: string, title: string): { players: Player[]; created: Player } | null`.

- [ ] **Step 1: Write the failing test**

Add to `tools/squadctl/src/lib/rename.test.ts`:

```ts
describe('forkPlayer', () => {
  const stored = [
    player({
      id: 'otavio',
      name: 'Otávio',
      fullName: 'Otávio Ataíde',
      birth: '2002-02-09',
      position: 'DF',
      nationality: 'Brazil',
      club: 'Paris FC',
      wikiTitle: 'Otávio (footballer, born 2002)',
    }),
  ];

  it('creates a second record under a fresh id, never rewriting the first', () => {
    const result = forkPlayer(stored, 'otavio', 'Otávio (footballer, born November 2005)');
    expect(result?.created.id).toBe('otavio-2');
    expect(result?.players.find((p) => p.id === 'otavio')?.wikiTitle).toBe(
      'Otávio (footballer, born 2002)',
    );
  });

  it('carries the given title on the new record', () => {
    const result = forkPlayer(stored, 'otavio', 'Otávio (footballer, born November 2005)');
    expect(result?.created.wikiTitle).toBe('Otávio (footballer, born November 2005)');
  });

  it('does NOT copy birth — that date belongs to the original person', () => {
    const result = forkPlayer(stored, 'otavio', 'Otávio (footballer, born November 2005)');
    expect(result?.created.birth).toBeNull();
  });

  it('does not copy club or nationality; the next apply fills them from the row', () => {
    const result = forkPlayer(stored, 'otavio', 'Otávio (footballer, born November 2005)');
    expect(result?.created.club).toBeNull();
    expect(result?.created.nationality).toBe('');
  });

  it('copies name and position, since Player.position admits no null', () => {
    const result = forkPlayer(stored, 'otavio', 'Otávio (footballer, born November 2005)');
    expect(result?.created.name).toBe('Otávio');
    expect(result?.created.position).toBe('DF');
  });

  it('returns null for an unknown id', () => {
    expect(forkPlayer(stored, 'nobody', 'Nobody')).toBeNull();
  });
});
```

Add `forkPlayer` to the import.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tools/squadctl/src/lib/rename.test.ts`
Expected: FAIL — `forkPlayer is not exported`.

- [ ] **Step 3: Implement the pure function**

In `tools/squadctl/src/lib/rename.ts`, add `import { playerId } from './reconcile.ts';` and:

```ts
export interface ForkResult {
  players: Player[];
  created: Player;
}

/** The "two different people" answer to a `title-mismatch`: writes a second
 *  record for the person the source is actually describing.
 *
 *  `birth`, `club` and `nationality` are deliberately NOT copied. The birth
 *  date belongs to the original person, and a wrong one on a duplicate record
 *  is exactly the damage the `possible-rename` hold exists to prevent; club
 *  and nationality are filled by the next `apply` from the row, under the
 *  field-ownership rules. `position` is copied only because `Player.position`
 *  admits no null, and a club squad's apply overwrites it from the row. */
export function forkPlayer(
  players: readonly Player[],
  id: string,
  title: string,
): ForkResult | null {
  const target = players.find((p) => p.id === id);
  if (target === undefined) return null;
  const created: Player = {
    id: playerId(target.name, new Set(players.map((p) => p.id))),
    name: target.name,
    fullName: target.fullName,
    birth: null,
    position: target.position,
    nationality: '',
    club: null,
    photo: null,
    wikiTitle: title,
  };
  return { players: [...players, created], created };
}
```

- [ ] **Step 4: Write the command**

Create `tools/squadctl/src/commands/fork.ts`:

```ts
import { Args } from '@oclif/core';
import { BaseCommand } from '../base-command.ts';
import { readPlayers, writePlayers } from '../lib/players-file.ts';
import { forkPlayer } from '../lib/rename.ts';

interface ForkReport {
  from: string;
  created: string;
  title: string;
}

/** One of the three answers to a `title-mismatch`: two different real people
 *  share a display name, and the source is describing the other one. */
export default class Fork extends BaseCommand<ForkReport> {
  static description =
    'Write a second player record for a different real person who shares a display name, carrying the article title that identifies them.';

  static args = {
    playerId: Args.string({
      description: 'Existing player id the row was matched to',
      required: true,
    }),
    title: Args.string({ description: 'Article title of the OTHER person', required: true }),
  };

  static examples = ['<%= config.bin %> fork otavio "Otávio (footballer, born November 2005)"'];

  async run(): Promise<ForkReport> {
    const { args } = await this.parse(Fork);
    const players = readPlayers(this.dataDir);

    const existing = players.find((p) => p.wikiTitle === args.title);
    if (existing !== undefined) {
      this.error(`"${args.title}" is already ${existing.id} — nothing to fork`, { exit: 5 });
    }

    const result = forkPlayer(players, args.playerId, args.title);
    if (result === null) {
      this.error(`no player with id "${args.playerId}" in data/players.json`, { exit: 5 });
    }

    await writePlayers(this.dataDir, result.players);

    this.report(`forked ${args.playerId} -> ${result.created.id} ("${args.title}")`);
    this.report('  club, nationality and birth are filled by the next apply, not copied');
    this.report('  now re-run: npm run squadctl -- apply <envelopes>');

    return { from: args.playerId, created: result.created.id, title: args.title };
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tools/squadctl/src/lib/rename.test.ts && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 6: Verify the command runs**

Run: `npm run squadctl -- fork --help`
Expected: description and both args print, exit 0.

- [ ] **Step 7: Document it**

In `tools/squadctl/README.md`, after `### retitle`:

````markdown
### `fork`

```bash
npm run squadctl -- fork <playerId> "<article title of the other person>"
```

Writes a second record for a different real person who shares a display name —
the two Otávios, the two Vitinhas. Copies the name and position; deliberately
does **not** copy `birth`, `club` or `nationality`, because the birth date
belongs to the original and the next `apply` fills the other two from the row.
````

Add `fork` to the `data/players.json` row of the "Commands own" table.

- [ ] **Step 8: Commit**

```bash
git add tools/squadctl/src/lib/rename.ts tools/squadctl/src/lib/rename.test.ts tools/squadctl/src/commands/fork.ts tools/squadctl/README.md
git commit -m "feat(squadctl): fork command for two people under one display name"
```

---

### Task 9: `alias --title`

One person, two unrelated link targets — the Grimaldo case.

**Files:**

- Modify: `tools/squadctl/src/commands/alias.ts`
- Create: `tools/squadctl/src/commands/alias.integration.test.ts`
- Modify: `tools/squadctl/README.md`

**Interfaces:**

- Consumes: `addTitleAlias` (Task 3), `readPlayers` (Task 2).
- Produces: `alias <playerId> --title "<title>"` writing `decisions.json`'s `titleAliases`.

- [ ] **Step 1: Write the failing test**

Create `tools/squadctl/src/commands/alias.integration.test.ts`. It spawns the real CLI against a throwaway data root via `SQUADCTL_REPO_ROOT`, the same pattern `registry/check.integration.test.ts` uses:

```ts
// `alias` has two meanings behind one command — another display name, and
// another article title — and the flag is what picks. Spawned rather than
// called in-process because the thing under test is which file the command
// writes.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import type { Player } from '../../../../types/squad.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../../..');
const CLI = path.join(REPO_ROOT, 'tools', 'squadctl', 'bin', 'dev.js');

const madeRoots: string[] = [];
afterEach(() => {
  for (const root of madeRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

/** A throwaway repo holding one player and an empty decision file. */
function fixture(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'squadctl-alias-'));
  madeRoots.push(root);
  mkdirSync(path.join(root, 'data'), { recursive: true });

  const grimaldo: Player = {
    id: 'grimaldo',
    name: 'Álex Grimaldo',
    fullName: 'Alejandro Grimaldo García',
    birth: '1995-09-20',
    position: 'DF',
    nationality: 'Spain',
    club: 'Atlético Madrid',
    photo: null,
    wikiTitle: 'Álex Grimaldo',
  };
  writeFileSync(path.join(root, 'data', 'players.json'), JSON.stringify([grimaldo]));
  writeFileSync(
    path.join(root, 'data', 'decisions.json'),
    JSON.stringify({ splits: [], aliases: [] }),
  );
  return root;
}

function runAlias(root: string, argv: string[]): { status: number | null } {
  const result = spawnSync(process.execPath, [CLI, 'alias', ...argv], {
    env: { ...process.env, SQUADCTL_REPO_ROOT: root },
    encoding: 'utf8',
  });
  return { status: result.status };
}

function decisions(root: string): {
  aliases?: { player: string; name: string }[];
  titleAliases?: { player: string; title: string }[];
} {
  return JSON.parse(readFileSync(path.join(root, 'data', 'decisions.json'), 'utf8')) as ReturnType<
    typeof decisions
  >;
}

describe('alias --title', () => {
  it('records a title alias, leaving name aliases untouched', () => {
    const root = fixture();
    expect(runAlias(root, ['grimaldo', '--title', 'Alejandro Grimaldo']).status).toBe(0);
    expect(decisions(root).titleAliases).toEqual([
      { player: 'grimaldo', title: 'Alejandro Grimaldo' },
    ]);
    expect(decisions(root).aliases).toEqual([]);
  });

  it('still records a name alias when --title is absent', () => {
    const root = fixture();
    expect(runAlias(root, ['grimaldo', 'Alejandro Grimaldo']).status).toBe(0);
    expect(decisions(root).aliases).toEqual([{ player: 'grimaldo', name: 'Alejandro Grimaldo' }]);
    expect(decisions(root).titleAliases ?? []).toEqual([]);
  });

  it('refuses a title the record already carries, which would be a no-op', () => {
    const root = fixture();
    expect(runAlias(root, ['grimaldo', '--title', 'Álex Grimaldo']).status).toBe(5);
  });

  it('refuses when neither a name nor --title is given', () => {
    const root = fixture();
    expect(runAlias(root, ['grimaldo']).status).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tools/squadctl/src/commands/alias.integration.test.ts`
Expected: FAIL — `--title` is not a known flag.

- [ ] **Step 3: Implement**

In `tools/squadctl/src/commands/alias.ts`:

- Import `Flags` alongside `Args` from `@oclif/core`, and `addTitleAlias` from `../lib/decisions.ts`.
- Make the `name` arg optional (`required: false`) and add:

```ts
  static flags = {
    title: Flags.string({
      description: 'Record an alternative Wikipedia article title instead of a name',
    }),
  };
```

- After parsing, branch:

```ts
const { args, flags } = await this.parse(Alias);
if (flags.title === undefined && args.name === undefined) {
  this.error('pass either a name or --title', { exit: 5 });
}
```

- When `flags.title` is set, validate against the target's `wikiTitle` (error if identical — an alias would be a no-op), call `addTitleAlias` instead of `addAlias`, and report:

```ts
this.report(`recorded: ${args.player} ("${target.name}") is also linked as "${flags.title}"`);
this.report('  both link targets now match this one record — re-run apply');
```

- Extend `AliasReport` to `{ player: string; name?: string; title?: string; alreadyRecorded: boolean }`.
- Add the example: `'<%= config.bin %> alias grimaldo --title "Alejandro Grimaldo"'`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tools/squadctl/src/commands/alias.integration.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Document it**

In `tools/squadctl/README.md`, extend the `### alias` section:

````markdown
```bash
npm run squadctl -- alias <playerId> "<other name>"
npm run squadctl -- alias <playerId> --title "<other article title>"
```

The `--title` form is the same idea one level up: two articles can _link_ one
person differently and both be right. Atlético links `Alejandro Grimaldo` where
Spain links `Álex Grimaldo`, and `retitle` cannot settle it — it just moves the
conflict to whichever squad links the other target. Recorded in
`decisions.json` under `titleAliases`, because a redirect is the one title fact
squadctl cannot re-derive without a network request.
````

- [ ] **Step 6: Commit**

```bash
git add tools/squadctl/src/commands/alias.ts tools/squadctl/src/commands/alias.integration.test.ts tools/squadctl/README.md
git commit -m "feat(squadctl): alias --title for a person under two link targets"
```

---

### Task 10: Document the handover and resolve the live case

The README's handover section is what a person reads when `apply` stops on this conflict. Then the actual Otávio fix, end to end.

**Files:**

- Modify: `tools/squadctl/README.md`
- Modify: `data/decisions.json` (remove the inert split entry)
- Modified by commands, never by hand: `data/players.json`, `data/squads/club/bundesliga/sge.json`, `data/squads/club/ligue-1/pfc.json`, `data/index.json`, `lib/squads.generated.ts`

- [ ] **Step 1: Write the handover section**

In `tools/squadctl/README.md`, under "Where the CLI hands over to you", after `### name-variant`:

````markdown
### `title-mismatch`

```
sge: conflicted (verified: false)
     conflict: identity conflict on otavio — stored "Otávio (footballer, born 2002)",
               source lists "Otávio (footballer, born November 2005)"
```

The row matched a stored record by display name, and the two link different
Wikipedia articles. Two different real people share a name — two Brazilian
defenders are both rendered `Otávio` — or one person's article moved. Nothing
in the data separates those, so squadctl writes nothing and asks.

**The squad slot is HELD on the stored record and no new player is created**,
for the same reason `possible-rename` holds: creating a second record for one
person is unrecoverable, and no later command undoes it. When the clashing
record is not in this squad at all there is no slot to hold, so the row is
omitted and reported as `omitted-row`.

**You decide: one person, or two?**

- **Same person, article moved** — point the record at the new title:

  ```bash
  npm run squadctl -- retitle otavio "Otávio (footballer, born November 2005)"
  ```

- **Same person, both titles right** — two articles can link one person through
  different targets. Atlético links `Alejandro Grimaldo`, Spain links
  `Álex Grimaldo`. `retitle` only moves the conflict to the other squad:

  ```bash
  npm run squadctl -- alias grimaldo --title "Alejandro Grimaldo"
  ```

- **Two different people** — write the second record:

  ```bash
  npm run squadctl -- fork otavio "Otávio (footballer, born November 2005)"
  ```

**What you touch:** `retitle` and `fork` write `data/players.json`;
`alias --title` writes `data/decisions.json`. Re-run `apply` afterwards either
way.

Note that most redirect pairs never reach you: a link to the undisambiguated
title (`[[Endrick]]` against `Endrick (footballer, born 2006)`) and an
accent-only difference (`Eric Garcia` against `Eric García`) are both resolved
as equivalent without asking.
````

Also update the reconciliation description near the top of the README: the match key is no longer the normalised name alone.

- [ ] **Step 2: Remove the inert split entry**

In `data/decisions.json`, delete the entry:

```json
{ "team": "pfc", "departed": "otavio", "arrived": "otavio-da-silva" }
```

leaving `"splits": []`. It never fired — `splitAccepted` is consulted only inside reconciliation's step 3, which a row that matched never reaches — and it asserts something false about a pair it can never be asked about.

- [ ] **Step 3: Rebuild the two envelopes from cache**

Run:

```bash
npm run squadctl -- fetch --offline --only pfc,sge --out .cache/envelopes/otavio
```

Expected: `pfc: 26 members from "Current squad" (cached)`, `sge: 26 members`, `2 fetched, 0 failed`. Zero network requests.

- [ ] **Step 4: Apply, and read the conflict**

Run: `npm run squadctl -- apply .cache/envelopes/otavio --dry-run`

Expected: one team back-fills `otavio`'s title and the other reports
`title-mismatch` on `otavio`, `verified: false`, exit `4`. Which team conflicts
depends on apply order; both outcomes are correct.

Then drop `--dry-run` to write the back-fill:

```bash
npm run squadctl -- apply .cache/envelopes/otavio
```

- [ ] **Step 5: Answer the conflict**

These are two different people — Paris FC's is born 2002, Frankfurt's born
November 2005. Fork whichever title the conflict named as the _source_ title:

```bash
npm run squadctl -- fork otavio "Otávio (footballer, born November 2005)"
```

- [ ] **Step 6: Re-apply and verify**

```bash
npm run squadctl -- apply .cache/envelopes/otavio
```

Expected: 0 conflicted, exit 0, both teams `verified: true`.

Then confirm the end state by hand:

```bash
grep -A1 '"playerId": "otavio' data/squads/club/bundesliga/sge.json data/squads/club/ligue-1/pfc.json
```

Expected: `sge.json` references `otavio-2`, `pfc.json` references `otavio`, and
`data/players.json` gives `otavio` club "Paris FC" and `otavio-2` club
"Eintracht Frankfurt", each with its own `wikiTitle`.

- [ ] **Step 7: Run the full check**

Run: `npm run check`
Expected: typecheck, lint, format, all tests (including the
`lib/dataIntegrity.test.ts` case that started this), `registry check`, and the
generated-file diff all clean. Report the actual output.

- [ ] **Step 8: Commit**

```bash
git add tools/squadctl/README.md data/decisions.json data/players.json data/squads data/index.json lib/squads.generated.ts
git commit -m "data: split the two Otávios onto separate player records"
```

---

## Notes for the implementer

- **`.cache/envelopes/otavio` is scratch.** Do not commit it; `.cache/` is ignored.
- **If `apply` reports a `blast-radius` conflict** on pfc or sge during Task 10, stop and read the diff — the cached wikitext may be older than the stored squad. It should not happen with a warm cache from this branch.
- **Never hand-edit a squad file to make a test pass.** The next `apply` overwrites it, and the fix belongs at `teams.json`, at a `retitle`/`alias`/`fork`, or in the parser.
