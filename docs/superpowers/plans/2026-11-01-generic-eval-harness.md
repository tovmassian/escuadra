# A generic eval harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `scripts/evals/` a harness any skill's suite can use, by moving what grades an issue triage into `.claude/skills/escuadra-issue-runner/evals/`, with every generated case file byte-identical to before.

**Architecture:** A `Suite` supplies its own expectation graders (`grade`) and the text appended to its dry run (`dryRunAppendix`); `lib/graders.ts` keeps only the generic `no-writes` and `stayed-dry` graders and the `Smoke` shape, and appends them after the suite's own. The triage template, `fieldPattern` and the `Triage`/`NoTriage` graders move into the skill's `evals/`, with their tests, which `tsconfig.json` and `vitest.config.ts` gain globs to reach. The entry points find suites as `.claude/skills/*/evals/cases.ts` and take one by skill name.

**Tech Stack:** Node 24 (TypeScript run directly), Vitest, TypeScript strict with `noUncheckedIndexedAccess`.

**Spec:** `docs/superpowers/specs/2026-10-16-issue-runner-evals-design.md` §9 ("Skill-agnostic harness"), and issue #170.

## Global Constraints

- `nvm use` first: Node 24+. TypeScript is strict, including `noUncheckedIndexedAccess`; never weaken it.
- **No npm script, no `.gitignore` line, no dependency, nothing else that moves the fingerprint.** `tsconfig.json` and `vitest.config.ts` are not fingerprint inputs; Task 4 proves it with a before/after hash.
- **Every generated `case.yaml`, `scaffold.sh` and `setup.json` stays byte-identical.** Never edit them by hand; `node scripts/evals/gen-cases.ts` must leave `git status` clean under `.claude/skills/escuadra-issue-runner/evals/` except for the new `.ts` files and `__tests__/`.
- **Nothing in a `.ts` file under `scripts/evals/` names the triage block or `escuadra-issue-runner`** (`grep -rniE 'triage|escuadra-issue-runner' scripts/evals --include='*.ts'` prints nothing). `scripts/evals/README.md` names the suite in its per-suite section, as the issue's Work list asks.
- Tests go in `__tests__/` folders that mirror the code; no network, no clock.
- No eval run: the scores stand because the generated files do not change.
- Commit style: conventional commits ending `(#170)`, with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Work on branch `refactor/170-generic-eval-harness` (already created, in place, off `main`).
- Match the surrounding code: a one- or two-line header comment per file saying what it is, terse JSDoc on exported fields, single quotes, 2-space indent, `.ts` extensions in imports.

## File map

| File                                                                           | After this plan                                                                                         |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `scripts/evals/lib/graders.ts`                                                 | Generic: `Expectation`, `Smoke`, `isSmoke`, `GH_LOG`, `STAYED_DRY_PATTERN`, `gradersFor(expect, grade)` |
| `scripts/evals/lib/triage.ts`                                                  | **Deleted** (moves to the skill)                                                                        |
| `scripts/evals/lib/cases.ts`                                                   | `EvalCase<E>`, `Suite<E>` with `grade` and `dryRunAppendix`                                             |
| `scripts/evals/lib/suite.ts`                                                   | Also `SKILLS_DIR`, `suiteNames(root)`, `suitePath(name, names)`, `loadSuite(evalsDir)`                  |
| `scripts/evals/{gen-cases,run,capture-issue}.ts`                               | Suite by skill name; gen-cases with no argument does every suite                                        |
| `scripts/evals/__tests__/suites.test.ts`                                       | Generic checks over every suite                                                                         |
| `scripts/evals/__tests__/lib/{graders,cases,run,suite}.test.ts`                | Generic, with a made-up expectation                                                                     |
| `.claude/skills/escuadra-issue-runner/evals/triage.ts`                         | **New**: the template, `escapeRegExp`, `fieldPattern` (moved verbatim)                                  |
| `.claude/skills/escuadra-issue-runner/evals/graders.ts`                        | **New**: `Triage`, `NoTriage`, `IssueRunnerExpectation`, `gradeIssueRunner`                             |
| `.claude/skills/escuadra-issue-runner/evals/cases.ts`                          | `Suite<IssueRunnerExpectation>` with `grade` and `dryRunAppendix`                                       |
| `.claude/skills/escuadra-issue-runner/evals/__tests__/{graders,suite}.test.ts` | **New**: the triage grader tests and this suite's own checks                                            |
| `tsconfig.json`, `vitest.config.ts`                                            | One glob each for `.claude/skills/*/evals/`                                                             |
| `scripts/evals/README.md`, spec §4.2 and §9, `CLAUDE.md` Reference             | The harness first, then a section per suite                                                             |

`staleCaseDirs` already skips folders whose name starts with `_`, so `__tests__/` in the suite's `evals/` is never taken for a stale case. `claude plugin eval` reads only folders with a `case.yaml`, as it already does beside `_fixtures/`.

---

### Task 1: The suite supplies its graders and dry-run text; triage moves to the skill

One atomic change: the generic types and the suite that uses them must change together for `tsc` and the in-sync test to pass.

**Files:**

- Modify: `scripts/evals/lib/graders.ts`, `scripts/evals/lib/cases.ts`
- Delete: `scripts/evals/lib/triage.ts`
- Create: `.claude/skills/escuadra-issue-runner/evals/triage.ts`, `.claude/skills/escuadra-issue-runner/evals/graders.ts`
- Modify: `.claude/skills/escuadra-issue-runner/evals/cases.ts`
- Modify: `tsconfig.json`, `vitest.config.ts`
- Test: `scripts/evals/__tests__/lib/graders.test.ts`, `scripts/evals/__tests__/lib/cases.test.ts` (rewritten generic); create `.claude/skills/escuadra-issue-runner/evals/__tests__/graders.test.ts`; modify `scripts/evals/__tests__/suites.test.ts` imports only (Task 2 splits it)

**Interfaces:**

- Produces, in `scripts/evals/lib/graders.ts`:
  ```ts
  export interface Expectation {
    kind: string;
  }
  export interface Smoke {
    kind: 'smoke';
    graders: YamlMap[];
  }
  export function isSmoke(expect: Expectation): expect is Smoke;
  export const GH_LOG: string;
  export const STAYED_DRY_PATTERN: string;
  export function gradersFor<E extends Expectation>(
    expect: E | Smoke,
    grade: (expect: E) => YamlMap[],
  ): YamlMap[];
  ```
- Produces, in `scripts/evals/lib/cases.ts`:
  ```ts
  export interface EvalCase<E extends Expectation = Expectation> {
    /* as now */ expect: E | Smoke;
  }
  export interface Suite<E extends Expectation = Expectation> {
    /* as now, plus: */ dryRunAppendix?: string;
    grade(expect: E): YamlMap[];
    cases: EvalCase<E>[];
  }
  export function caseYaml<E extends Expectation>(
    suite: Suite<E>,
    item: EvalCase<E>,
    dryRun: string,
  ): YamlMap;
  export function caseFiles<E extends Expectation>(
    suite: Suite<E>,
    item: EvalCase<E>,
    dryRun: string,
    scaffoldEntry: string,
  ): GeneratedFile[];
  ```
  `grade` is declared with **method syntax** on purpose: it makes `Suite<IssueRunnerExpectation>` assignable to `Suite` (the default), which `lib/suite.ts` loads every suite as.
- Produces, in the skill's `evals/graders.ts`: `Triage`, `NoTriage`, `type IssueRunnerExpectation = Triage | NoTriage`, `gradeIssueRunner(expect: IssueRunnerExpectation): YamlMap[]`.
- Produces, in the skill's `evals/triage.ts`: `TRIAGE_TEMPLATE`, `escapeRegExp`, `fieldPattern` (unchanged signatures).

- [ ] **Step 1: Record the baseline**

Run: `node scripts/evals/gen-cases.ts && git status --short`
Expected: `gen-cases: wrote 21 cases to .claude/skills/escuadra-issue-runner/evals` and a clean status (the generated files already match).

- [ ] **Step 2: Make the skill's evals reachable by tsc and Vitest**

In `tsconfig.json`, `include` becomes:

```json
  "include": [
    "**/*.ts",
    "**/*.tsx",
    ".claude/skills/*/evals/**/*.ts",
    ".expo/types/**/*.ts",
    "expo-env.d.ts"
  ]
```

(`**` skips folders that start with a dot, so `.claude/` is reached only by this glob; `.claude/worktrees/` stays out.)

In `vitest.config.ts`, add `'.claude/skills/*/evals/**/*.test.ts',` as the last `include` entry, and add one line to the header comment, after the `plugins/` line:

```ts
// .claude/skills/*/evals/ holds each skill's eval suite, with the graders only it uses.
```

- [ ] **Step 3: Write the skill's triage module (moved verbatim)**

Create `.claude/skills/escuadra-issue-runner/evals/triage.ts` with exactly the content of `scripts/evals/lib/triage.ts`, except the header comment's second line, which becomes:

```ts
// The triage block (spec §2.6): the template a dry run ends with, and the regex
// helpers its graders are built from. SKILL.md copies the template.
```

Then `git rm scripts/evals/lib/triage.ts`.

- [ ] **Step 4: Write the skill's graders test (moved from the harness)**

Create `.claude/skills/escuadra-issue-runner/evals/__tests__/graders.test.ts`. It is the triage part of today's `scripts/evals/__tests__/lib/graders.test.ts`: the `BLOCK`, `regexes`, `passes` and `proceed` constants, and the `describe` blocks `gradersFor a triage`, `gradersFor a negative case`, `fieldPattern` and `anchoring and boundaries`, moved as they are, with these changes:

- Imports:
  ```ts
  import { describe, expect, it } from 'vitest';
  import type { YamlMap } from '../../../../../scripts/evals/lib/yaml.ts';
  import { gradeIssueRunner, type Triage } from '../graders.ts';
  import { fieldPattern, TRIAGE_TEMPLATE } from '../triage.ts';
  ```
- Every `gradersFor(x)` becomes `gradeIssueRunner(x)`. The suite's graders no longer include the shared ones, so:
  - in `weighs the decision and writing above the slug`, drop the `no-writes` line (the generic test in Step 6 covers its weight);
  - `checks gh.log for writes, and judges questions with an LLM` becomes `judges questions with an LLM`, keeping only the `questions` assertion;
  - `gradersFor a negative case` expects `['no-triage', 'answered']`.
- Add one test to `gradersFor a triage`, so the order the generated `case.yaml` files depend on is pinned:
  ```ts
  it('lists the fields in the order case.yaml has them', () => {
    const all: Triage = {
      ...proceed,
      sizeEstimated: true,
      existing: ['#1'],
      questions: 'it asks X.',
    };
    expect(gradeIssueRunner(all).map((g) => g.name)).toEqual([
      'decision',
      'workspace',
      'base',
      'branch',
      'first-step',
      'execution',
      'size',
      'docs',
      'existing',
      'questions',
    ]);
  });
  ```

Run: `npx vitest run .claude/skills/escuadra-issue-runner/evals/__tests__/graders.test.ts`
Expected: FAIL, `Cannot find module '../graders.ts'`.

- [ ] **Step 5: Write the skill's graders**

Create `.claude/skills/escuadra-issue-runner/evals/graders.ts`:

```ts
// The issue runner's expectations and their graders (spec §8): a regex per triage field the
// case pins down, and an LLM judge for questions and answers. The harness adds the write check
// and the stayed-dry check after them.
import type { YamlMap } from '../../../../scripts/evals/lib/yaml.ts';
import { escapeRegExp, fieldPattern } from './triage.ts';

export interface Triage {
  // … the interface exactly as in today's scripts/evals/lib/graders.ts, comments included
}

export interface NoTriage {
  // … exactly as today
}

export type IssueRunnerExpectation = Triage | NoTriage;

function line(name: string, pattern: string, weight: number): YamlMap {
  return { type: 'regex', name, pattern, flags: 'm', weight };
}

export function gradeIssueRunner(expect: IssueRunnerExpectation): YamlMap[] {
  if (expect.kind === 'no-triage') {
    return [
      {
        type: 'regex',
        name: 'no-triage',
        pattern: '^decision:',
        flags: 'm',
        match: 'not_contains',
        weight: 3,
      },
      { type: 'llm', name: 'answered', criteria: expect.answered, weight: 2 },
    ];
  }
  return triageGraders(expect);
}

// function triageGraders(t: Triage): YamlMap[] — moved verbatim from scripts/evals/lib/graders.ts
```

Copy `Triage`, `NoTriage` and `triageGraders` character for character from today's `scripts/evals/lib/graders.ts`: any change to a pattern or weight changes `case.yaml`.

Run: `npx vitest run .claude/skills/escuadra-issue-runner/evals/__tests__/graders.test.ts`
Expected: PASS.

- [ ] **Step 6: Rewrite the generic graders test**

`scripts/evals/__tests__/lib/graders.test.ts` keeps `describe('stayed-dry', …)` (every test in it, its `call` helper and both command lists unchanged) and gains the generic checks, with a made-up expectation in place of a triage:

```ts
import { describe, expect, it } from 'vitest';
import { gradersFor, isSmoke, STAYED_DRY_PATTERN, type Expectation } from '../../lib/graders.ts';
import type { YamlMap } from '../../lib/yaml.ts';

// A made-up suite's expectation and grader, to show the harness takes any.
interface Echo extends Expectation {
  kind: 'echo';
  text: string;
}
const echo = (expect: Echo): YamlMap[] => [
  { type: 'regex', name: 'echo', pattern: expect.text, weight: 1 },
];
const ECHO: Echo = { kind: 'echo', text: 'hello' };

describe('gradersFor', () => {
  it("puts the suite's graders first, then no-writes and stayed-dry", () => {
    expect(gradersFor(ECHO, echo).map((g) => g.name)).toEqual(['echo', 'no-writes', 'stayed-dry']);
  });

  it('checks gh.log for writes, weighted 3', () => {
    expect(gradersFor(ECHO, echo).find((g) => g.name === 'no-writes')).toEqual({
      type: 'regex',
      name: 'no-writes',
      target: { source: 'file', path: '.git/sandbox/gh.log' },
      pattern: '^WRITE ',
      flags: 'm',
      match: 'not_contains',
      weight: 3,
    });
  });

  it("gives a smoke case only its own graders, without calling the suite's", () => {
    const graders: YamlMap[] = [{ type: 'regex', name: 'x', pattern: 'x' }];
    const never = (): YamlMap[] => {
      throw new Error('graded a smoke case');
    };
    expect(gradersFor({ kind: 'smoke', graders }, never)).toBe(graders);
  });
});

describe('isSmoke', () => {
  it('tells a smoke case from a suite expectation', () => {
    expect(isSmoke({ kind: 'smoke', graders: [] })).toBe(true);
    expect(isSmoke(ECHO)).toBe(false);
  });
});
```

In `describe('stayed-dry')`: `stayedDry(gradersFor(expectation))` and every `gradersFor({ kind: 'triage', decision: 'proceed' })` become `gradersFor(ECHO, echo)`; the test `is on every triage and negative case, …` becomes `is on every graded case, over the trace, weighted 2` and checks `gradersFor(ECHO, echo)` alone; `is not added to a smoke case` passes `echo` as the second argument. Remove `describe('gradersFor a triage')`, `describe('gradersFor a negative case')`, `describe('fieldPattern')` and `describe('anchoring and boundaries')` (now in the skill's test).

Run: `npx vitest run scripts/evals/__tests__/lib/graders.test.ts`
Expected: FAIL (`isSmoke` is not exported; `gradersFor` takes one argument).

- [ ] **Step 7: Make `lib/graders.ts` generic**

In `scripts/evals/lib/graders.ts`:

- Header comment:
  ```ts
  // The graders every graded case carries after its suite's own (spec §8): the write check and
  // the stayed-dry check. A smoke case carries its own graders instead.
  ```
- Remove the `import { escapeRegExp, fieldPattern } from './triage.ts';` line, the `Triage` and `NoTriage` interfaces, the `Expectation` union, `line()` and `triageGraders()`.
- Add, in their place:
  ```ts
  /** A suite's own expectation for a case, told apart by its kind. */
  export interface Expectation {
    kind: string;
  }

  /** A case that checks the sandbox itself, with graders written out. */
  export interface Smoke {
    kind: 'smoke';
    graders: YamlMap[];
  }

  export function isSmoke(expect: Expectation): expect is Smoke {
    return expect.kind === 'smoke';
  }
  ```
- `gradersFor` becomes:
  ```ts
  /** A smoke case's own graders, or the suite's for its expectation followed by the shared ones. */
  export function gradersFor<E extends Expectation>(
    expect: E | Smoke,
    grade: (expect: E) => YamlMap[],
  ): YamlMap[] {
    if (isSmoke(expect)) return expect.graders;
    return [...grade(expect), NO_WRITES, STAYED_DRY];
  }
  ```
  If TypeScript does not narrow `expect` to `E` after the guard, write `grade(expect as E)`: the guard has just excluded `Smoke`.
- `GH_LOG`, `NO_WRITES`, the stayed-dry constants, `STAYED_DRY_PATTERN` and `STAYED_DRY` stay exactly as they are.

Run: `npx vitest run scripts/evals/__tests__/lib/graders.test.ts`
Expected: PASS.

- [ ] **Step 8: Rewrite the generic cases test**

In `scripts/evals/__tests__/lib/cases.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  caseFiles,
  caseYaml,
  GRADED_TAG,
  setupFor,
  type EvalCase,
  type Suite,
} from '../../lib/cases.ts';
import type { Expectation } from '../../lib/graders.ts';
import type { YamlMap } from '../../lib/yaml.ts';

// A made-up suite's expectation, to show the harness takes any.
interface Echo extends Expectation {
  kind: 'echo';
  text: string;
}

const SUITE: Suite<Echo> = {
  pins: { main: 'a'.repeat(40) },
  allowedTools: ['Read', 'Bash(gh:*)'],
  runs: 3,
  maxTurns: 40,
  timeoutSeconds: 900,
  dryRunAppendix: 'End with ECHO.',
  grade: (expect): YamlMap[] => [{ type: 'regex', name: 'echo', pattern: expect.text }],
  cases: [],
};

const GRADED_CASE: EvalCase<Echo> = {
  name: '126-small-bug',
  why: 'An S bug, in place.',
  tags: ['core'],
  prompt: 'Pick up #126.',
  issues: [126],
  expect: { kind: 'echo', text: 'hello' },
};
```

Rename `TRIAGE_CASE` to `GRADED_CASE` throughout. The tests change as follows; the `setupFor` and `caseFiles` tests are otherwise unchanged:

- `gives a triage case the dry run and the template, …` becomes `gives a graded case the dry run and the suite's appendix, with the suite defaults`, expecting `append_system_prompt: 'This is a dry run.\n\nEnd with ECHO.\n'`.
- Add:
  ```ts
  it('gives a suite with no appendix the dry run alone', () => {
    const { dryRunAppendix: _, ...bare } = SUITE;
    const yaml = caseYaml(bare, GRADED_CASE, 'This is a dry run.\n');
    expect(yaml.execution).toMatchObject({ append_system_prompt: 'This is a dry run.\n' });
  });

  it("grades with the suite's graders, then the shared ones", () => {
    const yaml = caseYaml(SUITE, GRADED_CASE, 'Dry.\n');
    const graders = yaml.graders as YamlMap[];
    expect(graders.map((g) => g.name)).toEqual(['echo', 'no-writes', 'stayed-dry']);
  });
  ```
  If `noUnusedLocals` rejects `_`, build `bare` as `{ ...SUITE, dryRunAppendix: undefined }` instead and keep the test name; `caseYaml` must treat `undefined` as absent.
- `tags a triage case graded, after its own tags` becomes `tags a graded case graded, after its own tags`.
- The smoke test builds `const smoke: EvalCase<Echo> = { ...GRADED_CASE, … }` as now.

Run: `npx vitest run scripts/evals/__tests__/lib/cases.test.ts`
Expected: FAIL (`dryRunAppendix` and `grade` are not on `Suite`; the appendix is the triage template).

- [ ] **Step 9: Make `lib/cases.ts` generic**

In `scripts/evals/lib/cases.ts`:

- Imports: replace the `gradersFor` and `TRIAGE_TEMPLATE` imports with
  ```ts
  import { gradersFor, isSmoke, type Expectation, type Smoke } from './graders.ts';
  ```
- `export interface EvalCase<E extends Expectation = Expectation> {` and its field `expect: E | Smoke;`.
- `Suite` becomes generic, with two new fields before `cases`:
  ```ts
  export interface Suite<E extends Expectation = Expectation> {
    // … pins, hidden, allowedTools, runs, maxTurns, timeoutSeconds as now
    /** Appended to dry-run.md, after a blank line, in every graded case's system prompt. */
    dryRunAppendix?: string;
    /** A graded case's own graders; no-writes and stayed-dry follow them. */
    grade(expect: E): YamlMap[];
    cases: EvalCase<E>[];
  }
  ```
- `setupFor`, `caseYaml` and `caseFiles` take `<E extends Expectation>(suite: Suite<E>, item: EvalCase<E>, …)`.
- In `caseYaml`:
  ```ts
  const smoke = isSmoke(item.expect);
  if (!smoke) {
    const parts = [dryRun.trim()];
    if (suite.dryRunAppendix !== undefined) parts.push(suite.dryRunAppendix);
    execution.append_system_prompt = `${parts.join('\n\n')}\n`;
  }
  return {
    // …
    tags: smoke ? item.tags : [...item.tags, GRADED_TAG],
    // …
    graders: gradersFor(item.expect, (expect) => suite.grade(expect)),
  };
  ```

Run: `npx vitest run scripts/evals/__tests__/lib/cases.test.ts`
Expected: PASS.

- [ ] **Step 10: Wire the issue-runner suite**

In `.claude/skills/escuadra-issue-runner/evals/cases.ts`:

- Imports:
  ```ts
  import type { EvalCase, Suite } from '../../../../scripts/evals/lib/cases.ts';
  import { GH_LOG, STAYED_DRY_PATTERN } from '../../../../scripts/evals/lib/graders.ts';
  import { gradeIssueRunner, type IssueRunnerExpectation, type Triage } from './graders.ts';
  import { TRIAGE_TEMPLATE } from './triage.ts';
  ```
- `const SMOKE: EvalCase<IssueRunnerExpectation>`, `const CASES: EvalCase<IssueRunnerExpectation>[]`.
- `export const SUITE: Suite<IssueRunnerExpectation> = {`, adding after `timeoutSeconds: 900,`:
  ```ts
    dryRunAppendix: TRIAGE_TEMPLATE,
    grade: gradeIssueRunner,
  ```

In `scripts/evals/__tests__/suites.test.ts`, change only the import of `TRIAGE_TEMPLATE` to `'../../../.claude/skills/escuadra-issue-runner/evals/triage.ts'` (Task 2 moves this test).

- [ ] **Step 11: Prove the generated files did not change**

Run: `node scripts/evals/gen-cases.ts && git status --short`
Expected: `gen-cases: wrote 21 cases …`; the status lists only the files this task changed or created (no `case.yaml`, `scaffold.sh` or `setup.json`).

Run: `npm run typecheck && npx vitest run scripts/evals .claude/skills && npm run lint && npx prettier --check scripts/evals .claude/skills/escuadra-issue-runner tsconfig.json vitest.config.ts`
Expected: all pass. `npx tsc --listFilesOnly -p . | grep '/.claude/'` lists the skill's `cases.ts`, `graders.ts`, `triage.ts` and `__tests__/graders.test.ts`, and nothing under `.claude/worktrees/`.

- [ ] **Step 12: Commit**

```bash
git add -A scripts/evals .claude/skills/escuadra-issue-runner/evals tsconfig.json vitest.config.ts
git commit -m "refactor(evals): a suite supplies its own graders and dry-run text (#170)

The triage template, fieldPattern and the Triage and NoTriage graders move
into the issue runner's evals/, with their tests. lib/graders.ts keeps only
no-writes and stayed-dry, which follow every suite's own graders.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Every suite is found, and each takes its own checks

**Files:**

- Modify: `scripts/evals/lib/suite.ts`
- Create: `scripts/evals/__tests__/lib/suite.test.ts`
- Modify: `scripts/evals/__tests__/suites.test.ts` (generic, over every suite)
- Create: `.claude/skills/escuadra-issue-runner/evals/__tests__/suite.test.ts`
- Modify: `scripts/evals/gen-cases.ts`

**Interfaces:**

- Consumes: `Suite` from `lib/cases.ts` (Task 1).
- Produces, in `scripts/evals/lib/suite.ts`:

  ```ts
  export const SKILLS_DIR = '.claude/skills';
  /** The skills under `root` that have an eval suite (`evals/cases.ts`), sorted. */
  export function suiteNames(root: string): string[];
  /** A skill's folder relative to the repo root, or an error naming the suites there are. */
  export function suitePath(name: string | undefined, names: string[]): string;
  export async function loadSuite(evalsDir: string): Promise<Suite>;
  export async function renderSuite(evalsDir: string): Promise<GeneratedFile[]>; // unchanged signature
  export function staleCaseDirs(evalsDir: string, files: GeneratedFile[]): string[]; // unchanged
  ```

- [ ] **Step 1: Write the failing test for suite discovery**

Create `scripts/evals/__tests__/lib/suite.test.ts`:

```ts
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { suiteNames, suitePath } from '../../lib/suite.ts';

describe('suiteNames', () => {
  let root = '';
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('lists the skills with an evals/cases.ts, sorted, and no others', () => {
    root = mkdtempSync(join(tmpdir(), 'suites-'));
    for (const skill of ['b-skill', 'a-skill']) {
      mkdirSync(join(root, '.claude/skills', skill, 'evals'), { recursive: true });
      writeFileSync(join(root, '.claude/skills', skill, 'evals', 'cases.ts'), '');
    }
    mkdirSync(join(root, '.claude/skills', 'no-evals'), { recursive: true });
    expect(suiteNames(root)).toEqual(['a-skill', 'b-skill']);
  });

  it('finds none when there is no skills folder', () => {
    root = mkdtempSync(join(tmpdir(), 'suites-'));
    expect(suiteNames(root)).toEqual([]);
  });
});

describe('suitePath', () => {
  it("gives the skill's folder", () => {
    expect(suitePath('a-skill', ['a-skill'])).toBe('.claude/skills/a-skill');
  });

  it('asks for a suite, naming the ones there are, when none or an unknown one is given', () => {
    expect(() => suitePath(undefined, ['a-skill', 'b-skill'])).toThrow(
      'Pick a suite with --suite <skill>: a-skill, b-skill',
    );
    expect(() => suitePath('c-skill', ['a-skill'])).toThrow(
      'No eval suite for c-skill. Pick a suite with --suite <skill>: a-skill',
    );
  });
});
```

Run: `npx vitest run scripts/evals/__tests__/lib/suite.test.ts`
Expected: FAIL (`suiteNames` is not exported).

- [ ] **Step 2: Implement discovery in `lib/suite.ts`**

Header comment becomes:

```ts
// Finds the suites (each skill's evals/cases.ts), loads one with its dry-run.md, and renders
// its generated files, formatted. Shared by the entry points and the suite-in-sync test.
```

Add:

```ts
export const SKILLS_DIR = '.claude/skills';

export function suiteNames(root: string): string[] {
  const skills = join(root, SKILLS_DIR);
  if (!existsSync(skills)) return [];
  return readdirSync(skills, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => existsSync(join(skills, entry.name, 'evals', 'cases.ts')))
    .map((entry) => entry.name)
    .sort();
}

export function suitePath(name: string | undefined, names: string[]): string {
  const pick = `Pick a suite with --suite <skill>: ${names.join(', ')}`;
  if (name === undefined) throw new Error(pick);
  if (!names.includes(name)) throw new Error(`No eval suite for ${name}. ${pick}`);
  return `${SKILLS_DIR}/${name}`;
}

export async function loadSuite(evalsDir: string): Promise<Suite> {
  const { SUITE } = (await import(pathToFileURL(join(evalsDir, 'cases.ts')).href)) as {
    SUITE: Suite;
  };
  return SUITE;
}
```

and `renderSuite` starts with `const SUITE = await loadSuite(evalsDir);` in place of its inline import.

Run: `npx vitest run scripts/evals/__tests__/lib/suite.test.ts`
Expected: PASS.

- [ ] **Step 3: Split the suite test**

Create `.claude/skills/escuadra-issue-runner/evals/__tests__/suite.test.ts` with the checks only this suite has, moved from `scripts/evals/__tests__/suites.test.ts` unchanged in body: `hides the skill from the sandbox clone (#171)`, `covers the matrix in spec §7, plus the smoke case`, `proves on the smoke case that stayed-dry matches a real commit in the trace`, `grades only first steps the triage template lists`, `gives the skill the triage template the graders read`, `keeps the skill's whole description, which an unquoted \` #\` would cut short`, and `keeps a case the skill must not fire on`. Header and imports:

```ts
// The escuadra-issue-runner suite's own checks; scripts/evals/__tests__/suites.test.ts checks
// what every suite must. Importing cases.ts here keeps its types checked against the graders.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { STAYED_DRY_PATTERN } from '../../../../../scripts/evals/lib/graders.ts';
import { SUITE } from '../cases.ts';
import { TRIAGE_TEMPLATE } from '../triage.ts';

const EVALS = fileURLToPath(new URL('../', import.meta.url));

describe('escuadra-issue-runner suite', () => {
  // … the seven tests
});
```

Rewrite `scripts/evals/__tests__/suites.test.ts` to check every suite, keeping the bodies of `matches cases.ts …`, `has a fixture for every issue a case loads`, `names every case uniquely, in kebab case`, `declares the PR every commit on main was merged through` and `commits every fixture a case writes`:

```ts
// Every skill's suite: its generated files match its cases.ts, and every case has what it
// loads. Each suite's own checks sit beside it, in its evals/__tests__/.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadSuite, renderSuite, SKILLS_DIR, staleCaseDirs, suiteNames } from '../lib/suite.ts';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SUITES = suiteNames(ROOT);

it('finds at least one suite', () => {
  expect(SUITES.length).toBeGreaterThan(0);
});

describe.each(SUITES)('%s suite', (skill) => {
  const EVALS = join(ROOT, SKILLS_DIR, skill, 'evals');

  it('matches cases.ts (regenerate with node scripts/evals/gen-cases.ts)', async () => {
    // … body as now
  });

  it('has a fixture for every issue a case loads', async () => {
    const SUITE = await loadSuite(EVALS);
    // … body as now
  });

  // … the other three, each starting with `const SUITE = await loadSuite(EVALS);` and made async
});
```

Run: `npx vitest run scripts/evals .claude/skills`
Expected: PASS, with the test names `escuadra-issue-runner suite > …` from both files. Temporarily break one generated file (`echo >> .claude/skills/escuadra-issue-runner/evals/open-pr/setup.json`), rerun `npx vitest run scripts/evals/__tests__/suites.test.ts`, expect FAIL on `matches cases.ts`, then `git checkout -- .claude/skills/escuadra-issue-runner/evals/open-pr/setup.json`.

- [ ] **Step 4: `gen-cases.ts` writes every suite, or the one named**

```ts
// Writes each case's case.yaml, scaffold.sh and setup.json from a suite's cases.ts (spec §9):
// `node scripts/evals/gen-cases.ts` for every suite, or `… gen-cases.ts <skill>` for one. Never
// edit the generated files; the suite-in-sync test fails when they drift from cases.ts.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderSuite, staleCaseDirs, suiteNames, suitePath } from './lib/suite.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const names = suiteNames(root);
const skills = process.argv[2] === undefined ? names : [process.argv[2]];

for (const skill of skills) {
  const evalsDir = join(root, suitePath(skill, names), 'evals');
  const files = await renderSuite(evalsDir);
  for (const name of staleCaseDirs(evalsDir, files)) {
    rmSync(join(evalsDir, name), { recursive: true });
  }
  for (const file of files) {
    const target = join(evalsDir, file.path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, file.content);
  }
  const cases = new Set(files.map((file) => file.path.split('/')[0])).size;
  process.stdout.write(`gen-cases: wrote ${cases} cases to ${relative(root, evalsDir)}\n`);
}
```

Run: `node scripts/evals/gen-cases.ts && node scripts/evals/gen-cases.ts escuadra-issue-runner && git status --short`
Expected: `gen-cases: wrote 21 cases to .claude/skills/escuadra-issue-runner/evals` twice; no generated file in the status. `node scripts/evals/gen-cases.ts nope` exits non-zero with `No eval suite for nope. Pick a suite with --suite <skill>: escuadra-issue-runner`.

- [ ] **Step 5: Commit**

```bash
git add -A scripts/evals .claude/skills/escuadra-issue-runner/evals
git commit -m "refactor(evals): gen-cases and the in-sync test cover every skill's suite (#170)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `run.ts` and `capture-issue.ts` take the suite by skill name

**Files:**

- Modify: `scripts/evals/run.ts`, `scripts/evals/capture-issue.ts`, `scripts/evals/__tests__/lib/run.test.ts`, `scripts/evals/sandbox/gh.ts:432` (comment)

**Interfaces:**

- Consumes: `suiteNames(root)`, `suitePath(name, names)` from `lib/suite.ts` (Task 2).

- [ ] **Step 1: `run.ts`**

- Header's first line: `// Runs a skill's eval suite (spec §9): \`node scripts/evals/run.ts --suite <skill> --tag core\`,` and keep the next lines (`--case`, `--full`).
- `suite: { type: 'string' },` (no default).
- `import { suiteNames, suitePath } from './lib/suite.ts';`
- Before `mkdtempSync`: `const target = suitePath(values.suite, suiteNames(root));`, so a missing or unknown `--suite` fails before a temporary directory is made; `evalArgs({ target, … })`.

- [ ] **Step 2: `capture-issue.ts`**

- Header's first lines:
  ```ts
  // Captures a real issue as a fixture for a skill's suite:
  //   node scripts/evals/capture-issue.ts 126 --suite <skill> --why "S bug, in place"
  ```
- `suite: { type: 'string' },` (no default); the usage error becomes `'usage: node scripts/evals/capture-issue.ts <number> --suite <skill> --why "<what it tests>"'`.
- `import { suiteNames, suitePath } from './lib/suite.ts';` and, right after the usage check, `const skill = suitePath(values.suite, suiteNames(root));`; the fixture path is `join(root, skill, 'evals', '_fixtures', 'issues', \`${number}.json\`)`.

- [ ] **Step 3: Names that leave `scripts/evals/`**

- `scripts/evals/__tests__/lib/run.test.ts`: `'.claude/skills/escuadra-issue-runner'` becomes `'.claude/skills/some-skill'` in both places.
- `scripts/evals/sandbox/gh.ts:432`: `reduced to what triage needs` becomes `reduced to what a run needs`.

- [ ] **Step 4: Verify**

Run: `grep -rniE 'triage|escuadra-issue-runner' scripts/evals --include='*.ts'`
Expected: no output.

Run: `node scripts/evals/run.ts --tag core; echo "exit $?"`
Expected: an error `Pick a suite with --suite <skill>: escuadra-issue-runner` and a non-zero exit, **before** `claude` is spawned (no `Results and report:` line). Do not run it with a valid `--suite`: that starts a billed eval run.

Run: `node scripts/evals/capture-issue.ts 170 --why x; echo "exit $?"`
Expected: the `Pick a suite …` error, non-zero, and no fixture written (`git status --short` unchanged).

Run: `npm run typecheck && npx vitest run scripts/evals .claude/skills`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/evals
git commit -m "refactor(evals): run.ts and capture-issue.ts take the suite by skill name (#170)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The docs, and the acceptance checks

**Files:**

- Modify: `scripts/evals/README.md`, `docs/superpowers/specs/2026-10-16-issue-runner-evals-design.md` (§4.2 and §9), `CLAUDE.md` (Reference line)

- [ ] **Step 1: `scripts/evals/README.md`: the harness first, then a section per suite**

Restructure, keeping every fact it has today (budget, defaults, `--keep`, what a run can and cannot do, pins, hidden paths, capture). Shape:

```markdown
# Evals

A harness for grading how an agent does a task with and without a skill, using Claude Code's `claude plugin eval`. Each skill's suite lives in its own `.claude/skills/<skill>/evals/`; this folder knows none of them. Design: [the eval spec](../../docs/superpowers/specs/2026-10-16-issue-runner-evals-design.md).

## Run a suite

(the budget paragraph and the table, every command with `--suite <skill>` after `run.ts`;
the `--full`, defaults and `--keep` paragraphs as now)

## Change a suite

(the cases, capture and pins bullets, made generic: `cases.ts` and `dry-run.md` in the suite's
`evals/`, `node scripts/evals/gen-cases.ts` regenerates every suite, `capture-issue.ts … --suite <skill>`)

## Add a suite for another skill

1. `.claude/skills/<skill>/evals/cases.ts` exports `SUITE: Suite<E>` (`lib/cases.ts`): the pins, the hidden paths, the tools, the cases, the `grade` function for the suite's own expectation type `E`, and optionally `dryRunAppendix`.
2. `dry-run.md` beside it is every graded case's system prompt, followed by `dryRunAppendix`.
3. Expectation types and their graders, and their tests in `evals/__tests__/`, stay in the suite: the harness adds `no-writes` and `stayed-dry` after them, and a `smoke` case carries its own graders.
4. Hide the skill folder and anything else that holds the answers (`hidden`).
5. `node scripts/evals/gen-cases.ts`; `npm run check` then checks the suite stays in sync.

## What a run can and cannot do

(as now)

## Suites

### escuadra-issue-runner

Grades the triage block the issue runner prints before it works ([`evals/`](../../.claude/skills/escuadra-issue-runner/evals/)): `triage.ts` holds the template, `graders.ts` a regex per field and the LLM judges. A full gate is about 130 sessions and $45 (the spec's [Run costs](…#run-costs)). Its `dry-run.md` must tell the agent to read `CLAUDE.md` and the rule for each topic the request touches, since a run preloads none of them (`CLAUDE_CODE_DISABLE_CLAUDE_MDS=1`).
```

Move every sentence that is about the issue-runner suite (the 130-session figure, the `open-pr` example case, the `dry-run.md` / `CLAUDE.md` note) into its section; keep no fact in two places.

- [ ] **Step 2: The spec**

- §4.2: `followed by the triage template from \`scripts/evals/lib/triage.ts\``becomes`followed by the triage template from \`evals/triage.ts\` (the suite's \`dryRunAppendix\`)`.
- §9 layout: `lib/` reads `pure: YAML, the generic graders, cases, sandbox build, run args, capture, suite discovery`; the skill's tree adds
  ```
      triage.ts                         the triage template and field patterns
      graders.ts                        the Triage and NoTriage graders
      __tests__/                        their tests and the suite's own checks
  ```
  and `__tests__/` under `scripts/evals/` reads `mirrors lib/ and sandbox/, plus the in-sync test over every suite`.
- §9 commands: `node scripts/evals/run.ts --suite escuadra-issue-runner --tag core`.
- §9 "Skill-agnostic harness" bullet becomes: the harness knows no skill. A suite is a skill's `evals/cases.ts`, which supplies its expectation graders and the text appended to its dry run; `lib/` keeps `no-writes`, `stayed-dry` and the shapes they share. `gen-cases.ts` and the in-sync test cover every suite, and `run.ts` and `capture-issue.ts` take one by skill name (#170).
- §9's "It sits under `scripts/`, which … already cover": add that `tsconfig.json` and `vitest.config.ts` reach `.claude/skills/*/evals/` by a glob of their own.

- [ ] **Step 3: `CLAUDE.md`**

The Reference line becomes:

```markdown
- [`scripts/evals/README.md`](scripts/evals/README.md): the eval harness, and grading each
  skill's suite with and without its skill.
```

- [ ] **Step 4: Acceptance checks**

Run each, and record the output for the PR body:

1. Byte-identical: `node scripts/evals/gen-cases.ts && git diff --stat main -- '.claude/skills/escuadra-issue-runner/evals/*/case.yaml' '.claude/skills/escuadra-issue-runner/evals/*/scaffold.sh' '.claude/skills/escuadra-issue-runner/evals/*/setup.json'` prints nothing.
2. `grep -rniE 'triage|escuadra-issue-runner' scripts/evals --include='*.ts'` prints nothing.
3. No fingerprint change: `git diff --stat main -- package.json package-lock.json app.json eas.json fingerprint.config.js .gitignore` prints nothing, and `npx expo-updates fingerprint:generate --platform ios` and `--platform android` give the same hashes on this branch as on `main` (run them on `main` in a detached worktree: `git worktree add --detach "$TMPDIR/fp-main" main`, `npm ci` there is not needed if `node_modules` is symlinked: `ln -s "$PWD/node_modules" "$TMPDIR/fp-main/node_modules"`; remove the worktree after).
4. `npm run check` passes; record its summary lines.

- [ ] **Step 5: Commit**

```bash
git add scripts/evals/README.md docs/superpowers/specs/2026-10-16-issue-runner-evals-design.md CLAUDE.md
git commit -m "docs(evals): the harness first, then a section per suite (#170)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
