# Eval pins past #165 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the issue-runner eval suite's pins to a commit after #165, so a run sees `CLAUDE.md` as an index and its `.claude/rules/`, and keep every file of the skill under test (and the expected answers) out of the run's clone, history included.

**Architecture:** The sandbox builds `origin.git` from an empty bare repo by fetching only the pinned commits (not a clone of the whole source repo), then rewrites that history to drop a suite-declared list of hidden paths and prunes the originals. The suite declares the hidden paths and the new pins in `cases.ts`; real-issue fixtures are re-captured at the new pin, and the cases whose real issue has since closed are replaced.

**Tech Stack:** Node 24 (TypeScript run directly), Vitest, `claude plugin eval` through `scripts/evals/run.ts`, git `filter-branch`.

**Spec:** `docs/superpowers/specs/2026-10-16-issue-runner-evals-design.md` §5, §6, §11 (issue #171)

## Global Constraints

- `nvm use` first: Node 24+. TypeScript is strict, including `noUncheckedIndexedAccess`; never weaken it.
- **No npm script, no `.gitignore` line, nothing else that moves the fingerprint** (`package.json` scripts and dependencies, `app.json`, `eas.json`, `fingerprint.config.js`). Commands run as `node scripts/evals/...`.
- **No run writes to GitHub or the real repo.** `capture-issue.ts` is the only step that uses the real `gh`, read-only.
- Generated files (`<case>/case.yaml`, `scaffold.sh`, `setup.json`) are never edited by hand: edit `cases.ts`, then `node scripts/evals/gen-cases.ts`.
- Tests go in `__tests__/` folders that mirror the code; no network, no clock.
- Commit style: conventional commits ending `(#171)`, with the trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Work on branch `chore/171-eval-pins-past-165` (already created, in place).
- Tasks 6 and 7 spend the owner's Claude plan usage: **run by the controller, not a subagent**, and Task 7 asks the owner before launching.

## Decisions made in this plan

- **New `main` pin:** `df83a1164a826261f3c684aa225aacf801f40731` (origin/main on 2026-10-24: after #165/#167 and #166, with SDK 58). Its subject is `fix(picker): re-tapping the selected tab keeps its filter (#190) (#206)`.
- **`release/1.0.0` pin stays `d8f2d21b…`**: the branch's head has not moved (`git rev-parse origin/release/1.0.0` is `d8f2d21bb9bb4bf3256e64d3ca06b785ad7bd20b`). Re-check in Task 2.
- **Hidden from the clone** (suite-declared, `Suite.hidden`): the skill folder, the harness `scripts/evals`, and the eval spec and plan under `docs/superpowers/` (the spec's §7 is the answer matrix). The issue's own criterion is only the skill folder; the rest keeps the answers out too.
- **Real cases kept (re-captured at the pin):** `55-tbc`, `59-gh-pages`, `116-release`, `115-closed` (closed, stays closed), `neg-question` (#117, a question about a closed issue).
- **Real cases replaced:** #126, #129 and #117 are closed by work the new pin contains, so they can no longer "proceed". `117-owner-decision` becomes `160-route-choice` (real #160: the owner picks route A or B). `126-small-bug` becomes the synthetic `small-bug` (#9010). `129-large-spec` and `129-large-spec-subagent` become the synthetic `large-spec` and `large-spec-subagent` (#9011): real #170 is not used because its spec is the eval spec, which stays hidden.
- **Dropped from the old #129 pair:** the "two open choices asked" aspect. `160-route-choice` covers "the issue lists choices to settle" (gate 3); `large-spec-subagent` is now `proceed`, since #9011 has no open choice.

---

### Task 1: The sandbox fetches only the pins and hides paths from history

**Files:**

- Modify: `scripts/evals/lib/sandbox.ts` (the `SandboxSetup` type; `buildSandbox`, lines ~104-113)
- Modify: `scripts/evals/lib/cases.ts` (`Suite`, `setupFor`)
- Test: `scripts/evals/__tests__/lib/sandbox.test.ts`, `scripts/evals/__tests__/lib/cases.test.ts`

**Interfaces:**

- Produces: `SandboxSetup.hidden: string[]` (repo-relative paths removed from every pinned commit); `Suite.hidden?: string[]` (default `[]`), passed through `setupFor` to `setup.json`.
- Consumes: nothing new.

- [ ] **Step 1: Write the failing sandbox tests**

In `scripts/evals/__tests__/lib/sandbox.test.ts`, add `hidden: []` to the two existing `setup` objects (the `SandboxSetup` type will require it), then append this describe block at the end of the file:

```ts
// A source repo where a secret path sits in two commits, and an unpinned branch holds its own blob.
function secretSource() {
  const dir = temp('sandbox-secret-');
  git(dir, 'init', '--quiet', '--initial-branch', 'main');
  mkdirSync(join(dir, 'secret'));
  writeFileSync(join(dir, 'secret', 'answers.md'), 'answer one\n');
  writeFileSync(join(dir, 'keep.md'), '# Keep\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '--quiet', '-m', 'first');
  const first = git(dir, 'rev-parse', 'HEAD');
  const firstBlob = git(dir, 'rev-parse', 'HEAD:secret/answers.md');
  writeFileSync(join(dir, 'secret', 'answers.md'), 'answer two\n');
  writeFileSync(join(dir, 'keep.md'), '# Keep\n\nMore.\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '--quiet', '-m', 'second');
  const second = git(dir, 'rev-parse', 'HEAD');
  const secondBlob = git(dir, 'rev-parse', 'HEAD:secret/answers.md');
  git(dir, 'switch', '--quiet', '-c', 'feat/unpinned');
  writeFileSync(join(dir, 'unpinned.md'), 'only on an unpinned branch\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '--quiet', '-m', 'unpinned');
  const unpinnedBlob = git(dir, 'rev-parse', 'HEAD:unpinned.md');
  git(dir, 'switch', '--quiet', 'main');
  return { dir, first, second, firstBlob, secondBlob, unpinnedBlob };
}

describe('buildSandbox with hidden paths', () => {
  const source = secretSource();
  const work = temp('sandbox-work-');
  let origin = '';

  const hasObject = (cwd: string, sha: string): boolean => {
    try {
      git(cwd, 'cat-file', '-e', sha);
      return true;
    } catch {
      return false;
    }
  };

  beforeAll(() => {
    const tmp = temp('sandbox-tmp-');
    origin = join(tmp, 'origin.git');
    buildSandbox({
      sourceRepo: source.dir,
      workDir: work,
      tmpDir: tmp,
      fixturesDir: fixtures(),
      ghDir: GH_DIR,
      realGit: realGitBinary(),
      setup: {
        pins: { main: source.second },
        issues: [],
        prs: [],
        commits: [],
        branches: [],
        checkout: { branch: 'main' },
        dirty: [],
        hidden: ['secret'],
      },
    });
  });

  it('leaves the hidden path out of the working directory and out of every commit', () => {
    expect(existsSync(join(work, 'secret'))).toBe(false);
    expect(git(origin, 'log', '--all', '--format=%H', '--', 'secret')).toBe('');
    expect(git(origin, 'rev-list', '--objects', '--all')).not.toContain('secret');
  });

  it('removes the hidden blobs from the object database, not just from reach', () => {
    for (const blob of [source.firstBlob, source.secondBlob]) {
      expect(hasObject(origin, blob), `origin has ${blob}`).toBe(false);
      expect(hasObject(work, blob), `clone has ${blob}`).toBe(false);
    }
  });

  it('carries no object from a branch that is not pinned', () => {
    expect(hasObject(origin, source.unpinnedBlob)).toBe(false);
  });

  it('keeps the rest of the history: subjects, authors and dates', () => {
    expect(git(work, 'log', 'origin/main', '--format=%s')).toBe('second\nfirst');
    expect(git(work, 'show', 'origin/main:keep.md')).toContain('More.');
    const dates = (cwd: string, ref: string) => git(cwd, 'log', ref, '--format=%aI %an');
    expect(dates(work, 'origin/main')).toBe(dates(source.dir, 'main'));
  });

  it('leaves no rewrite backup refs behind', () => {
    expect(git(origin, 'for-each-ref', '--format=%(refname)', 'refs/original')).toBe('');
  });
});
```

Also in `scripts/evals/__tests__/lib/cases.test.ts`, find the test that checks `setupFor` (it builds a `Suite` with `pins: { main: 'a'.repeat(40) }`) and make its expected object include `hidden: []`; add a second assertion that a suite with `hidden: ['secret']` yields `hidden: ['secret']`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `nvm use && npx vitest run scripts/evals/__tests__/lib/sandbox.test.ts scripts/evals/__tests__/lib/cases.test.ts`
Expected: FAIL (TypeScript errors about `hidden`, and the new describe's blob/`secret` assertions fail because the bare clone copies every object).

- [ ] **Step 3: Implement**

In `scripts/evals/lib/sandbox.ts`:

Add to `SandboxSetup` (after `dirty`):

```ts
  /** Repo-relative paths removed from every pinned commit, and from the object database. */
  hidden: string[];
```

Replace the first five statements of `buildSandbox` (the `clone --bare` through `symbolic-ref HEAD` block, ending before `git(o.workDir, ['clone', '--quiet', origin, '.'])`) with:

```ts
const origin = join(o.tmpDir, 'origin.git');
// Fetch only the pinned commits into an empty repo: a clone of the source would carry every
// object it holds, the unpinned branches' and the hidden paths' included.
git(o.tmpDir, ['init', '--quiet', '--bare', origin]);
for (const [branch, sha] of Object.entries(o.setup.pins)) {
  git(origin, ['fetch', '--quiet', '--no-tags', o.sourceRepo, `${sha}:refs/heads/${branch}`]);
}
git(origin, ['symbolic-ref', 'HEAD', 'refs/heads/main']);
if (o.setup.hidden.length > 0) hideFromHistory(origin, o.setup.hidden);
```

Add below `commitFiles`:

```ts
/**
 * Rewrites every branch of `origin` without `paths`, then drops the original objects. The
 * rewrite keeps messages, authors and dates, so a case's `git log` reads as the real one; the
 * hashes change. It runs without DATES, which would stamp every rewritten commit with them.
 */
function hideFromHistory(origin: string, paths: string[]): void {
  const quoted = paths.map((path) => `'${path}'`).join(' ');
  execFileSync(
    'git',
    [
      'filter-branch',
      '--force',
      '--index-filter',
      `git rm -r -q --cached --ignore-unmatch -- ${quoted}`,
      '--',
      '--all',
    ],
    {
      cwd: origin,
      env: { ...withoutGitVars(process.env), FILTER_BRANCH_SQUELCH_WARNING: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  const backups = git(origin, ['for-each-ref', '--format=%(refname)', 'refs/original']);
  for (const ref of backups.split('\n').filter(Boolean)) git(origin, ['update-ref', '-d', ref]);
  git(origin, ['reflog', 'expire', '--expire=now', '--all']);
  git(origin, ['gc', '--quiet', '--prune=now']);
}
```

In `scripts/evals/lib/cases.ts`, add to `Suite` (after `pins`):

```ts
  /** Paths hidden from the sandbox's clone and its history (see `SandboxSetup.hidden`). */
  hidden?: string[];
```

and to `setupFor`'s returned object: `hidden: suite.hidden ?? [],`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run scripts/evals/__tests__/lib/sandbox.test.ts scripts/evals/__tests__/lib/cases.test.ts`
Expected: PASS. (The suites test fails until Task 2 regenerates `setup.json`; that is expected.)

- [ ] **Step 5: Typecheck and commit**

Run: `npx tsc --noEmit` — expect no errors other than possibly none.

```bash
git add scripts/evals/lib/sandbox.ts scripts/evals/lib/cases.ts scripts/evals/__tests__/lib/sandbox.test.ts scripts/evals/__tests__/lib/cases.test.ts
git commit -m "feat(evals): the sandbox fetches only the pins and hides paths from history (#171)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Move the pins, declare the hidden paths, re-point the smoke case

**Files:**

- Modify: `.claude/skills/escuadra-issue-runner/evals/cases.ts` (`PINS`, `SMOKE`, `SUITE`)
- Regenerate: every `.claude/skills/escuadra-issue-runner/evals/<case>/setup.json`

**Interfaces:**

- Consumes: `Suite.hidden` from Task 1.
- Produces: `PINS`, `HIDDEN` constants used by `SUITE`.

- [ ] **Step 1: Confirm the pins**

Run:

```bash
git cat-file -t df83a1164a826261f3c684aa225aacf801f40731
git rev-parse origin/release/1.0.0
git ls-tree -r --name-only df83a1164a826261f3c684aa225aacf801f40731 | grep -c '^.claude/rules/'
```

Expected: `commit`; `d8f2d21bb9bb4bf3256e64d3ca06b785ad7bd20b` (if the branch has moved, use its head as the `release/1.0.0` pin, and say so in the commit message); a count of 1 or more.

- [ ] **Step 2: Edit `cases.ts`**

Replace the `PINS` constant (lines 6-9) with:

```ts
const PINS = {
  main: 'df83a1164a826261f3c684aa225aacf801f40731',
  'release/1.0.0': 'd8f2d21bb9bb4bf3256e64d3ca06b785ad7bd20b',
};

// Out of every run's clone and history: the skill under test (SKILL.md and these expected
// answers), the harness, and the spec and plan whose matrix lists the answers.
const HIDDEN = [
  '.claude/skills/escuadra-issue-runner',
  'scripts/evals',
  'docs/superpowers/specs/2026-10-16-issue-runner-evals-design.md',
  'docs/superpowers/plans/2026-10-16-issue-runner-evals.md',
];
```

In `SMOKE`: change prompt step 1 to `'1. git log -1 --format=%s'`, and the `git-works` grader to:

```ts
      {
        type: 'regex',
        name: 'git-works',
        // The pinned commit's subject: its hash changes when the hidden paths are rewritten out.
        pattern: 'selected tab keeps its filter',
        weight: 1,
      },
```

In `SUITE`, add `hidden: HIDDEN,` after `pins: PINS,`.

- [ ] **Step 3: Regenerate and check the sandbox builds against the real repo**

Run: `node scripts/evals/gen-cases.ts` then:

```bash
T=$(mktemp -d) && mkdir "$T/work" && cd "$T/work" && time TMPDIR="$T" node /Users/khachaturtovmasyan/Projects/escuadra/scripts/evals/scaffold.ts /Users/khachaturtovmasyan/Projects/escuadra/.claude/skills/escuadra-issue-runner/evals/neg-question; echo "scaffold exit $?"
git ls-tree -r --name-only HEAD | grep -cE 'escuadra-issue-runner|scripts/evals|issue-runner-evals'
ls .claude/rules | head -3; git log --oneline | wc -l
git log --all --oneline -- .claude/skills/escuadra-issue-runner scripts/evals | wc -l
git fsck --lost-found 2>&1 | grep -c dangling
git for-each-ref --format='%(refname)' refs
```

Expected: scaffold exits 0 in well under 120 s (measured ~35 s); both greps print `0`; the rules listed; about 329 commits; no dangling objects; the refs are `refs/heads/main`, and `refs/remotes/origin/*` for `main` and `release/1.0.0` only.

If the scaffold takes more than 90 s, stop and report: the 120 s scaffold limit is the constraint.

(`cd` back to the repo afterwards. This step needs a signed-in shell for nothing; it uses no network.)

- [ ] **Step 4: Run the suite tests and commit**

Run: `npx vitest run scripts/evals`
Expected: PASS (setup.json files are regenerated; `suites.test.ts` in sync).

```bash
git add .claude/skills/escuadra-issue-runner/evals scripts/evals
git commit -m "chore(evals): pin main past #165 and hide the skill and its answers from the clone (#171)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Re-capture the real issues at the pin; swap the closed ones

**Files:**

- Modify (re-captured): `.claude/skills/escuadra-issue-runner/evals/_fixtures/issues/{55,59,115,116,117}.json`
- Create: `.claude/skills/escuadra-issue-runner/evals/_fixtures/issues/160.json`
- Delete: `_fixtures/issues/126.json`, `_fixtures/issues/129.json`
- Modify: `.claude/skills/escuadra-issue-runner/evals/cases.ts` (`117-owner-decision` → `160-route-choice`; the expected `docs` of every real case)
- Modify: `scripts/evals/__tests__/suites.test.ts` (the case-name list)

**Interfaces:**

- Produces: `docs` constants consumed in `cases.ts`.

The pin commit is dated 2026-10-24T10:55+02:00. A snapshot must be the issue as it stands at the pin, so any issue edited after that commit needs its later edits undone by hand.

- [ ] **Step 1: Check each issue was last edited before the pin**

Run, for `n` in 55 59 115 116 117 160:

```bash
gh issue view $n --json number,state,updatedAt,closedAt --jq '[.number,.state,.updatedAt,.closedAt]|@tsv'
```

Expected: every `updatedAt` earlier than `2026-10-24T08:55:15Z`. For any later one, read the issue's edit history on GitHub and undo the later edits in the captured JSON by hand, noting it in `source`. Then confirm none of the open ones is already done in the pinned tree: `git grep -il "native-licences" df83a116 -- scripts docs lib` must not show an implementation of #160 (the licences-sheet spec/plan only mention it).

- [ ] **Step 2: Capture**

Keep each fixture's existing `why` (read it from the current JSON first: `jq -r .why .claude/skills/escuadra-issue-runner/evals/_fixtures/issues/55.json`), then run, in an ordinary shell with the real `gh`:

```bash
node scripts/evals/capture-issue.ts 55  --why "<55's existing why>"
node scripts/evals/capture-issue.ts 59  --why "<59's existing why>"
node scripts/evals/capture-issue.ts 115 --why "<115's existing why>"
node scripts/evals/capture-issue.ts 116 --why "<116's existing why>"
node scripts/evals/capture-issue.ts 117 --why "<117's existing why>"
node scripts/evals/capture-issue.ts 160 --why "The issue asks the owner to pick route A (a hand-curated list with a drift check) or B (generated at build time), and touches the licence notices (guardrail 2's asset-licensing rule): the skill asks."
git rm .claude/skills/escuadra-issue-runner/evals/_fixtures/issues/126.json .claude/skills/escuadra-issue-runner/evals/_fixtures/issues/129.json
```

Expected: each prints `Wrote …`. `git diff --stat` shows what changed in 55/59/115/116/117: read each diff and confirm the changes are real edits since 2026-10-16, not noise.

- [ ] **Step 3: Work out each real case's expected `docs`**

For each of 55, 59, 115, 116, 117, 160 the docs are: every file under `docs/superpowers/` at the pin that cites `#N`, every doc the issue links, and the handoff for the issue's milestone. The visible paths, with the hidden ones excluded:

```bash
for n in 55 59 115 116 160; do echo "== #$n"; git grep -lE "#$n([^0-9]|\$)" df83a1164a826261f3c684aa225aacf801f40731 -- docs/superpowers | sed 's/^[^:]*://' | grep -vE 'issue-runner-evals'; done
ls docs/superpowers/handoff
jq -r '[.number,.milestone]|@tsv' .claude/skills/escuadra-issue-runner/evals/_fixtures/issues/{55,59,115,116,160}.json
```

The `v2.0.0` milestone's handoff is `docs/superpowers/handoff/2026-10-16-2-0-redesign-handoff.md`; `Platform Hardening` and `Google Play v1 Release` have none. In `cases.ts`, set each real case's `docs:` to those paths (as constants beside `HANDOFF`), replacing the old lists. Where an issue now has no doc, drop `docs` from that case's `expect`.

- [ ] **Step 4: Update `cases.ts` and the case-name test**

Replace the `117-owner-decision` case with:

```ts
  {
    name: '160-route-choice',
    why: 'The issue asks the owner to pick between two routes and touches licence notices: the skill asks.',
    tags: ['core', 'ask'],
    prompt: 'Take #160 and carry it through.',
    issues: [160],
    expect: triage({
      decision: 'ask',
      docs: [/* the paths from Step 3 for #160 */],
      questions:
        "one asks the owner to choose route A (a hand-curated native-licences list with a drift check in npm run check) or route B (generated at build time through CocoaPods' acknowledgements and Google's oss-licenses plugin), because the issue lists choosing between them as the owner's decision.",
    }),
  },
```

(Fill `docs` with the real paths; it must not contain a comment.) Leave `126-small-bug`, `129-large-spec` and `129-large-spec-subagent` for Task 4, which replaces them; for now delete them from `CASES` so the suite generates. Update the expected names in `scripts/evals/__tests__/suites.test.ts` (`'covers the matrix in spec §7, plus the smoke case'`): remove `117-owner-decision`, `126-small-bug`, `129-large-spec`, `129-large-spec-subagent`; add `160-route-choice`, `small-bug`, `large-spec`, `large-spec-subagent` (the last three arrive in Task 4).

- [ ] **Step 5: Check the other real expectations still hold at the pin**

Read each of the six snapshots against its case's `questions` text in `cases.ts`: `55-tbc` (still `[TBC]`? still store consoles), `59-gh-pages` (the gh-pages push and the Play badge rule), `116-release` (cutting a release branch, store assets), `115-closed` (closed; the STUDY_PLAN path exists at the pin), `neg-question` (#117's body still says Android bold Inter / IBM Plex fonts render in the system font). Edit a `questions`/`answered` text only if the snapshot no longer supports it, and say what changed in the commit body.

- [ ] **Step 6: Regenerate, test, commit**

Run: `node scripts/evals/gen-cases.ts` and `npx vitest run scripts/evals` (the case-name test fails until Task 4; every other test passes).

```bash
git add -A .claude/skills/escuadra-issue-runner/evals scripts/evals/__tests__/suites.test.ts
git commit -m "chore(evals): re-capture the real issues at the new pin; #160 replaces the closed #117 (#171)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The synthetic issues: re-check each, and replace #126 and #129

**Files:**

- Create: `_fixtures/issues/9010.json`, `_fixtures/issues/9011.json`, `_fixtures/docs/9011-spec.md` (all under `.claude/skills/escuadra-issue-runner/evals/`)
- Modify: `.claude/skills/escuadra-issue-runner/evals/cases.ts`
- Modify: `scripts/evals/__tests__/suites.test.ts` only if Task 3 left names to settle

**Interfaces:**

- Produces: cases `small-bug` (#9010), `large-spec` and `large-spec-subagent` (#9011); constants `FLAG_SPEC` (`docs/superpowers/specs/2026-10-20-flagged-players-design.md`).

- [ ] **Step 1: Check each existing synthetic still asks for what the pin lacks**

For #9001-#9009 read `_fixtures/issues/<n>.json` and grep the pinned tree for the thing it asks for, with `git grep -il '<term>' df83a1164a826261f3c684aa225aacf801f40731 -- app lib stores components`:

- #9004: a sort on Study's list view (`lib/studyView.ts`, `app/team/[squadId]/study.tsx`): is a sort already there?
- #9005, #9006: read the fixtures; the pin must not already have the button, tip or control they ask for.
- #9007: `lib/streakBadges.ts` must not exist at the pin (the case commits it as part 1).
- #9008: `lib/roundProgress.ts` must not exist at the pin (the case's PR branch adds it).
- #9001, #9002, #9003, #9009: bug and upgrade fixtures; confirm the files or packages they name exist (`@react-native-async-storage/async-storage` in `package.json` at the pin; for #9003 the case says upgrading it changes the fingerprint).

For any fixture the pin already satisfies, change what it asks for (keep its size, labels, docs and Work/Acceptance shape) and update the case's `why`/`questions` to match. Record each result as one line in the commit body.

- [ ] **Step 2: Write the small-bug fixture**

Create `_fixtures/issues/9010.json` (no board value disagrees with the body on purpose: the board says S, the body says M):

```json
{
  "number": 9010,
  "title": "fix(results): the Share button sits under the home indicator on iPhones",
  "state": "OPEN",
  "body": "**Size:** M\n\nOn an iPhone with a home indicator, Results' Share button is drawn under the indicator and the bottom edge of the button cannot be tapped. The bottom safe-area inset is not applied to the footer in `app/play/[squadId]/[level]/results.tsx`.\n\n### Work\n\n- [ ] Apply the bottom inset to Results' footer, so the button clears the indicator\n- [ ] A test for the inset arithmetic if it lives in `lib/resultsView.ts`\n\n### Acceptance criteria\n\n- [ ] On an iPhone with a home indicator the whole Share button is tappable (checked on a device)\n- [ ] `npm run check` passes",
  "comments": [],
  "labels": ["bug"],
  "milestone": "v2.0.0",
  "size": "S",
  "source": "synthetic",
  "why": "An S bug on clean main: in place, systematic-debugging. The board's S beats the body's M, and a device check is not a question."
}
```

Before keeping it, confirm `app/play/[squadId]/[level]/results.tsx` and `lib/resultsView.ts` exist at the pin (`git ls-tree -r --name-only df83a116 | grep -E 'results(View)?\.'`), and that `results.tsx` does not already use `useSafeAreaInsets` (`git show df83a116:'app/play/[squadId]/[level]/results.tsx' | grep -c useSafeAreaInsets`; if it does, name another footer file the pin lacks the inset in).

- [ ] **Step 3: Write the large-spec fixtures**

Create `_fixtures/issues/9011.json`:

```json
{
  "number": 9011,
  "title": "feat(study): flag players to review, and a round of just the flagged ones",
  "state": "OPEN",
  "body": "**Size:** L\n**Spec:** `docs/superpowers/specs/2026-10-20-flagged-players-design.md`\n\nWhile studying, flag the players you keep forgetting, then play a round of only those.\n\n### Work\n\n- [ ] `lib/flaggedPlayers.ts`, pure: toggle a flag, and pick a round's players from the flagged ones, with tests\n- [ ] A flag toggle on each Study card and list row\n- [ ] Persist the flags in `stores/progress.ts`\n- [ ] A \"Flagged\" round on the Difficulty screen when a squad has flagged players\n- [ ] About's \"What is stored on your device\" list counts the flags\n\n### Acceptance criteria\n\n- [ ] Flags survive an app restart and clear with Reset Escuadra\n- [ ] A Flagged round uses only flagged players, at every level\n- [ ] `npm run check` passes",
  "comments": [],
  "labels": ["enhancement"],
  "milestone": null,
  "size": "L",
  "source": "synthetic",
  "why": "An L feature with a spec and no plan: a worktree, writing-plans, and the execution mode asked up front (or answered by the prompt)."
}
```

Create `_fixtures/docs/9011-spec.md`:

```markdown
# Flagged players

**Status:** design, approved 2026-10-20. Issue: #9011.

## What

On Study, a flag on a player card or list row marks the player to review. Difficulty offers a
"Flagged" round when the squad has flagged players: the same questions, drawn only from them.

## How

- `lib/flaggedPlayers.ts` is pure: `toggleFlag(flags, playerId)` and `flaggedPool(squad, flags)`.
- The flags live in `stores/progress.ts`, per squad, and clear with Reset Escuadra.
- The question engine takes the pool as an argument; its distractors still come from the whole squad.
- Nothing leaves the device. About's list of what is stored on the device gains one entry.

## Delivery

Three parts, one PR each: the model, the Study toggle, the Flagged round.
```

Verify the thing is absent: `git grep -il "flagged\|toggleFlag" df83a1164a826261f3c684aa225aacf801f40731 -- lib stores app components` prints nothing, and `stores/progress.ts`, `app/team/[squadId]/difficulty.tsx` and `app/team/[squadId]/study.tsx` exist at the pin.

- [ ] **Step 4: Add the three cases to `cases.ts`**

Add near the other doc constants:

```ts
const FLAG_SPEC = 'docs/superpowers/specs/2026-10-20-flagged-players-design.md';
```

Add these cases after `CASES`'s first entry position (before `160-route-choice`), and add a `commits` entry to the two large-spec cases that commits the spec as history:

```ts
  {
    name: 'small-bug',
    why: "An S bug on clean main: in place, systematic-debugging. The board's S beats the body's M, and a device check is not a question.",
    tags: ['core', 'workspace'],
    prompt: 'Pick up #9010.',
    issues: [9010],
    expect: triage({
      decision: 'proceed',
      workspace: 'in-place',
      base: 'main',
      branch: { prefix: 'fix/9010-' },
      firstStep: 'systematic-debugging',
      execution: 'n/a',
      docs: [HANDOFF],
    }),
  },
  {
    name: 'large-spec',
    why: 'An L feature with a spec and no plan: a worktree, writing-plans, and the execution mode asked up front.',
    tags: ['core', 'workspace', 'ask'],
    prompt: "Let's do issue 9011.",
    issues: [9011],
    commits: [
      {
        message: 'docs(spec): flagged players (#9011)',
        files: [{ path: FLAG_SPEC, fixture: 'docs/9011-spec.md' }],
      },
    ],
    expect: triage({
      decision: 'ask',
      workspace: 'worktree',
      base: 'main',
      branch: { prefix: 'feat/9011-' },
      firstStep: 'writing-plans',
      execution: 'ask',
      docs: [FLAG_SPEC],
      questions:
        'one asks whether to run the plan with superpowers:subagent-driven-development or superpowers:executing-plans; none asks something the issue, the spec or CLAUDE.md already answers.',
    }),
  },
  {
    name: 'large-spec-subagent',
    why: 'The same issue with the execution mode given in the prompt: nothing is left to ask, so the skill proceeds.',
    tags: ['workspace'],
    prompt: 'Pick up #9011 and run the plan with subagents.',
    issues: [9011],
    commits: [
      {
        message: 'docs(spec): flagged players (#9011)',
        files: [{ path: FLAG_SPEC, fixture: 'docs/9011-spec.md' }],
      },
    ],
    expect: triage({
      decision: 'proceed',
      workspace: 'worktree',
      base: 'main',
      branch: { prefix: 'feat/9011-' },
      firstStep: 'writing-plans',
      execution: 'subagent-driven',
      docs: [FLAG_SPEC],
    }),
  },
```

(The spec-as-history pattern is the one `plan-half-done` uses.)

- [ ] **Step 5: Regenerate, test, commit**

Run: `node scripts/evals/gen-cases.ts && npx vitest run scripts/evals`
Expected: PASS, including the case-name list and the fixture-exists test.

Check the sandbox for the new cases: `T=$(mktemp -d) && mkdir "$T/w" && cd "$T/w" && TMPDIR="$T" node <repo>/scripts/evals/scaffold.ts <repo>/.claude/skills/escuadra-issue-runner/evals/large-spec && git log --oneline -2 && ls docs/superpowers/specs | grep flagged` shows the spec commit and file.

```bash
git add -A .claude/skills/escuadra-issue-runner/evals scripts/evals
git commit -m "chore(evals): synthetic small-bug and large-spec replace the closed #126 and #129 (#171)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `dry-run.md` and the harness README

**Files:**

- Modify: `.claude/skills/escuadra-issue-runner/evals/dry-run.md`
- Modify: `scripts/evals/README.md` (the "Bumping the pins" bullet and "What a run can and cannot do")
- Regenerate: the cases (`case.yaml` repeats the dry-run text)

- [ ] **Step 1: Rewrite the first two bullets of `dry-run.md`**

Replace the `CLAUDE.md` bullet with:

```markdown
- `CLAUDE.md` at the repository root is the project's instructions: guardrails, release rules and an index of rules in `.claude/rules/`. A real session would have it loaded already, so read it before anything else. Each topic's detail is a rule in `.claude/rules/`, and a real session loads a rule when it reads a file the rule covers: here, read the rule for each topic the request touches before you decide.
```

- [ ] **Step 2: Update `scripts/evals/README.md`**

In the "Bumping the pins" bullet, replace its last sentence (from "And `dry-run.md` must name…") with: "`dry-run.md` must tell the agent to read `CLAUDE.md` and the rule for each topic the request touches, since a run preloads none of them (`CLAUDE_CODE_DISABLE_CLAUDE_MDS=1`). The suite also declares `hidden` paths: they are removed from the clone and its history, so the skill under test and the expected answers are not reachable; a new file that holds answers belongs in that list."

In the first bullet of "What a run can and cannot do", append: "The clone holds only the pinned commits, with the suite's `hidden` paths removed from every one."

- [ ] **Step 3: Regenerate, test, commit**

Run: `node scripts/evals/gen-cases.ts && npx vitest run scripts/evals && npx prettier --check scripts/evals .claude/skills/escuadra-issue-runner`
Expected: PASS.

```bash
git add -A scripts/evals .claude/skills/escuadra-issue-runner/evals
git commit -m "docs(evals): dry run reads CLAUDE.md as an index and the rules it points to (#171)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Measure whether a rule loads on Read inside a run (controller-run)

**Files:**

- Temporarily modify, then revert: `.claude/skills/escuadra-issue-runner/evals/cases.ts` (a probe case); regenerate
- Modify: `docs/superpowers/specs/2026-10-16-issue-runner-evals-design.md` §11

A probe on Haiku, about $0.05 estimated, one session. Do not commit the probe case.

- [ ] **Step 1: Pick a marker**

Run `sed -n 1,20p .claude/rules/photos.md`; take the rule's first heading line (after the frontmatter) as `MARKER`, and confirm it does not occur in `lib/photos.ts` (`grep -c "<MARKER>" lib/photos.ts` is 0). `lib/photos.ts` is on the rule's `paths`.

- [ ] **Step 2: Add the probe case**

In `cases.ts`, add after `SMOKE` and put it in `cases: [SMOKE, PROBE, ...CASES]`:

```ts
const PROBE: EvalCase = {
  name: 'rules-probe',
  why: 'Does a .claude/rules rule load when the agent Reads a file it covers?',
  tags: ['probe'],
  prompt:
    'Use the Read tool on lib/photos.ts, once. Do not open anything under .claude. Then reply with the single word DONE.',
  issues: [],
  runs: 1,
  maxTurns: 6,
  timeoutSeconds: 300,
  expect: {
    kind: 'smoke',
    graders: [
      { type: 'regex', name: 'rule-loaded', target: 'trace', pattern: 'MARKER', weight: 1 },
    ],
  },
};
```

(replace `MARKER` with the escaped heading text), then `node scripts/evals/gen-cases.ts`.

- [ ] **Step 3: Run it**

Run: `node scripts/evals/run.ts --tag probe --ablation none --runs 1 --model haiku --judge-model sonnet --keep`
Expected: a results directory printed first. `rule-loaded` passing means the rule's text reached the trace after the Read; failing means it did not. To be sure it is not a trace-format artefact, also open the kept run's `out/trace.jsonl` and check whether the Read result for `lib/photos.ts` carries a `<system-reminder>` with the rule (remember: `chmod 700` only its `sealed/` folder if you want to look there; never run git in it).

- [ ] **Step 4: Revert the probe and record the result**

Remove `PROBE`, regenerate (`node scripts/evals/gen-cases.ts`), and confirm `git status` shows `cases.ts` and the generated folders unchanged from the last commit.

In spec §11, append item 8:

```markdown
8. **A rule loads on Read, or not (2026-10-24, Claude Code <version from `claude --version`>).**
   One Haiku probe in the pinned clone, with `CLAUDE_CODE_DISABLE_CLAUDE_MDS=1` set: the agent
   Read `lib/photos.ts`, which `.claude/rules/photos.md` covers. <State the result: the rule's
   text did / did not appear in the trace.> <If it did not:> A run therefore gets a rule only
   when the dry run tells it to Read the rule, which `dry-run.md` does.
```

Fill the angle-bracket parts with the real result and version (no brackets left in the file).

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-10-16-issue-runner-evals-design.md
git commit -m "docs(evals): measure whether a rule loads on Read inside a run (#171)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Re-run the baseline and the gate; record both (controller-run, owner asks first)

**Files:**

- Modify: `docs/superpowers/specs/2026-10-16-issue-runner-evals-design.md` (Outcome: new RED and GREEN sections; §5, §6, §7 to the new pins and cases)
- Possibly modify: `.claude/skills/escuadra-issue-runner/SKILL.md` or the suite, if a case misses (see Step 4)

- [ ] **Step 1: Confirm the smoke case after the sandbox change**

Run: `node scripts/evals/run.ts --tag smoke --model haiku --judge-model sonnet`
Expected: every grader passes (`git-works` now reads the pinned subject; the commit lands in the throwaway repo; `no-writes` holds). A failure here is a sandbox problem: fix it before any Sonnet run.

- [ ] **Step 2: Iterate on the core slice**

Run: `node scripts/evals/run.ts --tag core --runs 1` (about 8 cases × 2 arms, 16 sessions). Read the per-case failures; where a case fails in both arms for the same reason, suspect the suite (a stale expectation) before the skill. Use `--keep` to read a trace. Fix expectations in `cases.ts` (regenerate), not by loosening graders.

- [ ] **Step 3: Ask the owner before the full run**

Use AskUserQuestion. State the cost first: the full run is 19 graded cases × 2 arms × 3 runs = 114 Sonnet sessions (about 3 hours, roughly $35 estimated at API rates, drawn from the plan's usage limits). Options: the full both-arm run (recommended: the delta must be fresh, since the pins and cases changed); or the 57-session gate the owner chose last time (`--full --ablation none`) with the without arm taken from one both-arm pass at `--runs 1` (38 sessions) first, 95 in all. Do not launch until they answer.

- [ ] **Step 4: Run the gate**

Run the chosen command, concurrency left at the default of 1 (spec: 3 timed out on a claude.ai plan), for example: `node scripts/evals/run.ts --full`. Acceptance: with the skill, every case ≥ 0.9 over 3 runs; the suite-wide delta over the without arm is positive; no run wrote to GitHub or the repo (`no-writes`, `stayed-dry` pass).

If a case misses 0.9: read the kept trace for the case, then (a) a wrong or stale expectation, or a fixture wording that misleads: fix the suite and re-run that case only (`--case '<name>'`); (b) the skill misreads the new `CLAUDE.md` index or the rules: change `.claude/skills/escuadra-issue-runner/SKILL.md` minimally, note it for the PR, and re-run the failing cases and the `core` slice. Stop and tell the owner if a fix to the skill would change a gate or a rule rather than a wording.

- [ ] **Step 5: Record the Outcome**

In the spec, add to Outcome, above `### GREEN (2026-10-21)`, a section `### Re-pinned past #165 (2026-10-24)` with: the date and Claude Code version, the command, models, session count and cost; a table of every case with its without-arm and with-arm score over 3 runs; the mean of each arm and the delta; the failed graders for any case below 1.0; and the cases that changed and why (the list in "Decisions made in this plan"). Update §5 (pins and the new clone: fetched pins only, hidden paths removed from history, `scripts/evals` and the eval spec among them), §6 (the real-snapshot rule now says closed issues are replaced, not recorded open, when the pin contains their work) and §7 (the matrix: replace the 126/129/117 rows with `small-bug`, `large-spec`, `large-spec-subagent`, `160-route-choice`, and their descriptions). Use the real numbers from `result.json`; leave no placeholder.

- [ ] **Step 6: Commit**

```bash
git add -A docs/superpowers/specs/2026-10-16-issue-runner-evals-design.md .claude/skills/escuadra-issue-runner
git commit -m "docs(evals): the re-pinned baseline and gate (#171)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Check, push, open the PR

- [ ] **Step 1: Confirm no fingerprint change**

Run: `git diff --stat main...HEAD -- package.json package-lock.json app.json eas.json fingerprint.config.js .gitignore`
Expected: empty.

- [ ] **Step 2: `npm run check`**

Run: `nvm use && npm run check`
Expected: passes. Report its actual output. Fix anything it flags (Prettier on the new fixtures and markdown is the likeliest: `npx prettier --write` the files it names).

- [ ] **Step 3: Push and open the PR**

```bash
git push -u origin chore/171-eval-pins-past-165
gh pr create --title "chore(evals): move the eval pins past #165, so runs see CLAUDE.md and its rules (#171)" --body "<body>"
```

The body: what changed (new pins, the fetch-only-pins sandbox with `hidden` paths rewritten out of history, re-captured and replaced cases, `dry-run.md`), the rule-loading measurement, the RED and gate results from the spec's Outcome, the ticked Work list and acceptance criteria, `Closes #171`, and the trailer `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Stop there; never merge.

---

## Self-review

- **Spec/issue coverage:** pin move + skill kept out of the clone, history included (Tasks 1-2, verified in Task 2 Step 3 and the Task 1 tests); re-capture with closed-issue swaps (Tasks 3-4); synthetic check (Task 4 Step 1); `dry-run.md` (Task 5); rule-load measurement in §11 (Task 6); `release/1.0.0` pin kept after checking its head (Task 2 Step 1); RED baseline and gate in the Outcome (Task 7); no npm script / `.gitignore` / fingerprint change (Task 8 Step 1); `npm run check` (Task 8).
- **Placeholders:** the only data-dependent text is the doc paths of Task 3 Step 3 and the measured numbers of Tasks 6-7, each with the command that produces it.
- **Names:** `hidden` (`SandboxSetup`, `Suite`, `setupFor`, `HIDDEN`), `hideFromHistory`, `FLAG_SPEC`, and the case names `small-bug`, `large-spec`, `large-spec-subagent`, `160-route-choice` are used identically in Tasks 1-7.
