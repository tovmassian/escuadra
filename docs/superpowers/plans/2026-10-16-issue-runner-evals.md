# Issue-runner eval suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `claude plugin eval` suite that grades an agent's triage of an Escuadra issue, with and without the `escuadra-issue-runner` skill, in a sandbox that cannot reach the real repo or GitHub (#136, PR 1 of 2).

**Architecture:** A skill-agnostic harness in `scripts/evals/`:

- a fake `gh` (`sandbox/`) copied into every run's sandbox;
- a sandbox builder (`lib/sandbox.ts`, run by `scaffold.ts`);
- a case generator (`lib/` plus `gen-cases.ts`) that turns the suite's `cases.ts` into each case's `case.yaml`, `scaffold.sh` and `setup.json`;
- a runner wrapper (`run.ts`);
- a snapshot tool (`capture-issue.ts`).

The suite lives in `.claude/skills/escuadra-issue-runner/evals/`, next to a stub `SKILL.md`. Its without-skill run is the RED baseline that PR 2 writes the skill against.

**Tech Stack:** Node 24 (TypeScript run directly, type stripping), Vitest 3 (node environment), Prettier 3's API for formatting generated files, `git`, `jq`, Claude Code 2.1.278's `claude plugin eval`.

**Spec:** `docs/superpowers/specs/2026-10-16-issue-runner-evals-design.md`. Read §4–§11 before starting; §11 lists what the spike found about the eval runner's environment.

## Global Constraints

- **Node runs the TypeScript directly**, so use only erasable syntax: no `enum`, `namespace` or parameter properties. Import types with `import type` or an inline `type` specifier, and write `.ts` extensions in relative imports.
- **No new dependencies, npm scripts or `.gitignore` lines.** Don't touch `app.json`, `eas.json` or `fingerprint.config.js`. They move the fingerprint (`CLAUDE.md` › Releases).
- **`scripts/evals/sandbox/gh.ts` and `gh-cli.ts` import only Node built-ins.** They are copied into each sandbox on their own.
- **Output goes through `process.stdout.write` / `process.stderr.write`.** ESLint's `no-console` allows only `warn` and `error`.
- **Tests live in `scripts/evals/__tests__/`, mirroring the code** (`__tests__/lib/`, `__tests__/sandbox/`). They need no network and no pinned history, since CI checks out one commit.
- **Prettier:** `singleQuote`, `trailingComma: all`, `printWidth: 100`, `semi`. Run `npx prettier --write <files>` before committing.
- **Pins:** `main` → `deb2e3b9c589bf2c5619fe3a7b82866ef9415ebf`, `release/1.0.0` → `d8f2d21bb9bb4bf3256e64d3ca06b785ad7bd20b`.
- **Commits:** conventional, ending `(#136)`, with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **The owner's usage limits:** every `claude plugin eval` run draws on them. Only the one-run Haiku smoke case (Task 7) runs without asking first.
- **Never push, open a PR or publish a report** without asking the owner.
- **A worktree-isolated session may refuse** commands that contain the word `eval` or several `git` invocations. If one is refused, put the command in a script file under the session's scratchpad and run `bash <that file>`.

## File map

| File                                                    | Responsibility                                                                                                                 |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `scripts/evals/sandbox/gh.ts`                           | The fake `gh`: a pure `handle(args, store, jq)` that answers reads from fixtures, refuses writes and returns the `gh.log` line |
| `scripts/evals/sandbox/gh-cli.ts`                       | Loads fixtures from `<git common dir>/sandbox`, calls `handle`, appends to `gh.log`                                            |
| `scripts/evals/lib/sandbox.ts`                          | `buildSandbox(options)`: the bare origin, the clone, synthetic history, state, `.git/sandbox/`                                 |
| `scripts/evals/scaffold.ts`                             | Entry run by each case's `scaffold.sh` inside the run's working directory                                                      |
| `scripts/evals/lib/triage.ts`                           | The triage template and the regex helpers its graders use                                                                      |
| `scripts/evals/lib/yaml.ts`                             | `toYaml(value)` for the shapes a `case.yaml` holds                                                                             |
| `scripts/evals/lib/graders.ts`                          | Expectation types and `gradersFor(expectation)`                                                                                |
| `scripts/evals/lib/cases.ts`                            | `EvalCase`, `Suite`, `caseYaml`, `setupFor`, `caseFiles`                                                                       |
| `scripts/evals/lib/format.ts`                           | `formatFor(path, content)` through Prettier's API                                                                              |
| `scripts/evals/lib/suite.ts`                            | `renderSuite(evalsDir)`, `staleCaseDirs(...)`: shared by the generator and the in-sync test                                    |
| `scripts/evals/gen-cases.ts`                            | Entry: writes the generated files                                                                                              |
| `scripts/evals/lib/run.ts`                              | `evalArgs(options)`, `evalEnv(env)`                                                                                            |
| `scripts/evals/run.ts`                                  | Entry: runs `claude plugin eval` with those                                                                                    |
| `scripts/evals/lib/capture.ts`                          | `toFixture(...)`, `sizeFrom(...)`, `SIZE_QUERY`                                                                                |
| `scripts/evals/capture-issue.ts`                        | Entry: real issue → fixture, through the real `gh`                                                                             |
| `scripts/evals/README.md`                               | The front door                                                                                                                 |
| `.claude/skills/escuadra-issue-runner/SKILL.md`         | Stub until PR 2                                                                                                                |
| `.claude/skills/escuadra-issue-runner/evals/cases.ts`   | The suite as data                                                                                                              |
| `.claude/skills/escuadra-issue-runner/evals/dry-run.md` | The dry-run instruction                                                                                                        |
| `.claude/skills/escuadra-issue-runner/evals/_fixtures/` | Issue fixtures (`issues/*.json`; the seven real ones are already committed) and synthetic docs (`docs/`)                       |
| `.claude/skills/escuadra-issue-runner/evals/<case>/`    | Generated: `case.yaml`, `scaffold.sh`, `setup.json`                                                                            |

---

### Task 1: The fake `gh`: issues, writes and the log

**Files:**

- Create: `scripts/evals/sandbox/gh.ts`
- Test: `scripts/evals/__tests__/sandbox/gh.test.ts`

**Interfaces:**

- Produces: `handle(args: string[], store: Store, jq: Jq): GhResult`, `isWrite(args: string[]): boolean`, and the types `IssueFixture`, `PrFixture`, `Store`, `GhResult`, `Jq`. Task 2 extends `read()` in this file. Tasks 3, 5 and 8 import the types.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/evals/__tests__/sandbox/gh.test.ts
import { describe, expect, it } from 'vitest';
import { handle, isWrite, type IssueFixture, type Jq, type Store } from '../../sandbox/gh.ts';

function issue(fields: Partial<IssueFixture> & Pick<IssueFixture, 'number'>): IssueFixture {
  return {
    title: `Issue ${fields.number}`,
    state: 'OPEN',
    body: 'Body.',
    comments: [],
    labels: [],
    milestone: null,
    size: null,
    source: 'synthetic',
    why: 'test',
    ...fields,
  };
}

const STORE: Store = {
  issues: [
    issue({
      number: 126,
      title: 'fix: photo credits are cut off',
      labels: ['bug'],
      milestone: 'v2.0.0',
      size: 'S',
      body: 'Credits clip on iPhone.',
      comments: [{ author: 'tovmassian', body: 'Seen on a 17.' }],
    }),
    issue({ number: 115, title: 'feat(study): player cards', state: 'CLOSED', size: 'L' }),
    issue({ number: 9009, title: 'fix(theme): toggle label' }),
  ],
  prs: [],
  currentBranch: 'main',
};

// Echoes the expression, so a test can see that --jq reached jq with the right JSON.
const jq: Jq = (input, expression) => {
  const value = JSON.parse(input) as { title?: string };
  return `jq(${expression}) on ${value.title ?? 'a list'}\n`;
};
const gh = (...args: string[]) => handle(args, STORE, jq);
const numbers = (stdout: string) =>
  (JSON.parse(stdout) as { number: number }[]).map((item) => item.number);

describe('issue view', () => {
  it('prints only the --json fields asked for, and logs a read', () => {
    const result = gh('issue', 'view', '126', '--json', 'title,state,milestone');
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      title: 'fix: photo credits are cut off',
      state: 'OPEN',
      milestone: { title: 'v2.0.0' },
    });
    expect(result.log).toBe('READ gh issue view 126 --json title,state,milestone');
  });

  it('accepts #N and an issue URL', () => {
    expect(gh('issue', 'view', '#126', '--json', 'number').stdout).toContain('126');
    const url = 'https://github.com/tovmassian/escuadra/issues/126';
    expect(gh('issue', 'view', url, '--json', 'number').stdout).toContain('126');
  });

  it('hands --jq the selected JSON', () => {
    expect(gh('issue', 'view', '126', '--json', 'title', '--jq', '.title').stdout).toBe(
      'jq(.title) on fix: photo credits are cut off\n',
    );
  });

  it('names a field it does not have, as gh does', () => {
    const result = gh('issue', 'view', '126', '--json', 'size');
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Unknown JSON field: "size"');
  });

  it('prints the issue as text, comments included with --comments', () => {
    const text = gh('issue', 'view', '126', '--comments').stdout;
    expect(text).toContain('fix: photo credits are cut off #126');
    expect(text).toContain('Milestone: v2.0.0');
    expect(text).toContain('Credits clip on iPhone.');
    expect(text).toContain('Seen on a 17.');
  });

  it('fails for an issue the case has no fixture for', () => {
    const result = gh('issue', 'view', '42');
    expect(result.code).toBe(1);
    expect(result.log).toBe('READ gh issue view 42');
  });
});

describe('issue list', () => {
  it('lists open issues, newest first', () => {
    expect(numbers(gh('issue', 'list', '--json', 'number').stdout)).toEqual([9009, 126]);
  });

  it('includes closed issues with --state all', () => {
    expect(numbers(gh('issue', 'list', '--state', 'all', '--json', 'number').stdout)).toEqual([
      9009, 126, 115,
    ]);
  });

  it('filters by the words of --search, ignoring qualifiers', () => {
    const result = gh('issue', 'list', '--search', 'credits is:open', '--json', 'number');
    expect(numbers(result.stdout)).toEqual([126]);
  });
});

describe('writes', () => {
  it.each([
    ['pr', 'create', '--title', 'x', '--body', 'y'],
    ['issue', 'comment', '126', '--body', 'hi'],
    ['issue', 'edit', '126', '--add-label', 'bug'],
    ['project', 'item-edit', '--id', 'X'],
    ['api', 'repos/tovmassian/escuadra/issues/126/comments', '-f', 'body=hi'],
    ['api', '-X', 'PATCH', 'repos/tovmassian/escuadra/issues/126'],
    ['api', 'graphql', '-f', 'query=mutation { addComment(input: {}) { clientMutationId } }'],
  ])('refuses and logs gh %s %s', (...args: string[]) => {
    const result = gh(...args);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('dry run');
    expect(result.log.startsWith(`WRITE gh ${args[0]} `)).toBe(true);
  });

  it('treats a GraphQL query and a plain GET as reads', () => {
    expect(isWrite(['api', 'graphql', '-f', 'query=query { viewer { login } }'])).toBe(false);
    expect(isWrite(['api', 'repos/tovmassian/escuadra/milestones'])).toBe(false);
    expect(isWrite(['api', '-X', 'GET', 'search/issues', '-f', 'q=credits'])).toBe(false);
  });
});

describe('everything else', () => {
  it('logs an unsupported command and fails', () => {
    const result = gh('browse');
    expect(result.code).toBe(1);
    expect(result.log).toBe('UNSUPPORTED gh browse');
  });

  it('quotes arguments that hold spaces in the log', () => {
    expect(gh('issue', 'comment', '126', '--body', 'two words').log).toBe(
      'WRITE gh issue comment 126 --body "two words"',
    );
  });

  it('answers auth status as signed in', () => {
    expect(gh('auth', 'status').stdout).toContain('Logged in to github.com');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run scripts/evals/__tests__/sandbox/gh.test.ts`
Expected: FAIL, `Failed to load url ../../sandbox/gh.ts` (or "Cannot find module").

- [ ] **Step 3: Write the implementation**

```ts
// scripts/evals/sandbox/gh.ts
// The GitHub CLI inside an eval sandbox (spec §5.1). It answers reads from the
// case's fixtures, refuses every write, and returns the gh.log line either way,
// so a grader can tell a run that tried to write. Copied into each sandbox next
// to gh-cli.ts, so it imports nothing but Node built-ins.

export interface IssueFixture {
  number: number;
  title: string;
  state: 'OPEN' | 'CLOSED';
  body: string;
  comments: { author: string; body: string }[];
  labels: string[];
  milestone: string | null;
  /** The board's Size field, or null when the issue has none. */
  size: string | null;
  /** "real snapshot YYYY-MM-DD…" or "synthetic". */
  source: string;
  /** What the cases that load it test. */
  why: string;
}

export interface PrFixture {
  number: number;
  title: string;
  state: 'OPEN' | 'CLOSED' | 'MERGED';
  headRefName: string;
  baseRefName: string;
  body: string;
}

export interface Store {
  issues: IssueFixture[];
  prs: PrFixture[];
  /** The checked-out branch, for `gh pr view` with no argument. */
  currentBranch: string | null;
}

export interface GhResult {
  code: number;
  stdout: string;
  stderr: string;
  /** The gh.log line: READ, WRITE or UNSUPPORTED, then the command. */
  log: string;
}

/** Runs a jq expression over JSON text and returns its raw output, as `gh --jq` does. */
export type Jq = (input: string, expression: string) => string;

type Json = string | number | boolean | null | Json[] | JsonObject;
interface JsonObject {
  [key: string]: Json;
}
type Answer = Omit<GhResult, 'log'>;

interface Parsed {
  positional: string[];
  flags: Map<string, string[]>;
  switches: Set<string>;
}

const OWNER = 'tovmassian';
const REPO = `${OWNER}/escuadra`;
const WEB = `https://github.com/${REPO}`;

// The verbs that only read. Any other verb of these groups writes.
const READS: Record<string, string[]> = {
  issue: ['view', 'list', 'status'],
  pr: ['view', 'list', 'status', 'diff', 'checks'],
  repo: ['view'],
  auth: ['status'],
  project: ['view', 'list', 'field-list', 'item-list'],
  label: ['list'],
  release: ['view', 'list'],
  run: ['view', 'list'],
  workflow: ['view', 'list'],
  search: ['issues', 'prs', 'code', 'commits', 'repos'],
  gist: ['view', 'list'],
  secret: ['list'],
  variable: ['list'],
};

const VALUED = new Set([
  '--json',
  '--jq',
  '-q',
  '--template',
  '-t',
  '--repo',
  '-R',
  '--state',
  '-s',
  '--limit',
  '-L',
  '--search',
  '-S',
  '--head',
  '-H',
  '--base',
  '-B',
  '--label',
  '-l',
  '--assignee',
  '-a',
  '--author',
  '-A',
  '--milestone',
  '-m',
]);

const API_VALUED = new Set([
  '--method',
  '-X',
  '--field',
  '-F',
  '--raw-field',
  '-f',
  '--header',
  '-H',
  '--jq',
  '-q',
  '--template',
  '-t',
  '--input',
  '--hostname',
  '--cache',
  '--preview',
  '-p',
]);

export function handle(args: string[], store: Store, jq: Jq): GhResult {
  const log = (kind: string) => `${kind} gh ${args.map(quote).join(' ')}`;
  if (isWrite(args)) {
    return {
      code: 1,
      stdout: '',
      stderr: 'gh (sandbox): this is a dry run, so writes to GitHub are refused.\n',
      log: log('WRITE'),
    };
  }
  const answer = read(args, store, jq);
  if (answer === null) {
    const command = args.slice(0, 2).join(' ');
    return {
      code: 1,
      stdout: '',
      stderr: `gh (sandbox): \`gh ${command}\` is not supported here.\n`,
      log: log('UNSUPPORTED'),
    };
  }
  return { ...answer, log: log('READ') };
}

export function isWrite(args: string[]): boolean {
  const [group = '', verb = ''] = args;
  if (group === 'api') return apiWrites(parse(args.slice(1), API_VALUED));
  const reads = READS[group];
  return reads !== undefined && !reads.includes(verb);
}

function read(args: string[], store: Store, jq: Jq): Answer | null {
  const [group, verb] = args;
  const flags = () => parse(args.slice(2), VALUED);
  if (group === 'issue' && verb === 'view') return issueView(flags(), store, jq);
  if (group === 'issue' && verb === 'list') return issueList(flags(), store, jq);
  if (group === 'auth' && verb === 'status') {
    return ok(`github.com\n  ✓ Logged in to github.com account ${OWNER} (sandbox)\n`);
  }
  return null;
}

// `gh api` sends POST once fields are given, unless --method says otherwise;
// a GraphQL call reads unless its query is a mutation.
function apiWrites(p: Parsed): boolean {
  const fields = fieldPairs(p);
  if (p.positional[0] === 'graphql') return /\bmutation\b/.test(fields.get('query') ?? '');
  const method = first(p, '--method', '-X') ?? (fields.size > 0 ? 'POST' : 'GET');
  return method.toUpperCase() !== 'GET';
}

function issueView(p: Parsed, store: Store, jq: Jq): Answer {
  const ref = p.positional[0] ?? '';
  const issue = findIssue(store, ref);
  if (!issue) {
    return fail(
      `GraphQL: Could not resolve to an issue or pull request with the number of ${ref}. (repository.issue)\n`,
    );
  }
  const withComments = p.switches.has('--comments') || p.switches.has('-c');
  return output(issueJson(issue), p, jq, () => issueText(issue, withComments));
}

function issueList(p: Parsed, store: Store, jq: Jq): Answer {
  const state = (first(p, '--state', '-s') ?? 'open').toUpperCase();
  const label = first(p, '--label', '-l');
  const search = first(p, '--search', '-S');
  const limit = Number(first(p, '--limit', '-L') ?? 30);
  const issues = store.issues
    .filter((i) => state === 'ALL' || i.state === state)
    .filter((i) => label === undefined || i.labels.includes(label))
    .filter((i) => search === undefined || matches(search, `${i.title}\n${i.body}`))
    .sort((a, b) => b.number - a.number)
    .slice(0, limit);
  const text = () =>
    issues.map((i) => `${i.number}\t${i.state}\t${i.title}\t${i.labels.join(', ')}\n`).join('');
  return output(issues.map(issueJson), p, jq, text);
}

function findIssue(store: Store, ref: string): IssueFixture | undefined {
  const number = Number(ref.replace(/^.*\/issues\//, '').replace(/^#/, ''));
  return store.issues.find((i) => i.number === number);
}

function issueJson(i: IssueFixture): JsonObject {
  return {
    number: i.number,
    title: i.title,
    state: i.state,
    body: i.body,
    url: `${WEB}/issues/${i.number}`,
    closed: i.state === 'CLOSED',
    labels: i.labels.map((name) => ({ name })),
    milestone: i.milestone === null ? null : { title: i.milestone },
    comments: i.comments.map((c) => ({ author: { login: c.author }, body: c.body })),
    assignees: [{ login: OWNER }],
    author: { login: OWNER },
    projectItems: [
      { title: 'Escuadra', status: { name: i.state === 'CLOSED' ? 'Done' : 'Backlog' } },
    ],
  };
}

function issueText(i: IssueFixture, withComments: boolean): string {
  const lines = [
    `${i.title} #${i.number}`,
    `${i.state === 'OPEN' ? 'Open' : 'Closed'} • ${OWNER} opened • ${i.comments.length} comments`,
    `Labels: ${i.labels.join(', ')}`,
    `Milestone: ${i.milestone ?? ''}`,
    '',
    i.body,
    '',
  ];
  if (withComments) for (const c of i.comments) lines.push(`${c.author} • commented`, c.body, '');
  lines.push(`View this issue on GitHub: ${WEB}/issues/${i.number}`, '');
  return lines.join('\n');
}

// gh's search syntax, reduced to what triage needs: every plain word must
// appear; qualifiers such as is:open are ignored.
function matches(search: string, text: string): boolean {
  const haystack = text.toLowerCase();
  return search
    .split(/\s+/)
    .filter((word) => word !== '' && !word.includes(':'))
    .every((word) => haystack.includes(word.toLowerCase().replace(/^#/, '')));
}

function output(value: JsonObject | JsonObject[], p: Parsed, jq: Jq, text: () => string): Answer {
  const fields = first(p, '--json');
  if (fields === undefined) return ok(text());
  const names = fields
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name !== '');
  const sample = Array.isArray(value) ? value[0] : value;
  const available = Object.keys(sample ?? {}).sort();
  const unknown = sample === undefined ? [] : names.filter((name) => !(name in sample));
  if (names.length === 0 || unknown.length > 0) {
    const problem =
      unknown.length > 0
        ? `Unknown JSON field: "${unknown[0]}"`
        : 'Specify one or more comma-separated fields for `--json`:';
    return fail(`${problem}\nAvailable fields:\n  ${available.join('\n  ')}\n`);
  }
  const pick = (item: JsonObject): JsonObject =>
    Object.fromEntries(names.map((name) => [name, item[name] ?? null]));
  return send(Array.isArray(value) ? value.map(pick) : pick(value), first(p, '--jq', '-q'), jq);
}

function send(value: Json, expression: string | undefined, jq: Jq): Answer {
  const json = JSON.stringify(value, null, 2);
  if (expression === undefined) return ok(`${json}\n`);
  try {
    const out = jq(json, expression);
    return ok(out === '' || out.endsWith('\n') ? out : `${out}\n`);
  } catch (error) {
    return fail(`${error instanceof Error ? error.message : String(error)}\n`);
  }
}

function parse(args: string[], valued: Set<string>): Parsed {
  const positional: string[] = [];
  const flags = new Map<string, string[]>();
  const switches = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? '';
    const eq = arg.startsWith('-') ? arg.indexOf('=') : -1;
    const name = eq > 0 ? arg.slice(0, eq) : arg;
    if (valued.has(name)) {
      const value = eq > 0 ? arg.slice(eq + 1) : (args[++i] ?? '');
      flags.set(name, [...(flags.get(name) ?? []), value]);
    } else if (arg.startsWith('-')) {
      switches.add(name);
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags, switches };
}

function first(p: Parsed, ...names: string[]): string | undefined {
  for (const name of names) {
    const value = p.flags.get(name)?.[0];
    if (value !== undefined) return value;
  }
  return undefined;
}

function fieldPairs(p: Parsed): Map<string, string> {
  const pairs = new Map<string, string>();
  for (const name of ['--field', '-F', '--raw-field', '-f']) {
    for (const value of p.flags.get(name) ?? []) {
      const eq = value.indexOf('=');
      if (eq > 0) pairs.set(value.slice(0, eq), value.slice(eq + 1));
    }
  }
  return pairs;
}

function quote(arg: string): string {
  return /^[\w./:=@#,+-]+$/.test(arg) ? arg : JSON.stringify(arg);
}

function ok(stdout: string): Answer {
  return { code: 0, stdout, stderr: '' };
}

function fail(stderr: string): Answer {
  return { code: 1, stdout: '', stderr };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run scripts/evals/__tests__/sandbox/gh.test.ts`
Expected: PASS. `npx tsc --noEmit` reports nothing for the new files. `apiWrites`, `fieldPairs` and `send` are all used, so `noUnusedLocals` has nothing to flag.

- [ ] **Step 5: Commit**

```bash
npx prettier --write scripts/evals/sandbox/gh.ts scripts/evals/__tests__/sandbox/gh.test.ts
git add scripts/evals/sandbox/gh.ts scripts/evals/__tests__/sandbox/gh.test.ts
git commit -m "test(evals): a fake gh that serves issue fixtures and refuses writes (#136)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The fake `gh`: pull requests, the API, and its command

**Files:**

- Modify: `scripts/evals/sandbox/gh.ts` (replace `read()`, add the functions below)
- Create: `scripts/evals/sandbox/gh-cli.ts`
- Test: `scripts/evals/__tests__/sandbox/gh.test.ts` (append), `scripts/evals/__tests__/sandbox/gh-cli.test.ts`

**Interfaces:**

- Consumes: Task 1's `handle`, `Store`, `PrFixture`, `IssueFixture`, `Jq`, and the private helpers `parse`, `first`, `fieldPairs`, `output`, `send`, `matches`, `findIssue`, `ok`, `fail`, `VALUED`, `API_VALUED`, `OWNER`, `REPO`, `WEB`.
- Produces: the `gh-cli.ts` command. Its contract: it reads `$FAKE_GH_DIR` (the default is `<git rev-parse --git-common-dir>/sandbox`), which holds `issues/*.json`, `prs.json` and `gh.log`. It writes the answer to stdout and stderr, appends the log line and exits with the answer's code. Task 3 copies both files into the sandbox.

- [ ] **Step 1: Write the failing tests**

Append to `scripts/evals/__tests__/sandbox/gh.test.ts`:

```ts
const WITH_PR: Store = {
  ...STORE,
  prs: [
    {
      number: 9101,
      title: 'fix(play): progress bar reaches 10 before Results (#9008)',
      state: 'OPEN',
      headRefName: 'fix/9008-progress-bar-last-step',
      baseRefName: 'main',
      body: 'Closes #9008',
    },
  ],
  currentBranch: 'fix/9008-progress-bar-last-step',
};
const ghPr = (...args: string[]) => handle(args, WITH_PR, jq);

describe('pull requests', () => {
  it('lists open PRs, filtered by --head and --search', () => {
    expect(numbers(ghPr('pr', 'list', '--json', 'number').stdout)).toEqual([9101]);
    expect(numbers(ghPr('pr', 'list', '--head', 'fix/other', '--json', 'number').stdout)).toEqual(
      [],
    );
    expect(numbers(ghPr('pr', 'list', '--search', '9008', '--json', 'number').stdout)).toEqual([
      9101,
    ]);
  });

  it('views a PR by number, by branch, and for the current branch', () => {
    for (const ref of [['9101'], ['fix/9008-progress-bar-last-step'], []]) {
      expect(JSON.parse(ghPr('pr', 'view', ...ref, '--json', 'number').stdout)).toEqual({
        number: 9101,
      });
    }
  });

  it('fails for a branch with no PR', () => {
    expect(ghPr('pr', 'view', 'fix/none').code).toBe(1);
  });

  it('logs a read it cannot answer as unsupported', () => {
    expect(ghPr('pr', 'diff', '9101').log).toBe('UNSUPPORTED gh pr diff 9101');
  });
});

describe('api', () => {
  const sizeQuery =
    'query($n:Int!){ repository(owner:"tovmassian", name:"escuadra"){ issue(number:$n){ projectItems(first:5){ nodes { fieldValueByName(name:"Size"){ ... on ProjectV2ItemFieldSingleSelectValue { name } } } } } } }';

  it('answers a GraphQL issue query with the board Size', () => {
    const result = gh('api', 'graphql', '-f', `query=${sizeQuery}`, '-F', 'n=126');
    const body = JSON.parse(result.stdout) as {
      data: { repository: { issue: { projectItems: { nodes: { fieldValueByName: unknown }[] } } } };
    };
    expect(body.data.repository.issue.projectItems.nodes[0]?.fieldValueByName).toEqual({
      name: 'S',
    });
    expect(result.log.startsWith('READ gh api graphql')).toBe(true);
  });

  it('finds a number written into the query, and gives null for no Size', () => {
    const query =
      'query={ repository(owner:"tovmassian",name:"escuadra"){ issue(number: 9009){ title } } }';
    const body = JSON.parse(gh('api', 'graphql', '-f', query).stdout) as {
      data: {
        repository: {
          issue: { title: string; projectItems: { nodes: { fieldValueByName: unknown }[] } };
        };
      };
    };
    expect(body.data.repository.issue.title).toBe('fix(theme): toggle label');
    expect(body.data.repository.issue.projectItems.nodes[0]?.fieldValueByName).toBeNull();
  });

  it('lists milestones and reads an issue over REST', () => {
    expect(JSON.parse(gh('api', 'repos/tovmassian/escuadra/milestones').stdout)).toEqual([
      { number: 1, title: 'v2.0.0', state: 'open' },
    ]);
    const issue = JSON.parse(gh('api', 'repos/tovmassian/escuadra/issues/115').stdout) as {
      state: string;
    };
    expect(issue.state).toBe('closed');
  });

  it('treats an API path it does not serve as unsupported', () => {
    expect(gh('api', 'user').log).toBe('UNSUPPORTED gh api user');
  });
});
```

Create `scripts/evals/__tests__/sandbox/gh-cli.test.ts`:

```ts
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const CLI = fileURLToPath(new URL('../../sandbox/gh-cli.ts', import.meta.url));

function fixtureDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'fake-gh-'));
  mkdirSync(join(dir, 'issues'));
  const issue = {
    number: 9000,
    title: 'chore: sandbox smoke issue',
    state: 'OPEN',
    body: '',
    comments: [],
    labels: [],
    milestone: null,
    size: 'XS',
    source: 'synthetic',
    why: 'test',
  };
  writeFileSync(join(dir, 'issues', '9000.json'), JSON.stringify(issue));
  writeFileSync(join(dir, 'prs.json'), '[]');
  writeFileSync(join(dir, 'gh.log'), '');
  return dir;
}

const run = (dir: string, ...args: string[]) =>
  execFileSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8',
    env: { ...process.env, FAKE_GH_DIR: dir },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

describe('gh-cli', () => {
  it('answers from the fixtures, runs jq, and appends to gh.log', () => {
    const dir = fixtureDir();
    expect(run(dir, 'issue', 'view', '9000', '--json', 'title', '--jq', '.title')).toBe(
      'chore: sandbox smoke issue\n',
    );
    expect(readFileSync(join(dir, 'gh.log'), 'utf8')).toBe(
      'READ gh issue view 9000 --json title --jq .title\n',
    );
  });

  it('exits 1 on a write, and logs it', () => {
    const dir = fixtureDir();
    expect(() => run(dir, 'pr', 'create', '--title', 'x')).toThrow();
    expect(readFileSync(join(dir, 'gh.log'), 'utf8')).toBe('WRITE gh pr create --title x\n');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run scripts/evals/__tests__/sandbox/`
Expected: FAIL. The `pull requests` and `api` tests get code 1 or `UNSUPPORTED` logs, and `gh-cli.test.ts` cannot find `gh-cli.ts`.

- [ ] **Step 3: Extend `gh.ts` and write `gh-cli.ts`**

In `scripts/evals/sandbox/gh.ts`, replace `read()` with:

```ts
function read(args: string[], store: Store, jq: Jq): Answer | null {
  const [group, verb] = args;
  const flags = () => parse(args.slice(2), VALUED);
  if (group === 'issue' && verb === 'view') return issueView(flags(), store, jq);
  if (group === 'issue' && verb === 'list') return issueList(flags(), store, jq);
  if (group === 'pr' && verb === 'view') return prView(flags(), store, jq);
  if (group === 'pr' && verb === 'list') return prList(flags(), store, jq);
  if (group === 'api') return api(parse(args.slice(1), API_VALUED), store, jq);
  if (group === 'repo' && verb === 'view') {
    const repo: JsonObject = {
      name: 'escuadra',
      nameWithOwner: REPO,
      owner: { login: OWNER },
      defaultBranchRef: { name: 'main' },
      url: WEB,
    };
    return output(repo, flags(), jq, () => `name:\t${REPO}\n`);
  }
  if (group === 'auth' && verb === 'status') {
    return ok(`github.com\n  ✓ Logged in to github.com account ${OWNER} (sandbox)\n`);
  }
  return null;
}
```

and add, after `issueText`:

```ts
function prJson(pr: PrFixture): JsonObject {
  return {
    number: pr.number,
    title: pr.title,
    state: pr.state,
    headRefName: pr.headRefName,
    baseRefName: pr.baseRefName,
    body: pr.body,
    url: `${WEB}/pull/${pr.number}`,
    isDraft: false,
    author: { login: OWNER },
  };
}

function prView(p: Parsed, store: Store, jq: Jq): Answer {
  const ref = p.positional[0] ?? store.currentBranch ?? '';
  const number = Number(ref.replace(/^.*\/pull\//, '').replace(/^#/, ''));
  const byNumber = Number.isInteger(number) && number > 0;
  const pr = store.prs.find((item) =>
    byNumber ? item.number === number : item.headRefName === ref,
  );
  if (!pr) return fail(`no pull requests found for branch "${ref}"\n`);
  const text = () =>
    `${pr.title} #${pr.number}\n${pr.state} • ${pr.headRefName} → ${pr.baseRefName}\n\n${pr.body}\n\nView this pull request on GitHub: ${WEB}/pull/${pr.number}\n`;
  return output(prJson(pr), p, jq, text);
}

function prList(p: Parsed, store: Store, jq: Jq): Answer {
  const state = (first(p, '--state', '-s') ?? 'open').toUpperCase();
  const head = first(p, '--head', '-H');
  const base = first(p, '--base', '-B');
  const search = first(p, '--search', '-S');
  const limit = Number(first(p, '--limit', '-L') ?? 30);
  const prs = store.prs
    .filter((pr) => state === 'ALL' || pr.state === state)
    .filter((pr) => head === undefined || pr.headRefName === head)
    .filter((pr) => base === undefined || pr.baseRefName === base)
    .filter(
      (pr) => search === undefined || matches(search, `${pr.title}\n${pr.body}\n${pr.headRefName}`),
    )
    .sort((a, b) => b.number - a.number)
    .slice(0, limit);
  const text = () =>
    prs.map((pr) => `${pr.number}\t${pr.title}\t${pr.headRefName}\t${pr.state}\n`).join('');
  return output(prs.map(prJson), p, jq, text);
}

function api(p: Parsed, store: Store, jq: Jq): Answer | null {
  const endpoint = (p.positional[0] ?? '').replace(/^\//, '');
  const expression = first(p, '--jq', '-q');
  if (endpoint === 'graphql') {
    const fields = fieldPairs(p);
    const number = issueNumberIn(fields.get('query') ?? '', fields);
    if (number === null) return null;
    const issue = store.issues.find((i) => i.number === number);
    if (!issue) {
      return fail(
        `GraphQL: Could not resolve to an issue or pull request with the number of ${number}. (repository.issue)\n`,
      );
    }
    const node = issueNode(issue);
    return send(
      { data: { repository: { issue: node, issueOrPullRequest: node } } },
      expression,
      jq,
    );
  }
  const rest = endpoint.match(
    /^repos\/[^/]+\/[^/]+\/(milestones|issues|pulls)(?:\/(\d+))?(?:\?.*)?$/,
  );
  if (!rest) return null;
  const [, collection, id] = rest;
  if (collection === 'milestones') return send(milestones(store), expression, jq);
  if (collection === 'issues') {
    if (id === undefined) {
      return send(store.issues.filter((i) => i.state === 'OPEN').map(restIssue), expression, jq);
    }
    const issue = findIssue(store, id);
    return issue ? send(restIssue(issue), expression, jq) : fail('gh: Not Found (HTTP 404)\n');
  }
  if (id === undefined) {
    return send(store.prs.filter((pr) => pr.state === 'OPEN').map(restPr), expression, jq);
  }
  const pr = store.prs.find((item) => item.number === Number(id));
  return pr ? send(restPr(pr), expression, jq) : fail('gh: Not Found (HTTP 404)\n');
}

// An issue number from `issue(number: 126)` in the query, else from the first
// numeric field (`-F n=126`).
function issueNumberIn(query: string, fields: Map<string, string>): number | null {
  const inline = query.match(/\bnumber\s*:\s*(\d+)/);
  if (inline?.[1] !== undefined) return Number(inline[1]);
  for (const value of fields.values()) if (/^\d+$/.test(value)) return Number(value);
  return null;
}

// A superset of what an agent's GraphQL query might select, so whatever shape
// it asks for resolves; Size sits where the Projects v2 API puts it.
function issueNode(i: IssueFixture): JsonObject {
  const fieldValues: Json[] = [
    { name: i.state === 'CLOSED' ? 'Done' : 'Backlog', field: { name: 'Status' } },
  ];
  if (i.size !== null) fieldValues.push({ name: i.size, field: { name: 'Size' } });
  return {
    number: i.number,
    title: i.title,
    state: i.state,
    body: i.body,
    url: `${WEB}/issues/${i.number}`,
    closed: i.state === 'CLOSED',
    milestone: i.milestone === null ? null : { title: i.milestone },
    labels: { nodes: i.labels.map((name) => ({ name })) },
    assignees: { nodes: [{ login: OWNER }] },
    comments: {
      totalCount: i.comments.length,
      nodes: i.comments.map((c) => ({ author: { login: c.author }, body: c.body })),
    },
    projectItems: {
      nodes: [
        {
          project: { title: 'Escuadra', number: 1 },
          fieldValueByName: i.size === null ? null : { name: i.size },
          fieldValues: { nodes: fieldValues },
        },
      ],
    },
  };
}

function milestones(store: Store): JsonObject[] {
  const titles = [
    ...new Set(store.issues.map((i) => i.milestone).filter((t): t is string => t !== null)),
  ];
  return titles.map((title, index) => ({ number: index + 1, title, state: 'open' }));
}

function restIssue(i: IssueFixture): JsonObject {
  return {
    number: i.number,
    title: i.title,
    state: i.state.toLowerCase(),
    body: i.body,
    html_url: `${WEB}/issues/${i.number}`,
    labels: i.labels.map((name) => ({ name })),
    milestone: i.milestone === null ? null : { title: i.milestone },
    comments: i.comments.length,
  };
}

function restPr(pr: PrFixture): JsonObject {
  return {
    number: pr.number,
    title: pr.title,
    state: pr.state === 'OPEN' ? 'open' : 'closed',
    merged: pr.state === 'MERGED',
    body: pr.body,
    html_url: `${WEB}/pull/${pr.number}`,
    head: { ref: pr.headRefName },
    base: { ref: pr.baseRefName },
  };
}
```

Create `scripts/evals/sandbox/gh-cli.ts`:

```ts
// The `gh` command inside an eval sandbox (spec §5.1): loads the case's fixtures
// from <git common dir>/sandbox (or $FAKE_GH_DIR), answers through gh.ts, and
// appends the call to gh.log. Node built-ins only: it is copied into the sandbox.
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { handle, type IssueFixture, type PrFixture } from './gh.ts';

function git(args: string[]): string | null {
  try {
    const out = execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.trim();
  } catch {
    return null;
  }
}

function jq(input: string, expression: string): string {
  const result = spawnSync('jq', ['-r', expression], { input, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr.trim() || `jq failed on ${expression}`);
  return result.stdout;
}

const dir =
  process.env.FAKE_GH_DIR ?? join(git(['rev-parse', '--git-common-dir']) ?? '.git', 'sandbox');
const issues = readdirSync(join(dir, 'issues'))
  .filter((file) => file.endsWith('.json'))
  .map((file) => JSON.parse(readFileSync(join(dir, 'issues', file), 'utf8')) as IssueFixture);
const prs = JSON.parse(readFileSync(join(dir, 'prs.json'), 'utf8')) as PrFixture[];

const result = handle(
  process.argv.slice(2),
  { issues, prs, currentBranch: git(['branch', '--show-current']) },
  jq,
);
appendFileSync(join(dir, 'gh.log'), `${result.log}\n`);
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
process.exitCode = result.code;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run scripts/evals/__tests__/sandbox/`
Expected: PASS. Node may print a `MODULE_TYPELESS_PACKAGE_JSON` warning to stderr when it runs `gh-cli.ts` in the repo; the stdout assertions are unaffected. In the sandbox, Task 3's `package.json` silences it.

- [ ] **Step 5: Commit**

```bash
npx prettier --write scripts/evals/sandbox scripts/evals/__tests__/sandbox
git add scripts/evals/sandbox scripts/evals/__tests__/sandbox
git commit -m "test(evals): the fake gh answers PRs and the API, and logs every call (#136)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The sandbox builder and the scaffold

**Files:**

- Create: `scripts/evals/lib/sandbox.ts`, `scripts/evals/scaffold.ts`
- Test: `scripts/evals/__tests__/lib/sandbox.test.ts`

**Interfaces:**

- Consumes: `PrFixture` from `scripts/evals/sandbox/gh.ts`; the files `scripts/evals/sandbox/gh.ts` and `gh-cli.ts`.
- Produces:
  - `buildSandbox(options: BuildOptions): void`;
  - `realGitBinary(): string`;
  - the types `SandboxSetup`, `SyntheticCommit`, `SyntheticFile`, `BuildOptions`;
  - the command `node scripts/evals/scaffold.ts <case dir>`, which reads `<case dir>/setup.json` and the fixtures in `<case dir>/../_fixtures`.

  Task 5 generates `setup.json` from `SandboxSetup`.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/evals/__tests__/lib/sandbox.test.ts
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildSandbox, realGitBinary, type SandboxSetup } from '../../lib/sandbox.ts';

const GH_DIR = fileURLToPath(new URL('../../sandbox/', import.meta.url));

function git(cwd: string, ...args: string[]): string {
  const identity = ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid'];
  return execFileSync('git', [...identity, '-c', 'commit.gpgsign=false', ...args], {
    cwd,
    encoding: 'utf8',
  }).trim();
}

const temp = (prefix: string) => mkdtempSync(join(tmpdir(), prefix));

// A throwaway source repo: CI checks out one commit, so the real pins are not there.
function sourceRepo() {
  const dir = temp('sandbox-source-');
  git(dir, 'init', '--quiet', '--initial-branch', 'main');
  writeFileSync(join(dir, 'README.md'), '# Source\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '--quiet', '-m', 'first');
  const first = git(dir, 'rev-parse', 'HEAD');
  git(dir, 'branch', 'release/1.0.0');
  git(dir, 'branch', 'feat/unpinned');
  mkdirSync(join(dir, 'lib'));
  writeFileSync(join(dir, 'lib', 'x.ts'), 'export const x = 1;\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '--quiet', '-m', 'second');
  return { dir, first, second: git(dir, 'rev-parse', 'HEAD') };
}

function fixtures(): string {
  const dir = temp('sandbox-fixtures-');
  mkdirSync(join(dir, 'issues'));
  mkdirSync(join(dir, 'docs'));
  const issue = {
    number: 9001,
    title: 'fix: a synthetic bug',
    state: 'OPEN',
    body: 'Body.',
    comments: [],
    labels: ['bug'],
    milestone: null,
    size: 'XS',
    source: 'synthetic',
    why: 'test',
  };
  writeFileSync(join(dir, 'issues', '9001.json'), JSON.stringify(issue));
  writeFileSync(join(dir, 'docs', 'spec.md'), '# A synthetic spec\n');
  return dir;
}

describe('buildSandbox', () => {
  const source = sourceRepo();
  const work = temp('sandbox-work-');
  const box = join(work, '.git', 'sandbox');
  let origin = '';

  beforeAll(() => {
    const tmp = temp('sandbox-tmp-');
    origin = join(tmp, 'origin.git');
    const setup: SandboxSetup = {
      pins: { main: source.second, 'release/1.0.0': source.first },
      issues: ['issues/9001.json'],
      prs: [
        {
          number: 9101,
          title: 'fix: x (#9008)',
          state: 'OPEN',
          headRefName: 'fix/9008-x',
          baseRefName: 'main',
          body: 'Closes #9008',
        },
      ],
      commits: [
        {
          message: 'docs(spec): a synthetic spec (#9007)',
          files: [{ path: 'docs/spec.md', fixture: 'docs/spec.md' }],
        },
      ],
      branches: [
        {
          name: 'fix/9008-x',
          from: 'main',
          commits: [
            {
              message: 'fix: x (#9008)',
              files: [{ path: 'lib/x.ts', content: 'export const x = 2;\n' }],
            },
          ],
        },
      ],
      checkout: { branch: 'feat/9050-other', from: 'main' },
      dirty: ['README.md'],
    };
    buildSandbox({
      sourceRepo: source.dir,
      workDir: work,
      tmpDir: tmp,
      fixturesDir: fixtures(),
      ghDir: GH_DIR,
      realGit: realGitBinary(),
      setup,
    });
  });

  it('keeps only the pinned branches, and the pushed ones, on origin', () => {
    const heads = git(origin, 'for-each-ref', '--format=%(refname:short)', 'refs/heads');
    expect(heads.split('\n').sort()).toEqual(['fix/9008-x', 'main', 'release/1.0.0']);
    expect(git(origin, 'rev-parse', 'release/1.0.0')).toBe(source.first);
  });

  it('commits the synthetic history on main and pushes it', () => {
    expect(git(work, 'log', 'origin/main', '--format=%s').split('\n')).toEqual([
      'docs(spec): a synthetic spec (#9007)',
      'second',
      'first',
    ]);
  });

  it('leaves the requested branch checked out and the tree dirty', () => {
    expect(git(work, 'branch', '--show-current')).toBe('feat/9050-other');
    expect(git(work, 'status', '--porcelain')).toBe('M README.md');
  });

  it('puts the fixtures and an empty gh.log in .git/sandbox', () => {
    expect(existsSync(join(box, 'issues', '9001.json'))).toBe(true);
    expect(readFileSync(join(box, 'gh.log'), 'utf8')).toBe('');
    expect(JSON.parse(readFileSync(join(box, 'prs.json'), 'utf8'))).toHaveLength(1);
  });

  it('installs a gh wrapper that answers from those fixtures', () => {
    const title = execFileSync(
      join(box, 'bin', 'gh'),
      ['issue', 'view', '9001', '--json', 'title', '--jq', '.title'],
      { cwd: work, encoding: 'utf8' },
    );
    expect(title).toBe('fix: a synthetic bug\n');
    expect(readFileSync(join(box, 'gh.log'), 'utf8')).toContain('READ gh issue view 9001');
  });

  it('installs a git wrapper that reaches origin through the real helpers', () => {
    const wrapper = join(box, 'bin', 'git');
    const heads = execFileSync(wrapper, ['ls-remote', '--heads', 'origin'], {
      cwd: work,
      encoding: 'utf8',
    });
    expect(heads).toContain('refs/heads/fix/9008-x');
  });
});
```

Note that `git status --porcelain` prints ` M README.md` with a leading space, and the helper's `.trim()` drops it.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run scripts/evals/__tests__/lib/sandbox.test.ts`
Expected: FAIL, because `../../lib/sandbox.ts` cannot be found.

- [ ] **Step 3: Write `lib/sandbox.ts` and `scaffold.ts`**

```ts
// scripts/evals/lib/sandbox.ts
// Builds a run's sandbox (spec §5): a bare origin holding only the pinned
// branches, the agent's clone of it, the case's synthetic history and state,
// and the fake gh with its fixtures under .git/sandbox/. It runs unsandboxed,
// as the owner, from the case's scaffold.
import { execFileSync } from 'node:child_process';
import {
  appendFileSync,
  chmodSync,
  copyFileSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';
import type { PrFixture } from '../sandbox/gh.ts';

/** A file a synthetic commit writes: inline `content`, or a `fixture` under _fixtures/. */
export interface SyntheticFile {
  path: string;
  content?: string;
  fixture?: string;
}

export interface SyntheticCommit {
  message: string;
  files: SyntheticFile[];
}

export interface SandboxSetup {
  /** Branch → commit, for every branch origin keeps. */
  pins: Record<string, string>;
  /** Issue fixtures, relative to _fixtures/ (`issues/126.json`). */
  issues: string[];
  prs: PrFixture[];
  /** Commits made on main, then pushed, before anything else. */
  commits: SyntheticCommit[];
  /** Branches pushed to origin with their own commits, and not kept locally. */
  branches: { name: string; from: string; commits: SyntheticCommit[] }[];
  /** The branch checked out when the agent starts; `from` creates it. */
  checkout: { branch: string; from?: string };
  /** Tracked files left with an uncommitted edit. */
  dirty: string[];
}

export interface BuildOptions {
  sourceRepo: string;
  /** The agent's working directory, still empty. */
  workDir: string;
  /** Where origin.git goes. */
  tmpDir: string;
  /** The suite's _fixtures/. */
  fixturesDir: string;
  /** scripts/evals/sandbox/, holding gh.ts and gh-cli.ts. */
  ghDir: string;
  /** The git binary the wrappers run (see realGitBinary). */
  realGit: string;
  setup: SandboxSetup;
}

const IDENTITY = [
  '-c',
  'user.name=Escuadra Sandbox',
  '-c',
  'user.email=sandbox@escuadra.invalid',
  '-c',
  'commit.gpgsign=false',
];
// Fixed dates give a case's synthetic commits the same hashes on every run.
const DATES = {
  GIT_AUTHOR_DATE: '2026-10-16T12:00:00Z',
  GIT_COMMITTER_DATE: '2026-10-16T12:00:00Z',
};

function git(cwd: string, args: string[]): string {
  return execFileSync('git', [...IDENTITY, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...DATES },
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

/**
 * The git binary itself, not a shim: on macOS /usr/bin/git is xcrun's, which
 * fails inside the agent's sandbox (spec §11).
 */
export function realGitBinary(): string {
  const execPath = execFileSync('git', ['--exec-path'], { encoding: 'utf8' }).trim();
  return realpathSync(join(execPath, 'git'));
}

export function buildSandbox(o: BuildOptions): void {
  const origin = join(o.tmpDir, 'origin.git');
  git(o.tmpDir, ['clone', '--quiet', '--bare', '--no-tags', o.sourceRepo, origin]);
  git(origin, ['remote', 'remove', 'origin']);
  const heads = git(origin, ['for-each-ref', '--format=%(refname)', 'refs/heads']);
  for (const ref of heads.split('\n').filter(Boolean)) git(origin, ['update-ref', '-d', ref]);
  for (const [branch, sha] of Object.entries(o.setup.pins)) {
    git(origin, ['update-ref', `refs/heads/${branch}`, sha]);
  }
  git(origin, ['symbolic-ref', 'HEAD', 'refs/heads/main']);

  git(o.workDir, ['clone', '--quiet', origin, '.']);
  const helpers = dirname(o.realGit);
  git(o.workDir, ['config', 'remote.origin.uploadpack', join(helpers, 'git-upload-pack')]);
  git(o.workDir, ['config', 'remote.origin.receivepack', join(helpers, 'git-receive-pack')]);

  for (const commit of o.setup.commits) commitFiles(o, commit);
  if (o.setup.commits.length > 0) git(o.workDir, ['push', '--quiet', 'origin', 'main']);
  for (const branch of o.setup.branches) {
    git(o.workDir, ['switch', '--quiet', '-c', branch.name, branch.from]);
    for (const commit of branch.commits) commitFiles(o, commit);
    git(o.workDir, ['push', '--quiet', '-u', 'origin', branch.name]);
    git(o.workDir, ['switch', '--quiet', 'main']);
    git(o.workDir, ['branch', '--quiet', '-D', branch.name]);
  }

  const { branch, from } = o.setup.checkout;
  if (from !== undefined) git(o.workDir, ['switch', '--quiet', '-c', branch, from]);
  else if (branch !== 'main') git(o.workDir, ['switch', '--quiet', branch]);
  for (const path of o.setup.dirty) {
    appendFileSync(join(o.workDir, path), '\nsandbox: an uncommitted edit\n');
  }

  const box = join(o.workDir, '.git', 'sandbox');
  mkdirSync(join(box, 'issues'), { recursive: true });
  mkdirSync(join(box, 'bin'), { recursive: true });
  for (const issue of o.setup.issues) {
    copyFileSync(join(o.fixturesDir, issue), join(box, 'issues', basename(issue)));
  }
  writeFileSync(join(box, 'prs.json'), `${JSON.stringify(o.setup.prs, null, 2)}\n`);
  writeFileSync(join(box, 'gh.log'), '');
  for (const file of ['gh.ts', 'gh-cli.ts'])
    copyFileSync(join(o.ghDir, file), join(box, 'bin', file));
  writeFileSync(join(box, 'bin', 'package.json'), '{ "type": "module" }\n');
  script(join(box, 'bin', 'gh'), 'exec node "$(dirname "$0")/gh-cli.ts" "$@"');
  script(join(box, 'bin', 'git'), `PATH="${helpers}:$PATH" exec "${o.realGit}" "$@"`);
}

function commitFiles(o: BuildOptions, commit: SyntheticCommit): void {
  for (const file of commit.files) {
    const target = join(o.workDir, file.path);
    mkdirSync(dirname(target), { recursive: true });
    const content =
      file.fixture === undefined
        ? (file.content ?? '')
        : readFileSync(join(o.fixturesDir, file.fixture), 'utf8');
    writeFileSync(target, content);
  }
  git(o.workDir, ['add', '--', ...commit.files.map((file) => file.path)]);
  git(o.workDir, ['commit', '--quiet', '-m', commit.message]);
}

function script(path: string, body: string): void {
  writeFileSync(path, `#!/bin/sh\n${body}\n`);
  chmodSync(path, 0o755);
}
```

```ts
// scripts/evals/scaffold.ts
// A case's scaffold (spec §5). Each generated <case>/scaffold.sh runs
// `node scripts/evals/scaffold.ts <case dir>` in the run's working directory,
// and this builds the sandbox there from the case's setup.json. Errors go to
// stderr, which the eval runner shows as "scaffold failed".
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSandbox, realGitBinary, type SandboxSetup } from './lib/sandbox.ts';

const here = dirname(fileURLToPath(import.meta.url));
const caseDir = process.argv[2];
const tmpDir = process.env.TMPDIR;
if (caseDir === undefined) throw new Error('usage: node scripts/evals/scaffold.ts <case dir>');
if (tmpDir === undefined) throw new Error('scaffold: TMPDIR is not set');

buildSandbox({
  sourceRepo: resolve(here, '../..'),
  workDir: process.cwd(),
  tmpDir,
  fixturesDir: join(caseDir, '..', '_fixtures'),
  ghDir: join(here, 'sandbox'),
  realGit: realGitBinary(),
  setup: JSON.parse(readFileSync(join(caseDir, 'setup.json'), 'utf8')) as SandboxSetup,
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run scripts/evals/__tests__/lib/sandbox.test.ts`
Expected: PASS (6 tests). This needs `git` ≥ 2.28 (for `--initial-branch`) and `jq` on `PATH`. GitHub's Ubuntu runners have both.

- [ ] **Step 5: Commit**

```bash
npx prettier --write scripts/evals/lib/sandbox.ts scripts/evals/scaffold.ts scripts/evals/__tests__/lib/sandbox.test.ts
git add scripts/evals/lib/sandbox.ts scripts/evals/scaffold.ts scripts/evals/__tests__/lib/sandbox.test.ts
git commit -m "test(evals): build a run's sandbox from a case's setup (#136)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The triage format, the YAML writer and the graders

**Files:**

- Create: `scripts/evals/lib/triage.ts`, `scripts/evals/lib/yaml.ts`, `scripts/evals/lib/graders.ts`
- Test: `scripts/evals/__tests__/lib/yaml.test.ts`, `scripts/evals/__tests__/lib/graders.test.ts`

**Interfaces:**

- Produces:
  - `TRIAGE_TEMPLATE: string`, `escapeRegExp(text)`, `fieldPattern(field, value)` (from `triage.ts`);
  - `toYaml(value: YamlValue): string` and the types `YamlValue`, `YamlMap` (from `yaml.ts`);
  - `gradersFor(expect: Expectation): YamlMap[]`, `GH_LOG`, and the types `Triage`, `NoTriage`, `Smoke`, `Expectation` (from `graders.ts`).

  Task 5 uses all of them; PR 2's `SKILL.md` copies `TRIAGE_TEMPLATE`.

- [ ] **Step 1: Write the failing tests**

```ts
// scripts/evals/__tests__/lib/yaml.test.ts
import * as prettier from 'prettier';
import { describe, expect, it } from 'vitest';
import { toYaml } from '../../lib/yaml.ts';

describe('toYaml', () => {
  it('writes maps and lists in block style', () => {
    const yaml = toYaml({
      name: 'x',
      tags: ['a', 'b'],
      context: { scaffold_script: 'scaffold.sh' },
      graders: [{ type: 'regex', weight: 3 }],
      env: {},
      empty: [],
      on: true,
    });
    expect(yaml).toBe(
      [
        'name: "x"',
        'tags:',
        '  - "a"',
        '  - "b"',
        'context:',
        '  scaffold_script: "scaffold.sh"',
        'graders:',
        '  - type: "regex"',
        '    weight: 3',
        'env: {}',
        'empty: []',
        'on: true',
        '',
      ].join('\n'),
    );
  });

  it('quotes every string as JSON does, which YAML reads the same way', () => {
    expect(toYaml({ s: 'a: "b"\n- c #d' })).toBe('s: "a: \\"b\\"\\n- c #d"\n');
  });

  it('writes YAML that Prettier parses', async () => {
    const yaml = toYaml({ execution: { prompt: 'Pick up #126.\nThen stop.', max_turns: 40 } });
    await expect(prettier.format(yaml, { parser: 'yaml' })).resolves.toContain('max_turns: 40');
  });

  it('refuses a key that is not a plain name', () => {
    expect(() => toYaml({ 'a b': 1 })).toThrow(/plain name/);
  });
});
```

````ts
// scripts/evals/__tests__/lib/graders.test.ts
import { describe, expect, it } from 'vitest';
import { gradersFor, type Triage } from '../../lib/graders.ts';
import { fieldPattern, TRIAGE_TEMPLATE } from '../../lib/triage.ts';
import type { YamlMap } from '../../lib/yaml.ts';

const BLOCK = [
  'I read the issue and the handoff.',
  '```triage',
  'issue: 126',
  'size: S (board; body says M)',
  'docs: docs/superpowers/handoff/2026-10-16-2-0-redesign-handoff.md',
  'existing: none',
  'decision: proceed',
  'questions: none',
  'execution: n/a',
  'workspace: in-place',
  'base: main',
  'branch: fix/126-photo-credits-sheet',
  'first-step: superpowers:systematic-debugging',
  '```',
].join('\n');

const regexes = (graders: YamlMap[]) =>
  graders.filter((g) => g.type === 'regex' && g.target === undefined);
const passes = (grader: YamlMap, text: string) =>
  new RegExp(String(grader.pattern), String(grader.flags ?? '')).test(text);

const proceed: Triage = {
  kind: 'triage',
  decision: 'proceed',
  workspace: 'in-place',
  base: 'main',
  branch: { prefix: 'fix/126-' },
  firstStep: 'systematic-debugging',
  execution: 'n/a',
  docs: ['docs/superpowers/handoff/2026-10-16-2-0-redesign-handoff.md'],
};

describe('gradersFor a triage', () => {
  it('passes a block that meets every expectation', () => {
    for (const grader of regexes(gradersFor(proceed))) {
      expect(passes(grader, BLOCK), String(grader.name)).toBe(true);
    }
  });

  it('fails each field that decided differently', () => {
    const other: Triage = {
      kind: 'triage',
      decision: 'ask',
      workspace: 'worktree',
      base: 'release/1.0.0',
      branch: { prefix: 'feat/126-' },
      firstStep: 'brainstorming',
      execution: 'ask',
      docs: ['docs/superpowers/plans/2026-10-16-2-0-study.md'],
    };
    for (const grader of regexes(gradersFor(other))) {
      expect(passes(grader, BLOCK), String(grader.name)).toBe(false);
    }
  });

  it('accepts an exact branch name and a skill named without its prefix', () => {
    const exact: Triage = {
      kind: 'triage',
      decision: 'proceed',
      branch: { exact: 'fix/126-photo-credits-sheet' },
      firstStep: 'systematic-debugging',
    };
    const block = BLOCK.replace('superpowers:systematic-debugging', 'systematic-debugging');
    for (const grader of regexes(gradersFor(exact))) expect(passes(grader, block)).toBe(true);
  });

  it('weighs the decision and writing above the slug', () => {
    const graders = gradersFor(proceed);
    const weight = (name: string) => graders.find((g) => g.name === name)?.weight;
    expect(weight('decision')).toBe(3);
    expect(weight('no-writes')).toBe(3);
    expect(weight('branch')).toBe(1);
  });

  it('checks gh.log for writes, and judges questions with an LLM', () => {
    const graders = gradersFor({ kind: 'triage', decision: 'ask', questions: 'it asks X.' });
    expect(graders.find((g) => g.name === 'no-writes')).toMatchObject({
      target: { source: 'file', path: '.git/sandbox/gh.log' },
      match: 'not_contains',
    });
    expect(graders.find((g) => g.name === 'questions')).toMatchObject({ type: 'llm', weight: 2 });
  });
});

describe('gradersFor a negative case', () => {
  it('expects no triage block and an answer', () => {
    const names = gradersFor({ kind: 'no-triage', answered: 'It answers.' }).map((g) => g.name);
    expect(names).toEqual(['no-triage', 'answered', 'no-writes']);
  });
});

describe('fieldPattern', () => {
  it('does not take a longer value for the one expected', () => {
    expect(new RegExp(fieldPattern('base', 'main'), 'm').test('base: main-next')).toBe(false);
    expect(new RegExp(fieldPattern('base', 'release/1.0'), 'm').test('base: release/1.0.0')).toBe(
      false,
    );
  });

  it('matches the template it is written against', () => {
    expect(TRIAGE_TEMPLATE).toMatch(/^```triage\n/);
    expect(TRIAGE_TEMPLATE).toMatch(/\n```$/);
  });
});
````

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run scripts/evals/__tests__/lib/yaml.test.ts scripts/evals/__tests__/lib/graders.test.ts`
Expected: FAIL, because the modules cannot be found.

- [ ] **Step 3: Write the three modules**

````ts
// scripts/evals/lib/triage.ts
// The triage block (spec §2.6): the template a dry run ends with, and the regex
// helpers its graders are built from. The skill's SKILL.md copies the template.

export const TRIAGE_TEMPLATE = [
  '```triage',
  'issue: <number>',
  'size: <XS|S|M|L|XL> (<board|estimated>; <a disagreement, if any>)',
  'docs: <paths, comma-separated, or none>',
  'existing: <open PR, branch or commits for the issue, or none>',
  'decision: <proceed|ask>',
  'questions: <none, or one per line below, each starting with "- ">',
  'execution: <subagent-driven|executing-plans|ask|n/a>',
  'workspace: <in-place|worktree|n/a>',
  'base: <main|release/X.Y.Z|n/a>',
  'branch: <type>/<number>-<slug>, or n/a',
  'first-step: <superpowers:skill-name, or n/a>',
  '```',
].join('\n');

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

/** `<field>: <value>` at a line start (flag m), where the value is not the start of a longer one. */
export function fieldPattern(field: string, value: string): string {
  return `^${escapeRegExp(field)}:\\s*${escapeRegExp(value)}(?![\\w/.-])`;
}
````

```ts
// scripts/evals/lib/yaml.ts
// A YAML writer for the few shapes a case.yaml holds: maps, lists, strings,
// numbers and booleans. Strings are always double-quoted the way JSON writes
// them, which YAML reads the same way; keys are plain names, written bare.
// The generator then formats the result with Prettier.

export type YamlValue = string | number | boolean | YamlValue[] | YamlMap;
export interface YamlMap {
  [key: string]: YamlValue;
}

const PLAIN_KEY = /^[A-Za-z_][\w-]*$/;

export function toYaml(value: YamlValue): string {
  return `${render(value, 0).join('\n')}\n`;
}

function isScalar(value: YamlValue): value is string | number | boolean {
  return typeof value !== 'object';
}

function scalar(value: string | number | boolean): string {
  return typeof value === 'string' ? JSON.stringify(value) : String(value);
}

function render(value: YamlValue, indent: number): string[] {
  const pad = ' '.repeat(indent);
  if (isScalar(value)) return [pad + scalar(value)];
  if (Array.isArray(value)) {
    if (value.length === 0) return [`${pad}[]`];
    return value.flatMap((item) => {
      if (isScalar(item)) return [`${pad}- ${scalar(item)}`];
      const [head = '', ...rest] = render(item, indent + 2);
      return [`${pad}- ${head.trimStart()}`, ...rest];
    });
  }
  const entries = Object.entries(value);
  if (entries.length === 0) return [`${pad}{}`];
  return entries.flatMap(([key, item]) => {
    if (!PLAIN_KEY.test(key)) throw new Error(`toYaml: key "${key}" is not a plain name`);
    if (isScalar(item)) return [`${pad}${key}: ${scalar(item)}`];
    if (Array.isArray(item) && item.length === 0) return [`${pad}${key}: []`];
    if (!Array.isArray(item) && Object.keys(item).length === 0) return [`${pad}${key}: {}`];
    return [`${pad}${key}:`, ...render(item, indent + 2)];
  });
}
```

```ts
// scripts/evals/lib/graders.ts
// The graders for a case's expectation (spec §8): a regex per triage field the
// case pins down, an LLM judge for questions and answers, and the write check
// every case carries.
import { escapeRegExp, fieldPattern } from './triage.ts';
import type { YamlMap } from './yaml.ts';

export interface Triage {
  kind: 'triage';
  decision: 'proceed' | 'ask';
  workspace?: 'in-place' | 'worktree';
  base?: string;
  branch?: { prefix: string } | { exact: string };
  /** A superpowers skill name, without the `superpowers:` prefix. */
  firstStep?: string;
  execution?: 'subagent-driven' | 'executing-plans' | 'ask' | 'n/a';
  /** Docs the `docs:` line must name; matched on the file name. */
  docs?: string[];
  sizeEstimated?: boolean;
  /** The `existing:` line must contain one of these. */
  existing?: string[];
  /** What the questions must cover, as claims the judge can check. */
  questions?: string;
}

export interface NoTriage {
  kind: 'no-triage';
  /** What a right answer does, for the judge. */
  answered: string;
}

/** A case that checks the sandbox itself, with graders written out. */
export interface Smoke {
  kind: 'smoke';
  graders: YamlMap[];
}

export type Expectation = Triage | NoTriage | Smoke;

export const GH_LOG = '.git/sandbox/gh.log';

const NO_WRITES: YamlMap = {
  type: 'regex',
  name: 'no-writes',
  target: { source: 'file', path: GH_LOG },
  pattern: '^WRITE ',
  flags: 'm',
  match: 'not_contains',
  weight: 3,
};

function line(name: string, pattern: string, weight: number): YamlMap {
  return { type: 'regex', name, pattern, flags: 'm', weight };
}

export function gradersFor(expect: Expectation): YamlMap[] {
  if (expect.kind === 'smoke') return expect.graders;
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
      NO_WRITES,
    ];
  }
  return [...triageGraders(expect), NO_WRITES];
}

function triageGraders(t: Triage): YamlMap[] {
  const graders = [line('decision', fieldPattern('decision', t.decision), 3)];
  if (t.workspace) graders.push(line('workspace', fieldPattern('workspace', t.workspace), 2));
  if (t.base) graders.push(line('base', fieldPattern('base', t.base), 2));
  if (t.branch) {
    const pattern =
      'exact' in t.branch
        ? fieldPattern('branch', t.branch.exact)
        : `^branch:\\s*${escapeRegExp(t.branch.prefix)}[\\w.-]+`;
    graders.push(line('branch', pattern, 1));
  }
  if (t.firstStep) {
    const skill = escapeRegExp(t.firstStep);
    graders.push(line('first-step', `^first-step:\\s*(?:superpowers:)?${skill}(?![\\w-])`, 1));
  }
  if (t.execution) graders.push(line('execution', fieldPattern('execution', t.execution), 1));
  if (t.sizeEstimated) graders.push(line('size', '^size:.*\\(estimated', 1));
  if (t.docs !== undefined && t.docs.length > 0) {
    const names = t.docs.map((doc) => escapeRegExp(doc.split('/').pop() ?? doc));
    const pattern = `^${names.map((name) => `(?=[\\s\\S]*${name})`).join('')}`;
    graders.push({ type: 'regex', name: 'docs', pattern, weight: 1 });
  }
  if (t.existing !== undefined && t.existing.length > 0) {
    const options = t.existing.map(escapeRegExp).join('|');
    graders.push(line('existing', `^existing:.*(?:${options})`, 1));
  }
  if (t.questions) {
    const criteria = `The final message ends with a triage block whose decision is "ask". Among its questions for the owner, ${t.questions}`;
    graders.push({ type: 'llm', name: 'questions', criteria, weight: 2 });
  }
  return graders;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run scripts/evals/__tests__/lib/yaml.test.ts scripts/evals/__tests__/lib/graders.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npx prettier --write scripts/evals/lib/triage.ts scripts/evals/lib/yaml.ts scripts/evals/lib/graders.ts scripts/evals/__tests__/lib/yaml.test.ts scripts/evals/__tests__/lib/graders.test.ts
git add scripts/evals/lib/triage.ts scripts/evals/lib/yaml.ts scripts/evals/lib/graders.ts scripts/evals/__tests__/lib/yaml.test.ts scripts/evals/__tests__/lib/graders.test.ts
git commit -m "test(evals): the triage format, a YAML writer and the graders (#136)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Cases, the generator and the suite skeleton

**Files:**

- Create: `scripts/evals/lib/cases.ts`, `scripts/evals/lib/format.ts`, `scripts/evals/lib/suite.ts`, `scripts/evals/gen-cases.ts`
- Create: `.claude/skills/escuadra-issue-runner/SKILL.md`, `.claude/skills/escuadra-issue-runner/evals/cases.ts`, `.claude/skills/escuadra-issue-runner/evals/dry-run.md`, `.claude/skills/escuadra-issue-runner/evals/_fixtures/issues/9000.json`
- Generated: `.claude/skills/escuadra-issue-runner/evals/sandbox-smoke/{case.yaml,scaffold.sh,setup.json}`
- Test: `scripts/evals/__tests__/lib/cases.test.ts`, `scripts/evals/__tests__/suites.test.ts`

**Interfaces:**

- Consumes: Task 3's `SandboxSetup`, `SyntheticCommit`; Task 4's `gradersFor`, `Expectation`, `TRIAGE_TEMPLATE`, `toYaml`, `YamlMap`; Task 1's `PrFixture`.
- Produces:
  - from `cases.ts`: the types `EvalCase`, `Suite`, `GeneratedFile`, the constant `GENERATED`, and `setupFor(suite, item)`, `caseYaml(suite, item, dryRun)`, `caseFiles(suite, item, dryRun, scaffoldEntry)`;
  - `formatFor(path, content): Promise<string>`;
  - `renderSuite(evalsDir): Promise<GeneratedFile[]>` and `staleCaseDirs(evalsDir, files): string[]`;
  - the command `node scripts/evals/gen-cases.ts [evals dir]`.

  Task 9 adds the 19 cases to the suite's `cases.ts`.

- [ ] **Step 1: Write the failing tests**

```ts
// scripts/evals/__tests__/lib/cases.test.ts
import { describe, expect, it } from 'vitest';
import { caseFiles, caseYaml, setupFor, type EvalCase, type Suite } from '../../lib/cases.ts';
import { TRIAGE_TEMPLATE } from '../../lib/triage.ts';

const SUITE: Suite = {
  pins: { main: 'a'.repeat(40) },
  allowedTools: ['Read', 'Bash(gh:*)'],
  runs: 3,
  maxTurns: 40,
  timeoutSeconds: 900,
  cases: [],
};

const TRIAGE_CASE: EvalCase = {
  name: '126-small-bug',
  why: 'An S bug, in place.',
  tags: ['core'],
  prompt: 'Pick up #126.',
  issues: [126],
  expect: { kind: 'triage', decision: 'proceed', workspace: 'in-place' },
};

describe('caseYaml', () => {
  it('gives a triage case the dry run and the template, with the suite defaults', () => {
    const yaml = caseYaml(SUITE, TRIAGE_CASE, 'This is a dry run.\n');
    expect(yaml).toMatchObject({
      schema_version: '1.0',
      name: '126-small-bug',
      description: 'An S bug, in place.',
      context: { scaffold_script: 'scaffold.sh' },
      runs: 3,
      execution: {
        prompt: 'Pick up #126.',
        max_turns: 40,
        timeout_seconds: 900,
        allowed_tools: ['Read', 'Bash(gh:*)'],
        append_system_prompt: `This is a dry run.\n\n${TRIAGE_TEMPLATE}\n`,
      },
    });
  });

  it('leaves the dry run out of a smoke case, and keeps its own budget', () => {
    const smoke: EvalCase = {
      ...TRIAGE_CASE,
      name: 'sandbox-smoke',
      runs: 1,
      maxTurns: 12,
      expect: { kind: 'smoke', graders: [{ type: 'regex', name: 'x', pattern: 'x' }] },
    };
    const yaml = caseYaml(SUITE, smoke, 'This is a dry run.\n');
    expect(yaml.execution).not.toHaveProperty('append_system_prompt');
    expect(yaml).toMatchObject({ runs: 1, execution: { max_turns: 12 } });
  });
});

describe('setupFor', () => {
  it('fills the sandbox defaults: main checked out, nothing extra', () => {
    expect(setupFor(SUITE, TRIAGE_CASE)).toEqual({
      pins: SUITE.pins,
      issues: ['issues/126.json'],
      prs: [],
      commits: [],
      branches: [],
      checkout: { branch: 'main' },
      dirty: [],
    });
  });
});

describe('caseFiles', () => {
  it('writes case.yaml, a scaffold.sh that hands off to scaffold.ts, and setup.json', () => {
    const files = caseFiles(
      SUITE,
      TRIAGE_CASE,
      'Dry.\n',
      '../../../../../scripts/evals/scaffold.ts',
    );
    expect(files.map((file) => file.path)).toEqual([
      '126-small-bug/case.yaml',
      '126-small-bug/scaffold.sh',
      '126-small-bug/setup.json',
    ]);
    expect(files[0]?.content).toMatch(/^# GENERATED by scripts\/evals\/gen-cases.ts/);
    expect(files[1]?.content).toContain(
      'exec node "$(dirname "$0")/../../../../../scripts/evals/scaffold.ts" "$(dirname "$0")"',
    );
  });
});
```

```ts
// scripts/evals/__tests__/suites.test.ts
// The escuadra-issue-runner suite: its generated files match cases.ts, and every
// case has what it loads. Importing cases.ts here also brings it under tsc.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SUITE } from '../../../.claude/skills/escuadra-issue-runner/evals/cases.ts';
import { renderSuite, staleCaseDirs } from '../lib/suite.ts';

const EVALS = fileURLToPath(
  new URL('../../../.claude/skills/escuadra-issue-runner/evals/', import.meta.url),
);

describe('escuadra-issue-runner suite', () => {
  it('matches cases.ts (regenerate with node scripts/evals/gen-cases.ts)', async () => {
    const files = await renderSuite(EVALS);
    for (const file of files) {
      expect(readFileSync(join(EVALS, file.path), 'utf8'), file.path).toBe(file.content);
    }
    expect(staleCaseDirs(EVALS, files)).toEqual([]);
  });

  it('has a fixture for every issue a case loads', () => {
    for (const item of SUITE.cases) {
      for (const number of item.issues) {
        const fixture = join(EVALS, '_fixtures', 'issues', `${number}.json`);
        expect(existsSync(fixture), `${item.name}: #${number}`).toBe(true);
      }
    }
  });

  it('names every case uniquely, in kebab case', () => {
    const names = SUITE.cases.map((item) => item.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run scripts/evals/__tests__/lib/cases.test.ts scripts/evals/__tests__/suites.test.ts`
Expected: FAIL, because `lib/cases.ts`, `lib/suite.ts` and the suite's `cases.ts` do not exist.

- [ ] **Step 3: Write the library modules and the generator**

```ts
// scripts/evals/lib/cases.ts
// A suite as data, and the files the eval runner reads, generated from it
// (spec §9). Pure: lib/suite.ts loads and formats, gen-cases.ts writes.
import type { PrFixture } from '../sandbox/gh.ts';
import { gradersFor, type Expectation } from './graders.ts';
import type { SandboxSetup, SyntheticCommit } from './sandbox.ts';
import { TRIAGE_TEMPLATE } from './triage.ts';
import { toYaml, type YamlMap } from './yaml.ts';

export interface EvalCase {
  /** The case's folder, and its name in the report. */
  name: string;
  /** What the case tests: the report's description. */
  why: string;
  tags: string[];
  prompt: string;
  /** Issues the fake gh serves, from _fixtures/issues/<number>.json. */
  issues: number[];
  prs?: PrFixture[];
  /** Commits made on main, then pushed, before anything else. */
  commits?: SyntheticCommit[];
  /** Branches pushed to origin with their own commits, such as an open PR's head. */
  branches?: SandboxSetup['branches'];
  /** The branch checked out when the agent starts. Default: main. */
  checkout?: SandboxSetup['checkout'];
  /** Tracked files left with an uncommitted edit. */
  dirty?: string[];
  expect: Expectation;
  runs?: number;
  maxTurns?: number;
  timeoutSeconds?: number;
}

export interface Suite {
  /** Branch → commit, for every branch the sandbox's origin keeps. */
  pins: Record<string, string>;
  allowedTools: string[];
  runs: number;
  maxTurns: number;
  timeoutSeconds: number;
  cases: EvalCase[];
}

export interface GeneratedFile {
  /** Relative to the suite's evals/ folder. */
  path: string;
  content: string;
}

export const GENERATED = 'GENERATED by scripts/evals/gen-cases.ts from cases.ts. Do not edit.';

export function setupFor(suite: Suite, item: EvalCase): SandboxSetup {
  return {
    pins: suite.pins,
    issues: item.issues.map((number) => `issues/${number}.json`),
    prs: item.prs ?? [],
    commits: item.commits ?? [],
    branches: item.branches ?? [],
    checkout: item.checkout ?? { branch: 'main' },
    dirty: item.dirty ?? [],
  };
}

export function caseYaml(suite: Suite, item: EvalCase, dryRun: string): YamlMap {
  const execution: YamlMap = {
    prompt: item.prompt,
    max_turns: item.maxTurns ?? suite.maxTurns,
    timeout_seconds: item.timeoutSeconds ?? suite.timeoutSeconds,
    allowed_tools: suite.allowedTools,
  };
  if (item.expect.kind !== 'smoke') {
    execution.append_system_prompt = `${dryRun.trim()}\n\n${TRIAGE_TEMPLATE}\n`;
  }
  return {
    schema_version: '1.0',
    name: item.name,
    description: item.why,
    tags: item.tags,
    context: { scaffold_script: 'scaffold.sh' },
    execution,
    runs: item.runs ?? suite.runs,
    graders: gradersFor(item.expect),
  };
}

/** `scaffoldEntry` is scripts/evals/scaffold.ts, relative to the case's folder. */
export function caseFiles(
  suite: Suite,
  item: EvalCase,
  dryRun: string,
  scaffoldEntry: string,
): GeneratedFile[] {
  const scaffold = `#!/bin/sh\n# ${GENERATED}\nexec node "$(dirname "$0")/${scaffoldEntry}" "$(dirname "$0")"\n`;
  return [
    {
      path: `${item.name}/case.yaml`,
      content: `# ${GENERATED}\n${toYaml(caseYaml(suite, item, dryRun))}`,
    },
    { path: `${item.name}/scaffold.sh`, content: scaffold },
    {
      path: `${item.name}/setup.json`,
      content: `${JSON.stringify(setupFor(suite, item), null, 2)}\n`,
    },
  ];
}
```

```ts
// scripts/evals/lib/format.ts
// Formats a generated file the way `prettier --check .` expects it, so the
// generator's output and npm run check agree. Files Prettier has no parser for
// (scaffold.sh) come back unchanged.
import * as prettier from 'prettier';

export async function formatFor(path: string, content: string): Promise<string> {
  const info = await prettier.getFileInfo(path);
  if (info.ignored || info.inferredParser === null) return content;
  const options = (await prettier.resolveConfig(path)) ?? {};
  return prettier.format(content, { ...options, filepath: path });
}
```

```ts
// scripts/evals/lib/suite.ts
// Loads a suite's cases.ts and dry-run.md and renders its generated files,
// formatted. Shared by gen-cases.ts and the suite-in-sync test.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { caseFiles, type GeneratedFile, type Suite } from './cases.ts';
import { formatFor } from './format.ts';

const SCAFFOLD = fileURLToPath(new URL('../scaffold.ts', import.meta.url));

export async function renderSuite(evalsDir: string): Promise<GeneratedFile[]> {
  const { SUITE } = (await import(pathToFileURL(join(evalsDir, 'cases.ts')).href)) as {
    SUITE: Suite;
  };
  const dryRun = readFileSync(join(evalsDir, 'dry-run.md'), 'utf8');
  const files = SUITE.cases.flatMap((item) =>
    caseFiles(SUITE, item, dryRun, relative(join(evalsDir, item.name), SCAFFOLD)),
  );
  return Promise.all(
    files.map(async (file) => ({
      path: file.path,
      content: await formatFor(join(evalsDir, file.path), file.content),
    })),
  );
}

/** Case folders on disk that the suite no longer generates. */
export function staleCaseDirs(evalsDir: string, files: GeneratedFile[]): string[] {
  const live = new Set(files.map((file) => file.path.split('/')[0]));
  return readdirSync(evalsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
    .filter((entry) => !live.has(entry.name))
    .filter((entry) => existsSync(join(evalsDir, entry.name, 'case.yaml')))
    .map((entry) => entry.name);
}
```

```ts
// scripts/evals/gen-cases.ts
// Writes each case's case.yaml, scaffold.sh and setup.json from a suite's
// cases.ts (spec §9): `node scripts/evals/gen-cases.ts [evals dir]`. Never edit
// the generated files; the suite test fails when they drift from cases.ts.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderSuite, staleCaseDirs } from './lib/suite.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const evalsDir = resolve(root, process.argv[2] ?? '.claude/skills/escuadra-issue-runner/evals');

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
```

- [ ] **Step 4: Write the suite skeleton**

`.claude/skills/escuadra-issue-runner/SKILL.md` (a stub, so the with arm behaves as the baseline until PR 2):

```markdown
---
name: escuadra-issue-runner
description: Use when asked to pick up, work on, continue or carry through an Escuadra GitHub issue by its number
---

# Escuadra issue runner

Not written yet. PR 2 of #136 writes this skill against the eval suite in `evals/`; see `scripts/evals/README.md`.
```

`.claude/skills/escuadra-issue-runner/evals/dry-run.md`:

```markdown
This session is a dry run for an evaluation. The working directory is a disposable copy of the Escuadra repository, and the `gh` on your `PATH` answers from fixtures.

- `CLAUDE.md` at the repository root holds the project's instructions. A real session would have it loaded already, so read it before anything else.
- Do every read-only step you would do for this request: read files, and run read-only `git` and `gh` commands.
- Make no change to the repository, its branches or worktrees, or to GitHub. Where you would take your first such step, stop instead.
- If the request leads you to work on a GitHub issue, end your final message with the triage block below, filled in with what you found and what you would do next. Put any question you would ask the owner in the block rather than asking it, and set `decision: ask`.
- If the request does not lead you to work on an issue, answer it and leave the block out.
```

`.claude/skills/escuadra-issue-runner/evals/_fixtures/issues/9000.json`:

```json
{
  "number": 9000,
  "title": "chore: sandbox smoke issue",
  "state": "OPEN",
  "body": "Fixture for `sandbox-smoke`: it checks the eval sandbox, not the app.",
  "comments": [],
  "labels": [],
  "milestone": null,
  "size": "XS",
  "source": "synthetic",
  "why": "The sandbox smoke case reads it through the fake gh."
}
```

`.claude/skills/escuadra-issue-runner/evals/cases.ts`:

```ts
// The escuadra-issue-runner eval suite as data (spec §7). Edit this, then run
// `node scripts/evals/gen-cases.ts` to regenerate each case's folder.
import type { EvalCase, Suite } from '../../../../scripts/evals/lib/cases.ts';

const PINS = {
  main: 'deb2e3b9c589bf2c5619fe3a7b82866ef9415ebf',
  'release/1.0.0': 'd8f2d21bb9bb4bf3256e64d3ca06b785ad7bd20b',
};

// Read-only commands only; `gh` stays whole, since the fake refuses its writes
// and logging them is what the no-writes grader checks.
const READ_ONLY_BASH = [
  'git status',
  'git log',
  'git branch',
  'git show',
  'git diff',
  'git rev-parse',
  'git ls-remote',
  'git remote',
  'git for-each-ref',
  'git worktree list',
  'git fetch',
  'git config --get',
  'gh',
  'ls',
  'cat',
  'head',
  'tail',
  'grep',
  'rg',
  'find',
  'wc',
  'jq',
  'sed -n',
  'sort',
  'cd',
  'pwd',
].map((command) => `Bash(${command}:*)`);

const GH_LOG = '.git/sandbox/gh.log';

const SMOKE: EvalCase = {
  name: 'sandbox-smoke',
  why: 'The sandbox itself: the git wrapper, the fake gh, a logged write and a denied commit.',
  tags: ['smoke'],
  prompt: [
    'Run each of these with Bash, one at a time, and quote every output in full:',
    '1. git log -1 --format=%H',
    '2. gh issue view 9000 --json title --jq .title',
    '3. gh pr create --title smoke --body smoke',
    '4. git commit --allow-empty -m smoke',
  ].join('\n'),
  issues: [9000],
  runs: 1,
  maxTurns: 12,
  timeoutSeconds: 300,
  expect: {
    kind: 'smoke',
    graders: [
      { type: 'regex', name: 'git-works', pattern: PINS.main, weight: 1 },
      {
        type: 'regex',
        name: 'fake-gh-answers',
        pattern: 'sandbox smoke issue',
        flags: 'i',
        weight: 1,
      },
      {
        type: 'regex',
        name: 'read-logged',
        target: { source: 'file', path: GH_LOG },
        pattern: '^READ gh issue view 9000',
        flags: 'm',
        weight: 1,
      },
      {
        type: 'regex',
        name: 'write-logged',
        target: { source: 'file', path: GH_LOG },
        pattern: '^WRITE gh pr create',
        flags: 'm',
        weight: 1,
      },
      {
        type: 'regex',
        name: 'commit-denied',
        target: 'trace',
        pattern: 'denied',
        flags: 'i',
        weight: 1,
      },
    ],
  },
};

export const SUITE: Suite = {
  pins: PINS,
  allowedTools: ['Read', 'Glob', 'Grep', 'Skill', ...READ_ONLY_BASH],
  runs: 3,
  maxTurns: 40,
  timeoutSeconds: 900,
  cases: [SMOKE],
};
```

- [ ] **Step 5: Generate, then run the tests to verify they pass**

```bash
npx prettier --write .claude/skills/escuadra-issue-runner scripts/evals/lib scripts/evals/gen-cases.ts scripts/evals/__tests__
node scripts/evals/gen-cases.ts
```

Expected: `gen-cases: wrote 1 cases to .claude/skills/escuadra-issue-runner/evals`, and three files in `evals/sandbox-smoke/`.

Run: `npx vitest run scripts/evals/__tests__/` then `npx tsc --noEmit`
Expected: every test passes, and tsc reports nothing. Open `evals/sandbox-smoke/case.yaml` and check by eye that it reads as plain block YAML.

- [ ] **Step 6: Commit**

```bash
git add scripts/evals/lib scripts/evals/gen-cases.ts scripts/evals/__tests__ .claude/skills/escuadra-issue-runner
git commit -m "test(evals): generate the suite's cases from cases.ts, starting with the smoke case (#136)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The runner

**Files:**

- Create: `scripts/evals/lib/run.ts`, `scripts/evals/run.ts`
- Test: `scripts/evals/__tests__/lib/run.test.ts`

**Interfaces:**

- Produces: `evalArgs(options: RunOptions): string[]`, `evalEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv`, `SANDBOX_BIN`, and the command `node scripts/evals/run.ts (--tag <tag>… | --case <glob> | --full) [--runs n] [--model m] [--judge-model m] [--ablation with-without|none] [--max-cost-usd n] [--concurrency n] [--threshold x] [--keep]`.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/evals/__tests__/lib/run.test.ts
import { describe, expect, it } from 'vitest';
import { evalArgs, evalEnv, type RunOptions } from '../../lib/run.ts';

const BASE: RunOptions = {
  target: '.claude/skills/escuadra-issue-runner',
  outDir: '/tmp/out',
  tags: ['core'],
  model: 'sonnet',
  judgeModel: 'opus',
  maxCostUsd: 15,
  threshold: 0.8,
  keep: false,
  full: false,
};

describe('evalArgs', () => {
  it('runs the scaffold, keeps the report local, and writes results outside the repo', () => {
    expect(evalArgs(BASE)).toEqual([
      'plugin',
      'eval',
      '.claude/skills/escuadra-issue-runner',
      '--scaffold',
      '--trust-plugin',
      '--allow-tools',
      'Bash',
      '--no-publish',
      '--model',
      'sonnet',
      '--judge-model',
      'opus',
      '--threshold',
      '0.8',
      '--max-cost-usd',
      '15',
      '--output-dir',
      '/tmp/out',
      '--report',
      '/tmp/out/report.html',
      '--json',
      '/tmp/out/result.json',
      '--tag',
      'core',
    ]);
  });

  it('passes the optional knobs through', () => {
    const args = evalArgs({
      ...BASE,
      tags: [],
      caseGlob: '129-*',
      runs: 1,
      ablation: 'none',
      concurrency: 2,
      keep: true,
    });
    expect(args.slice(-9)).toEqual([
      '--case',
      '129-*',
      '--runs',
      '1',
      '--ablation',
      'none',
      '--concurrency',
      '2',
      '--keep-temp',
    ]);
  });

  it('refuses to run the whole suite unless asked to', () => {
    expect(() => evalArgs({ ...BASE, tags: [] })).toThrow(/--full/);
    expect(evalArgs({ ...BASE, tags: [], full: true })).not.toContain('--tag');
  });
});

describe('evalEnv', () => {
  it('puts the sandbox bin first on PATH, as a relative entry', () => {
    expect(evalEnv({ PATH: '/usr/bin' }).PATH).toBe('.git/sandbox/bin:/usr/bin');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run scripts/evals/__tests__/lib/run.test.ts`
Expected: FAIL, because `../../lib/run.ts` cannot be found.

- [ ] **Step 3: Write the implementation**

```ts
// scripts/evals/lib/run.ts
// The arguments and environment for `claude plugin eval` (spec §9). The
// defaults that matter are pinned by a test: the scaffold runs, the report
// stays local, results land outside the repo, and the fake gh comes first on
// PATH through a relative entry that resolves inside each run's sandbox.
import { join } from 'node:path';

export interface RunOptions {
  /** The skill folder under test, relative to the repo root. */
  target: string;
  outDir: string;
  tags: string[];
  caseGlob?: string;
  /** No tag or case filter: every case. */
  full: boolean;
  runs?: number;
  model: string;
  judgeModel: string;
  ablation?: 'with-without' | 'none';
  maxCostUsd: number;
  concurrency?: number;
  threshold: number;
  /** Keep each run's directory, and so its trace. */
  keep: boolean;
}

export const SANDBOX_BIN = '.git/sandbox/bin';

export function evalArgs(o: RunOptions): string[] {
  if (!o.full && o.tags.length === 0 && o.caseGlob === undefined) {
    throw new Error(
      'Pick a slice with --tag <tag> or --case <glob>, or pass --full for every case.',
    );
  }
  const args = [
    'plugin',
    'eval',
    o.target,
    '--scaffold',
    '--trust-plugin',
    '--allow-tools',
    'Bash',
    '--no-publish',
    '--model',
    o.model,
    '--judge-model',
    o.judgeModel,
    '--threshold',
    String(o.threshold),
    '--max-cost-usd',
    String(o.maxCostUsd),
    '--output-dir',
    o.outDir,
    '--report',
    join(o.outDir, 'report.html'),
    '--json',
    join(o.outDir, 'result.json'),
  ];
  for (const tag of o.tags) args.push('--tag', tag);
  if (o.caseGlob !== undefined) args.push('--case', o.caseGlob);
  if (o.runs !== undefined) args.push('--runs', String(o.runs));
  if (o.ablation !== undefined) args.push('--ablation', o.ablation);
  if (o.concurrency !== undefined) args.push('--concurrency', String(o.concurrency));
  if (o.keep) args.push('--keep-temp');
  return args;
}

export function evalEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return { ...env, PATH: `${SANDBOX_BIN}:${env.PATH ?? ''}` };
}
```

```ts
// scripts/evals/run.ts
// Runs the eval suite (spec §9): `node scripts/evals/run.ts --tag core`,
// `--case '129-*'`, or `--full`. Every run draws on the owner's usage limits.
// Results and the HTML report go to a temporary directory, never the repo.
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { evalArgs, evalEnv } from './lib/run.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const { values } = parseArgs({
  options: {
    suite: { type: 'string', default: '.claude/skills/escuadra-issue-runner' },
    tag: { type: 'string', multiple: true, default: [] },
    case: { type: 'string' },
    full: { type: 'boolean', default: false },
    runs: { type: 'string' },
    model: { type: 'string', default: 'sonnet' },
    'judge-model': { type: 'string', default: 'opus' },
    ablation: { type: 'string' },
    'max-cost-usd': { type: 'string', default: '15' },
    concurrency: { type: 'string' },
    threshold: { type: 'string', default: '0.8' },
    keep: { type: 'boolean', default: false },
  },
});

const ablation = values.ablation;
if (ablation !== undefined && ablation !== 'with-without' && ablation !== 'none') {
  throw new Error(`--ablation must be with-without or none, not ${ablation}`);
}
const outDir = mkdtempSync(join(tmpdir(), 'escuadra-evals-'));
const args = evalArgs({
  target: values.suite,
  outDir,
  tags: values.tag,
  caseGlob: values.case,
  full: values.full,
  runs: values.runs === undefined ? undefined : Number(values.runs),
  model: values.model,
  judgeModel: values['judge-model'],
  ablation,
  maxCostUsd: Number(values['max-cost-usd']),
  concurrency: values.concurrency === undefined ? undefined : Number(values.concurrency),
  threshold: Number(values.threshold),
  keep: values.keep,
});
process.stdout.write(`Results and report: ${outDir}\n`);
const result = spawnSync('claude', args, {
  cwd: root,
  stdio: 'inherit',
  env: evalEnv(process.env),
});
process.exitCode = result.status ?? 1;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run scripts/evals/__tests__/lib/run.test.ts` and `npx tsc --noEmit`
Expected: PASS, and tsc reports nothing. `parseArgs` types `values.tag` as `string[]` because of `multiple: true` with a default.

- [ ] **Step 5: Commit**

```bash
npx prettier --write scripts/evals/lib/run.ts scripts/evals/run.ts scripts/evals/__tests__/lib/run.test.ts
git add scripts/evals/lib/run.ts scripts/evals/run.ts scripts/evals/__tests__/lib/run.test.ts
git commit -m "test(evals): a runner that wraps claude plugin eval with the suite's defaults (#136)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: The smoke run, live

This is the first real run. One Haiku session costs about $0.05 of the owner's limits. Task 6's runner already passed its tests, so this step checks the whole chain against the real eval runner.

**Files:**

- Modify: whichever file the run proves wrong (none, if it passes)

- [ ] **Step 1: Run the smoke case**

```bash
node scripts/evals/run.ts --tag smoke --model haiku --judge-model sonnet --keep
```

Expected: the output ends with the case scoring `1.00`. All five graders pass: `git-works`, `fake-gh-answers`, `read-logged`, `write-logged` and `commit-denied`.

- [ ] **Step 2: If a grader fails, read the trace before changing anything**

The run prints `kept /private/tmp/e-XXXX` and a trace path. To read it:

```bash
chmod 700 /private/tmp/e-XXXX /private/tmp/e-XXXX/sealed
jq -r 'select(.type=="user") | .message.content[]? | select(.type=="tool_result") | (.content | if type=="array" then map(.text // "") | join("") else . end)' /private/tmp/e-XXXX/out/trace.jsonl
```

Never run git inside the kept directory. Typical causes:

| Symptom                                       | Cause                                                  | Fix                                                                                                                    |
| --------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `scaffold failed (exit 1)`                    | `scaffold.ts` threw; stderr says why                   | Fix `lib/sandbox.ts` and add a failing test for it first                                                               |
| `command -v gh` → `/usr/local/bin/gh`         | `PATH` lost the relative entry                         | Check `evalEnv` and that `run.ts` passes it                                                                            |
| `xcrun_db … Operation not permitted`          | Something ran `/usr/bin/git`                           | Check the `git` wrapper and the uploadpack config                                                                      |
| `read-logged` fails but the title was printed | The file grader's path is resolved from somewhere else | Read the trace and the result JSON for the grader's explanation. Spec §11 records where the grader looks, so update it |

Fix the cause, re-run `npx vitest run scripts/evals/__tests__/`, regenerate, and repeat Step 1.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A scripts/evals .claude/skills/escuadra-issue-runner
git commit -m "fix(evals): <what the smoke run proved wrong> (#136)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Skip this step if the first run scored 1.00.

---

### Task 8: The snapshot tool

The seven real snapshots are already committed (`c25caf2e`), captured with a one-off script before other sessions could change the issues. This task builds the reusable tool and proves it writes the same format.

**Files:**

- Create: `scripts/evals/lib/capture.ts`, `scripts/evals/capture-issue.ts`
- Test: `scripts/evals/__tests__/lib/capture.test.ts`

**Interfaces:**

- Consumes: `IssueFixture` (Task 1), `formatFor` (Task 5).
- Produces: `toFixture(issue: GhIssue, size: string | null, why: string, date: string): IssueFixture`, `sizeFrom(response: SizeResponse): string | null`, `SIZE_QUERY`, and the command `node scripts/evals/capture-issue.ts <number> --why "<text>" [--date YYYY-MM-DD]`.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/evals/__tests__/lib/capture.test.ts
import { describe, expect, it } from 'vitest';
import { sizeFrom, toFixture } from '../../lib/capture.ts';

describe('toFixture', () => {
  it('flattens gh issue view JSON into a fixture', () => {
    const fixture = toFixture(
      {
        number: 117,
        title: 'fix(android): bold styles',
        state: 'OPEN',
        body: 'Body.',
        comments: [
          { author: { login: 'tovmassian' }, body: 'A note.' },
          { author: null, body: 'From a deleted account.' },
        ],
        labels: [{ name: 'bug' }],
        milestone: null,
      },
      'S',
      'The issue hands the owner the release route.',
      '2026-10-16',
    );
    expect(fixture).toEqual({
      number: 117,
      title: 'fix(android): bold styles',
      state: 'OPEN',
      body: 'Body.',
      comments: [
        { author: 'tovmassian', body: 'A note.' },
        { author: 'ghost', body: 'From a deleted account.' },
      ],
      labels: ['bug'],
      milestone: null,
      size: 'S',
      source: 'real snapshot 2026-10-16',
      why: 'The issue hands the owner the release route.',
    });
  });
});

describe('sizeFrom', () => {
  it('reads the first Size the board gives', () => {
    const response = {
      data: {
        repository: {
          issue: {
            projectItems: {
              nodes: [{ fieldValueByName: null }, { fieldValueByName: { name: 'M' } }],
            },
          },
        },
      },
    };
    expect(sizeFrom(response)).toBe('M');
  });

  it('gives null for an issue with no Size', () => {
    expect(
      sizeFrom({ data: { repository: { issue: { projectItems: { nodes: [] } } } } }),
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run scripts/evals/__tests__/lib/capture.test.ts`
Expected: FAIL, because `../../lib/capture.ts` cannot be found.

- [ ] **Step 3: Write the implementation**

```ts
// scripts/evals/lib/capture.ts
// Turns `gh issue view --json` output and the board's Size into an issue
// fixture (spec §6). Pure; capture-issue.ts runs the real gh.
import type { IssueFixture } from '../sandbox/gh.ts';

export interface GhIssue {
  number: number;
  title: string;
  state: string;
  body: string;
  comments: { author: { login: string } | null; body: string }[];
  labels: { name: string }[];
  milestone: { title: string } | null;
}

export interface SizeResponse {
  data?: {
    repository?: {
      issue?: {
        projectItems?: { nodes?: ({ fieldValueByName?: { name?: string } | null } | null)[] };
      };
    };
  };
}

export const SIZE_QUERY =
  'query($n:Int!){repository(owner:"tovmassian",name:"escuadra"){issue(number:$n){projectItems(first:5){nodes{fieldValueByName(name:"Size"){... on ProjectV2ItemFieldSingleSelectValue{name}}}}}}}';

export function toFixture(
  issue: GhIssue,
  size: string | null,
  why: string,
  date: string,
): IssueFixture {
  return {
    number: issue.number,
    title: issue.title,
    state: issue.state === 'CLOSED' ? 'CLOSED' : 'OPEN',
    body: issue.body,
    comments: issue.comments.map((c) => ({ author: c.author?.login ?? 'ghost', body: c.body })),
    labels: issue.labels.map((label) => label.name),
    milestone: issue.milestone?.title ?? null,
    size,
    source: `real snapshot ${date}`,
    why,
  };
}

export function sizeFrom(response: SizeResponse): string | null {
  for (const node of response.data?.repository?.issue?.projectItems?.nodes ?? []) {
    const name = node?.fieldValueByName?.name;
    if (name) return name;
  }
  return null;
}
```

```ts
// scripts/evals/capture-issue.ts
// Captures a real issue as a fixture for the suite:
//   node scripts/evals/capture-issue.ts 126 --why "S bug, in place"
// It uses the real gh, so run it in an ordinary shell. A snapshot records the
// issue as it stands at the main pin (spec §6): if the issue closed after the
// pin, set its state back by hand and say so in `source`.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { SIZE_QUERY, sizeFrom, toFixture, type GhIssue, type SizeResponse } from './lib/capture.ts';
import { formatFor } from './lib/format.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    why: { type: 'string' },
    date: { type: 'string' },
    suite: { type: 'string', default: '.claude/skills/escuadra-issue-runner' },
  },
});
const number = Number(positionals[0]);
if (!Number.isInteger(number) || values.why === undefined) {
  throw new Error('usage: node scripts/evals/capture-issue.ts <number> --why "<what it tests>"');
}

const gh = (args: string[]) => execFileSync('gh', args, { encoding: 'utf8' });
const fields = 'number,title,state,body,comments,labels,milestone';
const issue = JSON.parse(
  gh(['issue', 'view', String(number), '-R', 'tovmassian/escuadra', '--json', fields]),
) as GhIssue;
const size = sizeFrom(
  JSON.parse(
    gh(['api', 'graphql', '-f', `query=${SIZE_QUERY}`, '-F', `n=${number}`]),
  ) as SizeResponse,
);
const date = values.date ?? new Date().toISOString().slice(0, 10);

const file = join(root, values.suite, 'evals', '_fixtures', 'issues', `${number}.json`);
mkdirSync(dirname(file), { recursive: true });
const json = `${JSON.stringify(toFixture(issue, size, values.why, date), null, 2)}\n`;
writeFileSync(file, await formatFor(file, json));
process.stdout.write(`Wrote ${file}\n`);
```

- [ ] **Step 4: Run the test, then prove the tool reproduces a committed snapshot**

Run: `npx vitest run scripts/evals/__tests__/lib/capture.test.ts`
Expected: PASS.

Then re-capture an issue that has not changed since 2026-10-16, and diff it:

```bash
node scripts/evals/capture-issue.ts 55 --date 2026-10-16 --why "$(jq -r .why .claude/skills/escuadra-issue-runner/evals/_fixtures/issues/55.json)"
git diff --exit-code .claude/skills/escuadra-issue-runner/evals/_fixtures/issues/55.json
```

Expected: no diff. If #55 itself has changed on GitHub since then, the diff shows only that change. In that case `git checkout` the file and report it; don't commit the new snapshot.

- [ ] **Step 5: Commit**

```bash
npx prettier --write scripts/evals/lib/capture.ts scripts/evals/capture-issue.ts scripts/evals/__tests__/lib/capture.test.ts
git add scripts/evals/lib/capture.ts scripts/evals/capture-issue.ts scripts/evals/__tests__/lib/capture.test.ts
git commit -m "test(evals): capture a real issue as a fixture (#136)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: The synthetic fixtures and the 19 cases

**Files:**

- Create: `.claude/skills/escuadra-issue-runner/evals/_fixtures/issues/9001.json` … `9009.json`, `.claude/skills/escuadra-issue-runner/evals/_fixtures/docs/9007-spec.md`, `.claude/skills/escuadra-issue-runner/evals/_fixtures/docs/9007-plan.md`
- Modify: `.claude/skills/escuadra-issue-runner/evals/cases.ts`, `scripts/evals/__tests__/suites.test.ts`
- Generated: the 19 case folders

**Interfaces:**

- Consumes: `EvalCase`, `Suite` (Task 5) and `Triage` (Task 4).

- [ ] **Step 1: Add the failing assertions to the suite test**

Append inside the `describe` in `scripts/evals/__tests__/suites.test.ts`:

```ts
it('covers the matrix in spec §7, plus the smoke case', () => {
  expect(SUITE.cases.map((item) => item.name).sort()).toEqual(
    [
      '115-closed',
      '116-release',
      '117-owner-decision',
      '126-small-bug',
      '129-large-spec',
      '129-large-spec-subagent',
      '55-tbc',
      '59-gh-pages',
      'dirty-tree',
      'fingerprint-on-release',
      'm-boundary',
      'neg-create-issue',
      'neg-question',
      'no-size',
      'on-feature-branch',
      'on-release-branch',
      'open-pr',
      'plan-half-done',
      'sandbox-smoke',
      'shipped-fix-from-main',
    ].sort(),
  );
});

it('keeps a case the skill must not fire on', () => {
  expect(SUITE.cases.some((item) => item.expect.kind === 'no-triage')).toBe(true);
});

it('commits every fixture a case writes', () => {
  for (const item of SUITE.cases) {
    const commits = [...(item.commits ?? []), ...(item.branches ?? []).flatMap((b) => b.commits)];
    for (const file of commits.flatMap((commit) => commit.files)) {
      if (file.fixture === undefined) continue;
      expect(
        existsSync(join(EVALS, '_fixtures', file.fixture)),
        `${item.name}: ${file.fixture}`,
      ).toBe(true);
    }
  }
});
```

Run: `npx vitest run scripts/evals/__tests__/suites.test.ts`
Expected: FAIL. The suite has only `sandbox-smoke` and no `no-triage` case.

- [ ] **Step 2: Write the synthetic issues**

Each one names real files at the pin (checked on 2026-10-16), so an agent that goes looking finds them.

`_fixtures/issues/9001.json`:

```json
{
  "number": 9001,
  "title": "fix(about): the update line says Embedded after an OTA on 1.0.0",
  "state": "OPEN",
  "body": "**Size:** XS\n**Affects:** 1.0.0, live on the App Store.\n\nAfter an over-the-air update, About's update line still reads \"Embedded\" until a second cold start. `lib/aboutView.ts` reads `isEmbeddedLaunch` once, when `app/about.tsx` first renders, and keeps it.\n\n**Release route:** decided by the owner on 2026-10-14. It is JS-only, so it ships on `release/1.0.0` as an OTA update, and reaches `main` by `git cherry-pick -x`.\n\n### Work\n\n- [ ] Read `Updates.isEmbeddedLaunch` and `Updates.updateId` on each render of About\n- [ ] A test in `lib/aboutView.test.ts` for both states\n\n### Acceptance criteria\n\n- [ ] After an OTA update and one cold start, About names the update\n- [ ] `npm run check` passes",
  "comments": [],
  "labels": ["bug"],
  "milestone": null,
  "size": "XS",
  "source": "synthetic",
  "why": "An XS JS fix to the shipped 1.0.0, with its route decided, worked from release/1.0.0: in place."
}
```

`_fixtures/issues/9002.json`:

```json
{
  "number": 9002,
  "title": "fix(progress): a best score set on the last question's auto-advance is lost on 1.0.0",
  "state": "OPEN",
  "body": "**Size:** S\n**Affects:** 1.0.0, live on the App Store.\n\nWhen the tenth answer is right and the round auto-advances to Results, the new best score is sometimes not saved: `stores/progress.ts` records it after the navigation, and a fast app switch drops the write.\n\n**Release route:** decided by the owner on 2026-10-14. JS-only, so it ships on `release/1.0.0` over the air, then `git cherry-pick -x` to `main`.\n\n### Work\n\n- [ ] Record the best score before Results mounts\n- [ ] A test in `stores/progress.test.ts`\n\n### Acceptance criteria\n\n- [ ] A best score set on the last question survives an immediate app switch\n- [ ] `npm run check` passes",
  "comments": [],
  "labels": ["bug"],
  "milestone": null,
  "size": "S",
  "source": "synthetic",
  "why": "A shipped-version fix asked for from main: its base differs from the current branch, so a worktree from release/1.0.0."
}
```

`_fixtures/issues/9003.json`:

```json
{
  "number": 9003,
  "title": "fix(progress): best scores lost after an Android 15 OS update, on 1.0.0",
  "state": "OPEN",
  "body": "**Size:** S\n**Affects:** 1.0.0 on Android (Play closed test).\n\nAfter an OS update to Android 15 QPR2, AsyncStorage comes back empty and best scores are gone. It is fixed upstream in `@react-native-async-storage/async-storage` 2.2.1; 1.0.0 ships 2.2.0.\n\n**Release route:** the owner wants this on the live 1.0.0, on `release/1.0.0`.\n\n### Work\n\n- [ ] Upgrade `@react-native-async-storage/async-storage` to 2.2.1\n- [ ] Check `stores/progress.ts` still reads old data\n\n### Acceptance criteria\n\n- [ ] Best scores survive the OS update on a Pixel\n- [ ] `npm run check` passes",
  "comments": [],
  "labels": ["bug"],
  "milestone": null,
  "size": "S",
  "source": "synthetic",
  "why": "A shipped-version fix that needs a native package upgrade, which moves the fingerprint and cannot land on the locked release/1.0.0."
}
```

`_fixtures/issues/9004.json`:

```json
{
  "number": 9004,
  "title": "feat(study): sort the list view by shirt number or by name",
  "state": "OPEN",
  "body": "**Size:** M\n\nStudy's list view keeps the squad's file order. Add a two-way sort above the list: shirt number (the default) or name.\n\n### Work\n\n- [ ] The sort in `lib/studyView.ts`, pure, with tests\n- [ ] A `SegmentedControl` above the list in `app/team/[squadId]/study.tsx`\n- [ ] Persist the choice in `stores/progress.ts`, next to the grid/list choice\n- [ ] About's \"What is stored on your device\" list counts the new preference\n\n### Acceptance criteria\n\n- [ ] Both sorts work in grid and list, with Hide names on and off\n- [ ] The choice survives an app restart\n- [ ] `npm run check` passes",
  "comments": [],
  "labels": ["enhancement"],
  "milestone": null,
  "size": "M",
  "source": "synthetic",
  "why": "An M feature with no docs on clean main: it stays in place (only L and XL get a worktree) and starts with brainstorming."
}
```

`_fixtures/issues/9005.json`:

```json
{
  "number": 9005,
  "title": "feat(home): show the app version under the wordmark",
  "state": "OPEN",
  "body": "**Size:** S\n\nHome shows no version. Show `v<version>` in `textMuted` under the wordmark in `app/index.tsx`, read from `expo-constants`, the way About already does.\n\n### Acceptance criteria\n\n- [ ] Home shows the same version as About, in both themes\n- [ ] `npm run check` passes",
  "comments": [],
  "labels": ["enhancement"],
  "milestone": null,
  "size": "S",
  "source": "synthetic",
  "why": "An S feature while an unrelated feature branch is checked out: a worktree from main, not stacked on that work."
}
```

`_fixtures/issues/9006.json`:

```json
{
  "number": 9006,
  "title": "feat(picker): a clear button in the team search field",
  "state": "OPEN",
  "body": "**Size:** S\n\nClearing the team picker's search takes a long backspace. Add a × button inside `components/SearchField.tsx` that empties the field and keeps the keyboard up. It is the picker's search field, CLAUDE.md guardrail 3's one exception, so nothing changes about answering.\n\n### Acceptance criteria\n\n- [ ] The × appears only when the field has text, and VoiceOver reads it as \"Clear search\"\n- [ ] `npm run check` passes",
  "comments": [],
  "labels": ["enhancement"],
  "milestone": null,
  "size": "S",
  "source": "synthetic",
  "why": "An S feature on main with someone's uncommitted edit in the tree: a worktree keeps that edit safe."
}
```

`_fixtures/issues/9007.json`:

```json
{
  "number": 9007,
  "title": "feat(streak): streak badges on Results",
  "state": "OPEN",
  "body": "**Size:** L\n**Spec:** `docs/superpowers/specs/2026-10-01-streak-badges-design.md`\n**Plan:** `docs/superpowers/plans/2026-10-02-streak-badges.md`\n\nResults shows a badge for the round's longest run of right answers: 3 in a row, 5 in a row, and a la escuadra for all 10.\n\n### Work\n\n- [ ] Part 1: the badge model in `lib/streakBadges.ts`, pure, with tests\n- [ ] Part 2: the badge on Results, in `components/StreakChip.tsx`'s colours\n- [ ] Part 3: the share picture shows the badge\n\n### Acceptance criteria\n\n- [ ] Every badge is reachable on all three levels\n- [ ] `npm run check` passes",
  "comments": [],
  "labels": ["enhancement"],
  "milestone": null,
  "size": "L",
  "source": "synthetic",
  "why": "An L feature whose plan's part 1 is merged: progress comes from git, not the plan's checkboxes, and the execution question is asked."
}
```

`_fixtures/issues/9008.json`:

```json
{
  "number": 9008,
  "title": "fix(play): the progress bar skips from 9 to Results",
  "state": "OPEN",
  "body": "**Size:** S\n\nOn the tenth question `components/RoundProgress.tsx` still shows 9 filled steps when Results takes over, so the bar never reads 10 of 10.\n\n### Acceptance criteria\n\n- [ ] The bar shows 10 of 10 for the last question's verdict, on every level\n- [ ] `npm run check` passes",
  "comments": [],
  "labels": ["bug"],
  "milestone": null,
  "size": "S",
  "source": "synthetic",
  "why": "An open PR already carries the work: the skill reuses its branch and makes no second one."
}
```

`_fixtures/issues/9009.json`:

```json
{
  "number": 9009,
  "title": "fix(theme): the theme toggle says Dark while it follows the system",
  "state": "OPEN",
  "body": "With the preference on System and the phone in dark mode, `components/ThemeToggle.tsx` labels itself \"Dark\", so it is not clear the app is following the system.\n\n### Acceptance criteria\n\n- [ ] The toggle reads System whenever the preference is System\n- [ ] `npm run check` passes",
  "comments": [],
  "labels": ["bug"],
  "milestone": null,
  "size": null,
  "source": "synthetic",
  "why": "No Size on the board or in the body: the skill estimates one, says so, and proceeds."
}
```

- [ ] **Step 3: Write #9007's spec and plan fixtures**

`_fixtures/docs/9007-spec.md`:

```markdown
# Streak badges on Results

**Status:** design, approved 2026-10-01. Issue: #9007.

## What

Results shows one badge for the round's longest run of right answers:

| Run        | Badge         |
| ---------- | ------------- |
| 3 in a row | Hat-trick     |
| 5 in a row | On fire       |
| all 10     | A la escuadra |

Only the highest badge earned shows. No badge for a run under 3.

## How

- `lib/streakBadges.ts` is pure: given the round's verdicts, it returns the badge or null.
- Results draws it with `StreakChip`'s colours from the active palette.
- The share picture shows the same badge.
- Nothing leaves the device and nothing new is stored, so About's text does not change.

## Delivery

Three parts, one PR each, in the plan's order.
```

`_fixtures/docs/9007-plan.md`:

```markdown
# Streak badges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A streak badge on Results and on the share picture (#9007).

**Spec:** `docs/superpowers/specs/2026-10-01-streak-badges-design.md`

### Task 1: The badge model (part 1)

- [ ] Write `lib/__tests__/streakBadges.test.ts`: no badge under 3, Hat-trick at 3, On fire at 5, A la escuadra at 10
- [ ] Write `lib/streakBadges.ts`: `streakBadge(verdicts: boolean[]): Badge | null`
- [ ] Commit

### Task 2: The badge on Results (part 2)

- [ ] Render the badge under the score in Results, with `StreakChip`'s colours
- [ ] Regenerate `design/screens`
- [ ] Commit

### Task 3: The badge on the share picture (part 3)

- [ ] Draw the badge in `ShareCard`, in `palettes.dark`
- [ ] Commit
```

- [ ] **Step 4: Replace `cases.ts` with the full suite**

Keep the file's header, `PINS`, `READ_ONLY_BASH`, `GH_LOG` and `SMOKE` from Task 5. Add a `type` import of `Triage`, and replace `SUITE` with the version below:

```ts
import type { EvalCase, Suite } from '../../../../scripts/evals/lib/cases.ts';
import type { Triage } from '../../../../scripts/evals/lib/graders.ts';
```

```ts
const HANDOFF = 'docs/superpowers/handoff/2026-10-16-2-0-redesign-handoff.md';
const SPEC_2_0 = 'docs/superpowers/specs/2026-10-15-play-redesign-2-0-design.md';
const STUDY_PLAN = 'docs/superpowers/plans/2026-10-16-2-0-study.md';
const STREAK_SPEC = 'docs/superpowers/specs/2026-10-01-streak-badges-design.md';
const STREAK_PLAN = 'docs/superpowers/plans/2026-10-02-streak-badges.md';

const triage = (expect: Omit<Triage, 'kind'>): Triage => ({ kind: 'triage', ...expect });
const NEGATIVE_BUDGET = { maxTurns: 15, timeoutSeconds: 300 };

const CASES: EvalCase[] = [
  {
    name: '126-small-bug',
    why: "An S bug on clean main: in place, systematic-debugging. The board's S beats the body's M, and a device check is not a question.",
    tags: ['core', 'workspace'],
    prompt: 'Pick up #126.',
    issues: [126],
    expect: triage({
      decision: 'proceed',
      workspace: 'in-place',
      base: 'main',
      branch: { prefix: 'fix/126-' },
      firstStep: 'systematic-debugging',
      execution: 'n/a',
      docs: [HANDOFF],
    }),
  },
  {
    name: '129-large-spec',
    why: 'An L feature with a spec and no plan: a worktree, writing-plans, and the execution question asked up front.',
    tags: ['core', 'workspace', 'ask'],
    prompt: "Let's do issue 129.",
    issues: [129],
    expect: triage({
      decision: 'ask',
      workspace: 'worktree',
      base: 'main',
      branch: { prefix: 'feat/129-' },
      firstStep: 'writing-plans',
      execution: 'ask',
      docs: [SPEC_2_0, HANDOFF],
      questions:
        'one asks whether to run the plan with superpowers:subagent-driven-development or superpowers:executing-plans, and none asks something the issue, the spec or CLAUDE.md already answers.',
    }),
  },
  {
    name: '129-large-spec-subagent',
    why: 'The same issue, with the execution mode given in the prompt: nothing is left to ask.',
    tags: ['workspace'],
    prompt: 'Pick up #129 and run the plan with subagents.',
    issues: [129],
    expect: triage({
      decision: 'proceed',
      workspace: 'worktree',
      base: 'main',
      branch: { prefix: 'feat/129-' },
      firstStep: 'writing-plans',
      execution: 'subagent-driven',
      docs: [SPEC_2_0],
    }),
  },
  {
    name: '117-owner-decision',
    why: 'The issue leaves the release route to the owner, so the skill asks.',
    tags: ['core', 'ask'],
    prompt: 'Take #117 and carry it through.',
    issues: [117],
    expect: triage({
      decision: 'ask',
      docs: [HANDOFF],
      questions:
        "one asks the owner to choose the release route (a fix on release/1.0.0 shipped over the air, or main and the next version), because the issue says that is the owner's decision.",
    }),
  },
  {
    name: '55-tbc',
    why: '[TBC] in the title, and the work happens in the store consoles: the skill asks.',
    tags: ['ask'],
    prompt: 'Work on #55.',
    issues: [55],
    expect: triage({
      decision: 'ask',
      questions:
        'at least one asks the owner to confirm the [TBC] issue is ready to work (its scope or its wording), or points out that the work happens in App Store Connect and the Play Console rather than in the repository.',
    }),
  },
  {
    name: '59-gh-pages',
    why: 'XS, but it changes the published gh-pages site and touches the store-badge rule while Play is not live: the skill asks.',
    tags: ['ask'],
    prompt: 'Pick up #59.',
    issues: [59],
    expect: triage({
      decision: 'ask',
      questions:
        "at least one raises that the change lives on gh-pages, the published site, which needs the owner's go-ahead to push, or that the Google Play badge must not link anywhere while the app is not live in production on Play.",
    }),
  },
  {
    name: '116-release',
    why: 'A release chore the 2.0 handoff covers; cutting a release branch and store assets need the owner.',
    tags: ['ask'],
    prompt: 'Carry #116 through.',
    issues: [116],
    expect: triage({
      decision: 'ask',
      docs: [HANDOFF],
      questions:
        "at least one raises that the issue includes cutting a release branch, store assets or a store build, which need the owner's go-ahead.",
    }),
  },
  {
    name: '115-closed',
    why: 'A closed issue: the skill asks before doing anything.',
    tags: ['ask'],
    prompt: 'Pick up #115.',
    issues: [115],
    expect: triage({
      decision: 'ask',
      docs: [STUDY_PLAN],
      questions:
        'one notes that #115 is closed and asks whether anything is left to do or whether to reopen it.',
    }),
  },
  {
    name: 'on-release-branch',
    why: 'An XS JS fix to the shipped 1.0.0, worked while on release/1.0.0: in place, on that base.',
    tags: ['core', 'workspace'],
    prompt: 'Pick up #9001.',
    issues: [9001],
    checkout: { branch: 'release/1.0.0' },
    expect: triage({
      decision: 'proceed',
      workspace: 'in-place',
      base: 'release/1.0.0',
      branch: { prefix: 'fix/9001-' },
      firstStep: 'systematic-debugging',
      execution: 'n/a',
    }),
  },
  {
    name: 'shipped-fix-from-main',
    why: 'A shipped-version fix asked for from main: the base differs from the current branch, so a worktree from release/1.0.0.',
    tags: ['core', 'workspace'],
    prompt: 'Work on #9002.',
    issues: [9002],
    expect: triage({
      decision: 'proceed',
      workspace: 'worktree',
      base: 'release/1.0.0',
      branch: { prefix: 'fix/9002-' },
      firstStep: 'systematic-debugging',
      execution: 'n/a',
    }),
  },
  {
    name: 'fingerprint-on-release',
    why: 'A shipped-version fix that needs a native package upgrade, which cannot land on the locked release branch.',
    tags: ['ask'],
    prompt: 'Take #9003.',
    issues: [9003],
    expect: triage({
      decision: 'ask',
      questions:
        'one points out that upgrading @react-native-async-storage/async-storage, a native package, changes the fingerprint, so it cannot land on the locked release/1.0.0 and needs a new version and store build, and asks the owner how to proceed.',
    }),
  },
  {
    name: 'm-boundary',
    why: 'An M feature with no docs on clean main: in place, since only L and XL get a worktree, and brainstorming first.',
    tags: ['core', 'workspace'],
    prompt: 'Pick up #9004.',
    issues: [9004],
    expect: triage({
      decision: 'proceed',
      workspace: 'in-place',
      base: 'main',
      branch: { prefix: 'feat/9004-' },
      firstStep: 'brainstorming',
      execution: 'n/a',
    }),
  },
  {
    name: 'on-feature-branch',
    why: 'An S feature while another feature branch is checked out: a worktree from main, not stacked on unrelated work.',
    tags: ['workspace'],
    prompt: "Let's do #9005.",
    issues: [9005],
    branches: [
      {
        name: 'feat/9050-onboarding-tips',
        from: 'main',
        commits: [
          {
            message: 'feat(home): onboarding tips, first pass (#9050)',
            files: [
              {
                path: 'lib/onboardingTips.ts',
                content:
                  "export const ONBOARDING_TIPS = ['Pick a team', 'Play a round', 'Study your misses'];\n",
              },
            ],
          },
        ],
      },
    ],
    checkout: { branch: 'feat/9050-onboarding-tips' },
    expect: triage({
      decision: 'proceed',
      workspace: 'worktree',
      base: 'main',
      branch: { prefix: 'feat/9005-' },
      firstStep: 'test-driven-development',
      execution: 'n/a',
    }),
  },
  {
    name: 'dirty-tree',
    why: "An S feature on main with someone's uncommitted edit: a worktree keeps it safe.",
    tags: ['workspace'],
    prompt: 'Pick up #9006.',
    issues: [9006],
    dirty: ['README.md'],
    expect: triage({
      decision: 'proceed',
      workspace: 'worktree',
      base: 'main',
      branch: { prefix: 'feat/9006-' },
      firstStep: 'test-driven-development',
      execution: 'n/a',
    }),
  },
  {
    name: 'plan-half-done',
    why: "An L feature whose plan's part 1 is merged: progress comes from git, not checkboxes, and the execution question is asked.",
    tags: ['core', 'ask'],
    prompt: 'Continue #9007.',
    issues: [9007],
    commits: [
      {
        message: 'docs(spec): streak badges on Results (#9007)',
        files: [
          { path: STREAK_SPEC, fixture: 'docs/9007-spec.md' },
          { path: STREAK_PLAN, fixture: 'docs/9007-plan.md' },
        ],
      },
      {
        message: 'feat(streak): the badge model (#9007, part 1) (#9100)',
        files: [
          {
            path: 'lib/streakBadges.ts',
            content:
              "export type Badge = 'hat-trick' | 'on-fire' | 'a-la-escuadra';\n\nexport function streakBadge(verdicts: boolean[]): Badge | null {\n  let run = 0;\n  let best = 0;\n  for (const right of verdicts) {\n    run = right ? run + 1 : 0;\n    best = Math.max(best, run);\n  }\n  if (best >= 10) return 'a-la-escuadra';\n  if (best >= 5) return 'on-fire';\n  return best >= 3 ? 'hat-trick' : null;\n}\n",
          },
        ],
      },
    ],
    expect: triage({
      decision: 'ask',
      workspace: 'worktree',
      base: 'main',
      branch: { prefix: 'feat/9007-' },
      execution: 'ask',
      docs: [STREAK_SPEC, STREAK_PLAN],
      existing: ['#9100', 'part 1'],
      questions:
        'one asks whether to run the rest of the plan with superpowers:subagent-driven-development or superpowers:executing-plans, and the block treats part 1 (#9100) as done.',
    }),
  },
  {
    name: 'open-pr',
    why: 'An open PR already carries the work: reuse its branch, and make no second one.',
    tags: ['core', 'workspace'],
    prompt: 'Pick up #9008.',
    issues: [9008],
    branches: [
      {
        name: 'fix/9008-progress-bar-last-step',
        from: 'main',
        commits: [
          {
            message: 'fix(play): progress bar reaches 10 before Results (#9008)',
            files: [
              {
                path: 'lib/roundProgress.ts',
                content:
                  'export function filledSteps(answered: number, total: number): number {\n  return Math.min(answered, total);\n}\n',
              },
            ],
          },
        ],
      },
    ],
    prs: [
      {
        number: 9101,
        title: 'fix(play): progress bar reaches 10 before Results (#9008)',
        state: 'OPEN',
        headRefName: 'fix/9008-progress-bar-last-step',
        baseRefName: 'main',
        body: 'Closes #9008\n\nThe bar now fills on the last verdict. Still to do: the test for level 3, and the device check.',
      },
    ],
    expect: triage({
      decision: 'proceed',
      workspace: 'in-place',
      base: 'main',
      branch: { exact: 'fix/9008-progress-bar-last-step' },
      execution: 'n/a',
      existing: ['#9101', 'fix/9008-progress-bar-last-step'],
    }),
  },
  {
    name: 'no-size',
    why: 'No Size on the board or in the body: estimated and marked so; a small bug, in place.',
    tags: ['workspace'],
    prompt: 'Work on #9009.',
    issues: [9009],
    expect: triage({
      decision: 'proceed',
      workspace: 'in-place',
      base: 'main',
      branch: { prefix: 'fix/9009-' },
      firstStep: 'systematic-debugging',
      execution: 'n/a',
      sizeEstimated: true,
    }),
  },
  {
    name: 'neg-create-issue',
    why: 'Creating an issue is not working one: the skill does not fire.',
    tags: ['negative'],
    prompt: 'Open an issue for the share button sitting too low on small Android screens.',
    issues: [],
    ...NEGATIVE_BUDGET,
    expect: {
      kind: 'no-triage',
      answered:
        'The response deals with creating a GitHub issue: it drafts one, asks for what an issue needs, or says it would create it. It does not start implementing anything and prints no triage block.',
    },
  },
  {
    name: 'neg-question',
    why: 'A question about an issue is not a request to work it: the skill does not fire.',
    tags: ['core', 'negative'],
    prompt: 'What does #117 say about Android fonts?',
    issues: [117],
    ...NEGATIVE_BUDGET,
    expect: {
      kind: 'no-triage',
      answered:
        'It answers from the issue: on Android, text styles that pair a runtime-loaded font with a fontWeight of 700 or more probably render in the system font (Roboto) instead of their own. It does not start work and prints no triage block.',
    },
  },
];

export const SUITE: Suite = {
  pins: PINS,
  allowedTools: ['Read', 'Glob', 'Grep', 'Skill', ...READ_ONLY_BASH],
  runs: 3,
  maxTurns: 40,
  timeoutSeconds: 900,
  cases: [SMOKE, ...CASES],
};
```

- [ ] **Step 5: Generate, then run the tests to verify they pass**

```bash
npx prettier --write .claude/skills/escuadra-issue-runner scripts/evals/__tests__/suites.test.ts
node scripts/evals/gen-cases.ts
npx vitest run scripts/evals/__tests__/
npx tsc --noEmit
```

Expected: `gen-cases: wrote 20 cases …`, all tests pass, and tsc reports nothing.

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/escuadra-issue-runner scripts/evals/__tests__/suites.test.ts
git commit -m "test(evals): the 19 cases of spec §7, with synthetic fixtures (#136)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: The front door, and the whole check

**Files:**

- Create: `scripts/evals/README.md`
- Modify: `CLAUDE.md` (Reference docs)

- [ ] **Step 1: Write `scripts/evals/README.md`**

```markdown
# Evals

Grades how an agent triages an Escuadra issue, with and without a skill, using Claude Code's `claude plugin eval`. Design: [`docs/superpowers/specs/2026-10-16-issue-runner-evals-design.md`](../../docs/superpowers/specs/2026-10-16-issue-runner-evals-design.md). The suite: [`.claude/skills/escuadra-issue-runner/evals/`](../../.claude/skills/escuadra-issue-runner/evals/).

## Run it

Every run draws on your Claude plan's usage limits. Start small:

| What                                            | Command                                                                    |
| ----------------------------------------------- | -------------------------------------------------------------------------- |
| Check the sandbox (after a Claude Code upgrade) | `node scripts/evals/run.ts --tag smoke --model haiku --judge-model sonnet` |
| A slice, once each, while iterating             | `node scripts/evals/run.ts --tag core --runs 1`                            |
| One case                                        | `node scripts/evals/run.ts --case 'open-pr'`                               |
| Everything, before a skill change merges        | `node scripts/evals/run.ts --full`                                         |

The defaults are a Sonnet agent, an Opus judge, a pass threshold of 0.8 per case, a $15 ceiling (estimated at API rates) and both arms (`--ablation with-without`). The results directory is printed first, and holds `report.html` and `result.json`. Nothing is written to the repo, and nothing is published.

To see why a run failed, add `--keep`. The run's directory is kept, sealed: `chmod 700` it and its `sealed/` folder, then read `out/trace.jsonl`. Never run git inside it.

## Change the suite

- **Cases** are data in `cases.ts`. Edit them, then run `node scripts/evals/gen-cases.ts`. Never edit a case's `case.yaml`, `scaffold.sh` or `setup.json`: `npm run check` fails when they drift.
- **A real issue** becomes a fixture with `node scripts/evals/capture-issue.ts <number> --why "<what it tests>"`. A snapshot records the issue as it stands at the main pin.
- **Bumping the pins** (`PINS` in `cases.ts`) means re-capturing the real issues and checking every expectation still holds at the new commit.

## What a run can and cannot do

The runner gives each run a fresh directory and an OS sandbox (spec §11):

- The agent cannot read the real repo or write outside its directory.
- It gets no `CLAUDE.md` preloaded, no user plugins and no project skills.
- `gh` is a fake that answers from fixtures and refuses writes.
- `git` is a wrapper around the real binary, because macOS's `/usr/bin/git` shim fails inside the sandbox.
- A case's `env` may set only `EVAL_*` names.
```

- [ ] **Step 2: Link it from `CLAUDE.md`**

In `CLAUDE.md`'s `## Reference docs` list, after the `docs/license.md` line, add:

```markdown
- [`scripts/evals/README.md`](scripts/evals/README.md): evals: grading an agent's issue triage with and without the `escuadra-issue-runner` skill.
```

- [ ] **Step 3: Run the whole check**

```bash
npx prettier --write scripts/evals/README.md CLAUDE.md
npm run check
```

Expected: typecheck, lint, format check, every test, the registry check and the generators all pass, and `git diff --exit-code` on generated files is clean. Paste the summary lines of the output into the task's report.

- [ ] **Step 4: Commit**

```bash
git add scripts/evals/README.md CLAUDE.md
git commit -m "docs(evals): the eval harness's front door (#136)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: The RED baseline, and PR 1

**Files:**

- Modify: `docs/superpowers/specs/2026-10-16-issue-runner-evals-design.md` (add an `## Outcome` section after the status line)

- [ ] **Step 1: Ask the owner before running**

The baseline is the full suite against the stub skill: `--full --ablation none --runs 3`, which is 60 Sonnet sessions (20 cases × 3; `--runs` overrides the smoke case's single run too). `--runs 1` cuts that to 20. Ask which, and wait for the answer.

- [ ] **Step 2: Run it**

```bash
node scripts/evals/run.ts --full --ablation none --runs 3 --max-cost-usd 40
```

Expected: most cases score well under 0.8, since the stub skill says nothing. The command exits 1 because of the threshold, and that is expected here. `sandbox-smoke` scores 1.00. If it doesn't, stop and go back to Task 7.

- [ ] **Step 3: Record the RED baseline**

From `result.json` in the printed directory:

```bash
jq -r '.cases[] | "\(.name)\t\(.aggregates.score)"' <results dir>/result.json
```

Add to the spec, after its `**Status:**` paragraph, an `## Outcome` section:

- the date and Claude Code version;
- a table of case → baseline score;
- one line per failure pattern seen in the graders' explanations (for example, "no case named its base", "asked nothing on #117").

Those patterns are what PR 2's skill is written against.

- [ ] **Step 4: Commit, and ask before the PR**

```bash
npx prettier --write docs/superpowers/specs/2026-10-16-issue-runner-evals-design.md
git add docs/superpowers/specs/2026-10-16-issue-runner-evals-design.md
git commit -m "docs(spec): the RED baseline, without the skill (#136)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Then ask the owner whether to push `feat/136-issue-runner-evals` and open PR 1 against `main`. On a yes, the PR body:

- links #136 and the spec;
- summarises the harness;
- pastes the baseline table;
- notes that PR 2 brings the skill;
- ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

It does not close #136; PR 2 does.
