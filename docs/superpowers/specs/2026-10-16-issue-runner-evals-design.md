# escuadra-issue-runner and its evals

**Status:** design, approved 2026-10-16. Issue:
[#136](https://github.com/tovmassian/escuadra/issues/136). Two sub-projects,
built in this order: the eval suite (§3–§9), then the skill written against it
(§2, §10). The contract in §2 is the skill's specification; the evals encode
it.

## 1. Problem

The owner wants one skill that takes an issue number and carries the issue
through: find the specs, plans and handoffs that cover it, stop and ask when
something needs the owner's judgement, and otherwise implement it autonomously
with the superpowers skills, in a worktree for large work and on the current
branch for small work.

A skill like this makes a dozen decisions before writing a line of code, and
each one is easy to get subtly wrong: the wrong base for a shipped-version fix,
a worktree stacked on someone else's branch, a question the issue already
answers, or no question where the owner had to decide. Reading the skill does
not show whether an agent follows it. So the skill is built test-first: an eval
suite measures an agent's decisions with and without the skill, the without
arm is the RED baseline, and the skill is done when the with arm passes.

## 2. The skill's behaviour contract

### 2.1 What it reads

- The issue: state, title, body, comments, labels, milestone.
- `Size`, the single-select field on the Escuadra project board, through
  GraphQL (`projectItems { fieldValueByName(name: "Size") }`). The board wins
  over a size written in the body; a disagreement is noted in the triage.
  A missing Size is estimated on `escuadra-issue-creator`'s scale and marked
  `(estimated)`.
- Docs in `docs/superpowers/{specs,plans,handoff}` that cite `#N`, are linked
  from the issue, or are the handoff for the issue's milestone. A handoff that
  covers the issue is binding context: its decisions are not re-litigated.
- Existing work: an open PR for the issue, a `*/N-*` branch, `(#N…)` commits on
  `main`. Plans never tick their checkboxes in this repo, so progress through a
  plan is read from git and PRs, never from the plan file.
- The current branch, and whether the working tree is clean.

### 2.2 The ask gate

The skill stops and asks, in **one batch**, when any of these hold:

- the issue is closed;
- the title carries `[TBC]`, or the issue leaves a choice to the owner;
- it touches a legal guardrail, or About text that needs a privacy, licensing
  or legal judgement (`CLAUDE.md` guardrails 2 and 7);
- it is a product-direction change no issue covers;
- the issue contradicts its spec or `CLAUDE.md`;
- the work needs anything published or built: an OTA update, a store build,
  `gh-pages`, a store console, or pushing a `release/*` branch;
- a fingerprint-moving change would land on a locked release branch;
- the work will execute a plan and the invocation did not name the execution
  mode (§2.4).

Otherwise it proceeds. These are **not** reasons to ask: a missing Size (it is
estimated), a size disagreement (the board wins), and verification that needs
a real device (the PR body carries a device checklist instead).

**The ask gate replaces the approval gates** inside `superpowers:brainstorming`
and `superpowers:writing-plans`. Invoking the skill is the owner's approval for
a spec or plan the agent writes on the way; they are committed without stopping
for review.

### 2.3 Workspace and base

**Base:** `release/X.Y.Z` for a fix to a shipped version whose issue names that
route; otherwise `main`. An issue that says a shipped version is affected but
leaves the route open goes to the ask gate (#117 is the real example).

| Situation                                                                     | Workspace                                     |
| ----------------------------------------------------------------------------- | --------------------------------------------- |
| L or XL                                                                       | worktree                                      |
| XS, S or M, on `main` or a `release/X.Y.Z` that is the right base, clean tree | in place: a new branch off the current branch |
| on any other branch, a dirty tree, or base ≠ current branch                   | worktree                                      |
| an open PR or branch for the issue exists                                     | that branch, by the same rules                |

- **M stays in place.** The owner's line is "more than M": only L and XL get a
  worktree by size.
- **In place never means committing to `main` or a release branch directly.**
  Every change in this repo lands as a PR; in place is `git switch -c` off the
  current branch.
- **Branch name:** `<type>/<N>-<slug>`, where `<type>` is the issue title's
  conventional-commit prefix (`fix`, `feat`, `docs`, `chore`…), as in
  `fix/125-streakchip-transform`.
- **Worktrees are made with git, then entered natively:**
  `git worktree add .claude/worktrees/<N>-<slug> -b <type>/<N>-<slug> <base>`,
  then `EnterWorktree(path)`. `EnterWorktree(name)` names the branch
  `worktree-<name>` (PR #134 shows it) and always starts from `origin/main`, so
  it can keep neither the convention nor a release base.
  `.claude/worktrees/` is already ignored through `.git/info/exclude`; never
  add a `.gitignore` line for it, since that moves the fingerprint.

### 2.4 First step and execution

| What exists           | First step                                                                     |
| --------------------- | ------------------------------------------------------------------------------ |
| a plan with work left | the plan's execution skill (below)                                             |
| a spec, no plan       | `superpowers:writing-plans`, then the execution skill                          |
| nothing, XS or S      | `superpowers:systematic-debugging` for a bug, else `test-driven-development`   |
| nothing, M            | `superpowers:brainstorming`, bounded path: a short design, no spec or plan     |
| nothing, L or XL      | `superpowers:brainstorming`, architectural path: spec, then plan, then execute |

**Execution mode.** A plan runs through `superpowers:subagent-driven-development`
or `superpowers:executing-plans`. If the invocation names one ("…with
subagents", "…inline"), that is the answer; otherwise the mode is one of the
batched questions, asked up front even when the plan does not exist yet, so the
rest of the run is uninterrupted.

### 2.5 Finish

`npm run check` passes, the branch is pushed, a PR is opened with
`Closes #N` (against the release branch for a shipped-version fix, with the
`git cherry-pick -x` follow-up to `main` noted in its body), and the skill
stops. It never merges, publishes an OTA update, starts a store build, or
pushes `gh-pages` or a `release/*` branch.

### 2.6 The triage block

Before acting, the skill prints its triage as the block below, then proceeds
(or stops, when it asked). This is a feature in its own right: the owner sees
what was found and decided before anything changes. The evals ask for the same
block from both arms (§4.2), so they grade decisions, not formatting.

````
```triage
issue: 126
size: S (board; body says M)
docs: docs/superpowers/handoff/2026-10-16-2-0-redesign-handoff.md
existing: none
decision: proceed
questions: none
execution: n/a
workspace: in-place
base: main
branch: fix/126-photo-credits-sheet
first-step: superpowers:systematic-debugging
```
````

One `key: value` per line. `questions:` may continue as `- …` lines.
Values: `decision` is `proceed | ask`; `execution` is
`subagent-driven | executing-plans | ask | n/a`; `workspace` is
`in-place | worktree | n/a`; `base`, `branch` and `first-step` are `n/a` when
the answer depends on a question asked.

## 3. Why Claude Code's built-in `claude plugin eval`

Claude Code 2.1.278 ships an eval runner that targets a single skill folder.
It provides a with-skill and a without-skill arm per case (the ablation is the
RED/GREEN comparison), repeated runs, LLM judges, cost ceilings, concurrency,
JSON results and an HTML report. A case is a folder: `prompt.md` (frontmatter:
`max_turns`, `timeout_seconds`, `allowed_tools`, `env`, `append_system_prompt`)
and `graders/*.md` (`regex`, `tool_used`, `tool_order`, `file_exists`, `llm`,
`baseline`). A `scaffold_script` prepares a workspace per run.

Rejected: a TypeScript harness of our own around `claude -p` (it would rebuild
the ablation, runs, budget and report), and skill-creator's Python tooling
(built for tuning a description's triggering and for side-by-side output
review, not for grading decisions).

The runner is experimental (`experimental.evals` in a plugin manifest); a
Claude Code upgrade can change its format. Re-run the suite after upgrading.

## 4. What a run is

### 4.1 Decisions only

Each run stops before the first irreversible step, and only the triage is
graded. A run is minutes, not the hours an implementation takes. End-to-end
runs (a fixture issue implemented through `npm run check` and a PR to a fake
remote) are out of scope for now (§12).

### 4.2 The dry-run instruction

`evals/dry-run.md` is every case's `append_system_prompt`, given to both arms:

> This is a dry run. Do every read-only step you would do for this request.
> If it leads you to work on an issue, stop at the first step that would
> change the repository, a branch, a worktree or GitHub; do not take it. End
> your final message with the triage block below, filled in.
> [the format from §2.6, with each field's allowed values]

The instruction is identical in both arms, so the delta measures what the skill
adds to the decisions, not whether the agent knew the format. On a negative
case (§7) the request does not lead to working an issue, and no block is
expected.

## 5. The sandbox

Every run gets a fresh sandbox, built by `scripts/evals/scaffold.sh`:

```
$SANDBOX/
  origin.git/        bare clone of the real repo; its own `origin` removed
                     main → deb2e3b9, release/1.0.0 → d8f2d21b (pinned)
  work/              clone of origin.git; the agent's working directory
    .git/sandbox/    this case's fixtures, read by the fake gh, and gh.log
```

- **Pinned commits** freeze the specs, plans and handoff to match the issue
  snapshots, and keep the skill out of the clone (it is written after
  `deb2e3b9`), so the without arm really is without it. The clone does carry
  `escuadra-issue-creator`, in both arms, as in real use. Bumping a pin is
  deliberate and goes with re-capturing the snapshots.
- **Per-case state** is applied on top: synthetic docs committed into
  `docs/superpowers/` as if they were history, `(#9007, part 1)` commits, an
  open-PR branch pushed to `origin.git`, a checked-out `release/1.0.0` or
  `feat/other`, a modified tracked file.
- **No `npm install`.** A triage never runs the app.

### 5.1 The fake `gh`

`scripts/evals/bin/gh` is a shell wrapper around `scripts/evals/fake-gh.ts`
(TypeScript run directly by Node 24). It finds its fixtures through
`git rev-parse --git-common-dir`, so it also works from a worktree.

- Serves `issue view`, `issue list`, `pr list`, `pr view` and `api graphql`.
  GraphQL answers with a superset of the issue (state, body, labels, milestone,
  `projectItems` with `fieldValueByName` for Size and `fieldValues`), so
  whatever query an agent writes resolves.
- `--json <fields>` filters keys and `--jq` runs the real `jq`, as in `gh`.
- Writes (`pr create`, `issue comment`, `issue edit`, `project item-edit`,
  `api` with `-X POST|PATCH|DELETE` or a `mutation`) are refused, logged as
  `WRITE …` in `gh.log`, and exit 1.
- Anything else is logged as `UNSUPPORTED …` and exits 1.

### 5.2 Safety

Three layers keep a run away from the real GitHub and the real repo:

1. The fake `gh` is first on `PATH`.
2. `GH_TOKEN` and `GH_CONFIG_DIR` (in each case's `env`) point at nothing, so a
   real `gh` reached by mistake cannot authenticate.
3. `origin` is the sandbox's bare repo, so a stray push stays inside it.

The `no-writes` grader (§8) fails any run that tried a GitHub write.

## 6. Fixtures

`.claude/skills/escuadra-issue-runner/evals/_fixtures/issues/<N>.json`:

```json
{
  "number": 126,
  "title": "fix: photo credits are cut off on iPhone; …",
  "state": "OPEN",
  "body": "…",
  "comments": [],
  "labels": ["bug"],
  "milestone": "v2.0.0",
  "size": "S",
  "source": "real snapshot 2026-10-16",
  "why": "S bug, in place; the body says M, the board says S"
}
```

- **Real snapshots** wherever a real issue sits on a decision; captured with
  `node scripts/evals/capture-issue.ts <N>` (real `gh`, run by hand) and
  committed, so later edits to the issue do not move the suite.
- **Synthetic issues** (`#9001`…) only for boundaries no real issue covers,
  with their docs under `_fixtures/docs/`. Their wording follows the real
  issues' style (Size line, Work checklist, Acceptance criteria).
- `prs.json` per case lists open PRs where a case needs one.

## 7. The case matrix

Starting state, unless a row says otherwise: `main`, clean tree, no open PR.

| Case                      | Source | Setup                                   | Decision       | Workspace · base             | First step                  |
| ------------------------- | ------ | --------------------------------------- | -------------- | ---------------------------- | --------------------------- |
| `126-small-bug`           | #126   | —                                       | proceed        | in-place · main              | systematic-debugging        |
| `129-large-spec`          | #129   | —                                       | ask: execution | worktree · main              | writing-plans               |
| `129-large-spec-subagent` | #129   | prompt asks for subagents               | proceed        | worktree · main              | writing-plans               |
| `117-owner-decision`      | #117   | —                                       | ask            | n/a                          | n/a                         |
| `55-tbc`                  | #55    | —                                       | ask            | n/a                          | n/a                         |
| `59-gh-pages`             | #59    | —                                       | ask            | n/a                          | n/a                         |
| `116-release`             | #116   | —                                       | ask            | n/a                          | n/a                         |
| `115-closed`              | #115   | issue closed                            | ask            | n/a                          | n/a                         |
| `on-release-branch`       | #9001  | on `release/1.0.0`                      | proceed        | in-place · release/1.0.0     | systematic-debugging        |
| `shipped-fix-from-main`   | #9002  | —                                       | proceed        | worktree · release/1.0.0     | systematic-debugging        |
| `fingerprint-on-release`  | #9003  | —                                       | ask            | n/a                          | n/a                         |
| `m-boundary`              | #9004  | M, no docs                              | proceed        | in-place · main              | brainstorming               |
| `on-feature-branch`       | #9005  | on `feat/other`                         | proceed        | worktree · main              | test-driven-development     |
| `dirty-tree`              | #9006  | a tracked file modified                 | proceed        | worktree · main              | test-driven-development     |
| `plan-half-done`          | #9007  | L; spec, plan, `(#9007, part 1)` merged | ask: execution | worktree · main              | n/a (depends on the answer) |
| `open-pr`                 | #9008  | open PR #9101 on `fix/9008-…`           | proceed        | in-place · main, that branch | —                           |
| `no-size`                 | #9009  | no Size anywhere                        | proceed        | in-place · main              | systematic-debugging        |
| `neg-create-issue`        | —      | "open an issue for …"                   | no triage      | —                            | —                           |
| `neg-question`            | #117   | "what does #117 say about …?"           | no triage      | —                            | —                           |

What each real case tests: #126, an S bug in place, a size disagreement, a
device check that is not a question; #129, L to a worktree, finding spec
§2.4/§6/§8 and the handoff, and the execution question (asked, or answered by
the prompt); #117, an issue that hands the owner the release route; #55,
`[TBC]`; #59, pushing `gh-pages` and the store-badge licence rule while Play is
not live; #116, the handoff as the primary doc and cutting a release branch;
#115, a closed issue. The synthetic ones each sit on one rule of §2.3–§2.4;
#9001 and #9002 name `release/1.0.0` as their route, as §2.3 requires;
`fingerprint-on-release` needs a native package upgrade; `plan-half-done`
tests resuming from git rather than checkboxes; `open-pr` tests reusing the
branch rather than making a second; `no-size` tests `(estimated)`.

Prompts are natural language and vary in wording ("Pick up #126", "Let's do
issue 129", "Take #117 and carry it through"), never a slash command: the
without arm has no such command, and the skill's description has to trigger on
how the owner actually asks.

## 8. Graders and the pass bar

| Grader              | Type                                                   | Weight | Cases                                    |
| ------------------- | ------------------------------------------------------ | ------ | ---------------------------------------- |
| `decision`          | regex `^decision:\s*(proceed\|ask)$`                   | 3      | every positive case                      |
| `workspace`, `base` | regex                                                  | 2 each | proceed cases and execution-only asks    |
| `branch`            | regex on `<type>/<N>-` (the exact name for `open-pr`)  | 1      | same                                     |
| `first-step`        | regex                                                  | 1      | same, except `open-pr`, `plan-half-done` |
| `execution`         | regex                                                  | 1      | same                                     |
| `size`              | regex `(estimated)`                                    | 1      | `no-size`                                |
| `docs`              | regex, one lookahead per required path                 | 1      | cases with docs                          |
| `existing`          | regex on the PR or the part-1 commit                   | 1      | `open-pr`, `plan-half-done`              |
| `questions`         | `llm`, concrete claims                                 | 2      | every ask case                           |
| `no-writes`         | regex over `.git/sandbox/gh.log`, `not_contains WRITE` | 3      | every case                               |
| `no-triage`         | regex, `not_contains` `decision:`                      | 3      | negative cases                           |
| `answered`          | `llm`                                                  | 2      | negative cases                           |
| `skill-fired`       | `tool_used: Skill` (with-only, never scored)           | —      | every case                               |

- Ask cases with an open answer skip `workspace`, `base` and `branch`: grading
  a guess at an answer that depends on the owner is noise.
- Weights follow the cost of an error: asking when the agent should have
  proceeded (or the reverse), or writing anything, is expensive; a slug in
  another style is cheap.
- `questions` claims are checkable: "asks which release route #117 takes",
  "asks nothing the issue or spec already answers". The scaffold creates
  `gh.log` empty, since a file grader needs the file to exist.
- **Allowed tools** are a backstop, not the measurement: `Read`, `Glob`,
  `Grep`, `Skill`, and `Bash` scoped to read-only `git`, `gh`, `ls` and `cat`.
  `EnterWorktree`, `Write` and `Edit` are not allowed, so no grader checks
  for them; a run that tries one is denied and still graded on its triage.
- **Models:** the agent runs on Sonnet (`--model sonnet`) and the judge on
  Opus (`--judge-model opus`); the judge must differ from the agent.
- **Pass bar:** in the with arm, every case scores ≥ 0.8 (`--threshold 0.8`),
  and the suite-wide delta over the without arm is positive. The without arm
  is not gated; its scores are the RED record.

## 9. Layout and running

```
scripts/evals/                        the harness: skill-agnostic
  scaffold.sh
  bin/gh, fake-gh.ts
  capture-issue.ts
  gen-cases.ts                        cases.ts → <case>/prompt.md + graders/*.md
  run.ts                              wraps `claude plugin eval`
  __tests__/                          fake-gh, gen-cases in sync, scaffold smoke
  README.md                           the front door: run, budget, pins, capture

.claude/skills/escuadra-issue-runner/
  SKILL.md
  evals/
    cases.ts                          the matrix as typed data: the one source
    dry-run.md
    _fixtures/issues/*.json, _fixtures/docs/…, _fixtures/prs/*.json
    <case>/prompt.md, graders/*.md    GENERATED; never edited by hand
```

- **Cases are generated** from `cases.ts`: 19 cases come to about 150 grader
  files. A Vitest test in `scripts/evals/__tests__/` fails when the generated
  files drift from `cases.ts`, the pattern `gen:squads` uses for
  `data/index.json`. It sits under `scripts/`, which `vitest.config.ts`,
  `tsc`, ESLint and Prettier already cover, so `npm run check` runs it.
- **No npm scripts and no `.gitignore` lines**, since both move the
  fingerprint. Commands run as `node scripts/evals/run.ts --tag core`
  (or `--case 129-*`, or `--full`). `run.ts` passes `--scaffold`, the models,
  `--threshold 0.8` and `--max-cost-usd`, prepends `scripts/evals/bin` to
  `PATH`, and sends `--output-dir` and `--report` to `$TMPDIR`, so results
  never land in the repo.
- **Tags:** `core` (one case per rule: about 8), `workspace`, `ask`, `negative`.
- **Skill-agnostic harness:** the sandbox and the fake `gh` know nothing of this
  skill, so another Escuadra skill could get a suite later. Nothing is built for
  that now.
- `CLAUDE.md`'s Reference docs gain one line linking `scripts/evals/README.md`.

### 9.1 Budget

The owner signs in with claude.ai, and the runner runs each case as a Claude
Code child on that credential. Runs draw on the plan's usage limits (the
5-hour window and the weekly caps), not on API billing; the `$` figures in the
report are API-rate estimates from token counts, and `--max-cost-usd` stops a
run on that estimate. A full suite is 19 cases × 2 arms × 3 runs = 114 short
sessions, a noticeable share of a 5-hour window. So: iterate on one tag with
`--runs 1`, and run the full suite before a change to the skill merges and
after a Claude Code upgrade. Opus is used only for judging, and occasionally
to confirm a result holds on the model the owner works with.

## 10. Delivery

One issue, opened through `escuadra-issue-creator` before the first PR, covers
both sub-projects.

1. **PR 1: the harness and the suite.** `SKILL.md` is a stub (frontmatter and
   a one-line body), so both arms behave as the baseline. The PR records the
   RED baseline: per-case scores without the skill, and what the failures were.
2. **PR 2: the skill.** Written against PR 1's failures. GREEN is the pass bar
   in §8. REFACTOR: re-run slices, and for any new way an agent slips, add a
   counter to the skill and, where it is a new decision, a case.

Each PR is on its own branch from `main`. The results are summarised in an
Outcome section added to this spec, as the photo POC's spec does.

## 11. Spike first

The CLI does not document these, so the plan opens with a one-case probe that
settles them before anything else is built:

1. How a `prompt.md` case declares `scaffold_script`, the script's working
   directory, its arguments and environment, and how it learns its case.
2. The agent's working directory, and whether it is the scaffold's workspace.
3. Whether the run inherits `PATH` from `claude plugin eval`, or the case's
   `env` must set it. If neither works, layer 2 of §5.2 still holds, and the
   fake `gh` moves to an absolute path the scaffold writes.
4. Whether `Bash(...)` patterns and `Read` path rules apply inside a run, and
   whether the with arm can read the skill folder's `evals/`. The expected
   answers live there; if the agent can read them, they move out of reach
   (the scaffold copies only the case's fixtures), or the leak is graded.
5. Whether user-level plugins (superpowers and its session-start hook) load in
   a run. Both arms see the same thing either way; this decides how realistic
   the run is, not how it is graded.
6. What a run's `cost_usd` reports on a claude.ai login.

## 12. Out of scope

- End-to-end runs that implement a fixture issue. One smoke case run by hand is
  the natural next step once the decision suite is green.
- Running evals in CI: every run is billed to a plan and needs credentials.
- Suites for other skills.
- MCP mocks: the skill under test reaches GitHub through `gh`, not MCP.
