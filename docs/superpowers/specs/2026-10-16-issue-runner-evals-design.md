# escuadra-issue-runner and its evals

**Status:** approved 2026-10-16; built, with the results under Outcome. Issue:
[#136](https://github.com/tovmassian/escuadra/issues/136). Two sub-projects,
built in this order: the eval suite (§3–§9), then the skill written against it
(§2, §10). The contract in §2 is the skill's specification; the evals encode
it.

## Outcome

### RED baseline (2026-10-16)

Run on 2026-10-16 with Claude Code 2.1.278: `--full --ablation none --runs 1`, a Sonnet
agent, an Opus judge and the stub skill, $7.34 estimated, 11 minutes. At the time of the run, `--full` still
included the smoke case; it no longer does.

| Case                      | Score | Failed graders                                           |
| ------------------------- | ----- | -------------------------------------------------------- |
| `126-small-bug`           | 0.50  | decision, workspace, first-step, execution, docs         |
| `129-large-spec`          | 0.72  | first-step, execution, docs, questions                   |
| `129-large-spec-subagent` | 0.61  | decision, workspace, questions                           |
| `117-owner-decision`      | 0.91  | docs                                                     |
| `55-tbc`                  | 1.00  |                                                          |
| `59-gh-pages`             | 1.00  |                                                          |
| `116-release`             | 1.00  |                                                          |
| `115-closed`              | 0.73  | docs, questions                                          |
| `on-release-branch`       | 0.73  | workspace, first-step, execution                         |
| `shipped-fix-from-main`   | 0.53  | decision, workspace, first-step, execution               |
| `fingerprint-on-release`  | 1.00  |                                                          |
| `m-boundary`              | 0.73  | workspace, first-step, execution                         |
| `on-feature-branch`       | 0.93  | first-step                                               |
| `dirty-tree`              | 0.33  | decision, workspace, base, branch, first-step, execution |
| `plan-half-done`          | 0.83  | execution, questions                                     |
| `open-pr`                 | 0.60  | decision, workspace, execution                           |
| `no-size`                 | 0.88  | first-step, execution                                    |
| `neg-create-issue`        | 1.00  |                                                          |
| `neg-question`            | 1.00  |                                                          |

`sandbox-smoke` scored 0.5 on Sonnet, which declined the deliberate PR and commit
(`write-logged`, `commit-sandboxed` and `stayed-dry-fires` failed). It is a Haiku check
(`--tag smoke --model haiku`), and full runs now skip it.

8 of the 19 graded cases reach the 0.9 bar; the mean score is 0.79.

- The ask cases do not all pass already: `55-tbc`, `59-gh-pages`, `116-release` and
  `fingerprint-on-release` score 1.0 and `117-owner-decision` 0.91 (it misses `docs`), while
  `115-closed` (`docs`, `questions`), `129-large-spec` (`first-step`, `execution`, `docs`,
  `questions`), `129-large-spec-subagent` and `plan-half-done` (`execution`, `questions`) fall short.
- The proceed cases are where the baseline fails: of the 8, 4 miss `decision`, 6 miss
  `workspace`, 7 miss `first-step` and 7 miss `execution`.
- `docs` is missed by `115-closed`, `117-owner-decision`, `126-small-bug` and `129-large-spec`.
- `129-large-spec-subagent` misses `decision` (and `workspace`, `questions`), so it did not ask
  the open choices as expected.
- Both negative cases pass; `neg-create-issue` reached its 15-turn cap and still passed.

The run was not kept, so the final messages behind the proceed cases' misses (a different
decision, or a different line format) are not in the report; PR 2 starts with a `--keep`
run of the `core` tag to read them.

### GREEN (2026-10-21)

Run on 2026-10-21 with Claude Code 2.1.278: `--full --runs 3 --ablation none`, a Sonnet
agent, an Opus judge and the skill as merged, $17.66 estimated, 91 minutes. Every case
reaches the 0.9 bar; the mean is 0.98, against the RED baseline's 0.79. 52 of the 57 runs
pass on their own, and no run tried a GitHub write or changed git state.

| Case                      | RED  | GREEN (3 runs) |
| ------------------------- | ---- | -------------- |
| `126-small-bug`           | 0.50 | 0.91           |
| `129-large-spec`          | 0.72 | 1.00           |
| `129-large-spec-subagent` | 0.61 | 1.00           |
| `117-owner-decision`      | 0.91 | 1.00           |
| `55-tbc`                  | 1.00 | 1.00           |
| `59-gh-pages`             | 1.00 | 0.93           |
| `116-release`             | 1.00 | 1.00           |
| `115-closed`              | 0.73 | 0.93           |
| `on-release-branch`       | 0.73 | 1.00           |
| `shipped-fix-from-main`   | 0.53 | 0.93           |
| `fingerprint-on-release`  | 1.00 | 1.00           |
| `m-boundary`              | 0.73 | 1.00           |
| `on-feature-branch`       | 0.93 | 0.93           |
| `dirty-tree`              | 0.33 | 1.00           |
| `plan-half-done`          | 0.83 | 1.00           |
| `open-pr`                 | 0.60 | 1.00           |
| `no-size`                 | 0.88 | 1.00           |
| `neg-create-issue`        | 1.00 | 1.00           |
| `neg-question`            | 1.00 | 1.00           |

The delta is taken against the RED run above (one run, before the two suite fixes below)
rather than a fresh without-skill arm: the owner chose the 57-session gate over the
114-session one.

**How it got there.** A kept `core` run of the stub, two single passes of the whole suite
(12 then 16 of 19 cases passing) and the gate: about 105 Sonnet sessions, $33 estimated.
What the traces showed, and the line in the skill that answers it:

- `execution` filled with an implementation style when no plan runs, and the plan's mode
  chosen without asking: `execution` is how a plan runs, and the mode is the owner's (gate 8).
- Size read from the body, or from Status: `gh issue view --json projectItems` shows only
  Status, so the skill gives the GraphQL query for the board's Size.
- No run looked in `docs/superpowers/handoff/`: the milestone's handoff is a doc to list.
- Questions about how to implement, how to reproduce, or whether to continue an open PR:
  every question carries the gate it comes from (`[gate 3]`).
- `decision: ask` with `questions: none`, written while stopping for the dry run: `decision`
  follows from `questions`.
- An L issue with a linked spec sent to `brainstorming`: the first-step row is chosen by what
  exists, and a spec the issue links counts even when the issue rewrites a section of it.
- The skill not invoked in 3 of 17 positive runs, which read `CLAUDE.md` and went straight
  to `gh`: the description says when ("before running any command for it") and gives the
  owner's phrasings. Quoted, since an unquoted ` #N` starts a YAML comment and cut it short; a
  test now fails that.

Two suite fixes, which apply to both arms: `#9006` asked for a clear button the main pin
already has, so it is now a back-to-top button on Study; and the dry run's triage block is
for an existing issue, since the baseline agent printed one for opening an issue.

**Runner notes.** One judge result could not be reproduced: in the first single pass,
`129-large-spec-subagent`'s block failed 3 of 3 votes, while six replays of the runner's
judge prompt on the same text passed, and the case passed in every later run. The runner
counts a vote as PASS only when the reply holds `PASS` and no `FAIL`. Run at concurrency 1
on a claude.ai plan: at 3, a pass took 46 minutes instead of 30 and two runs timed out
mid-turn.

**Next round.** Three of the five runs that slipped in the gate wrote `decision: ask` with a
question no gate covers ("proceed or hold?", and a Modal-or-library choice for #126). The
counter, left out so that the skill merged is the one the gate ran: asking whether to proceed
is never a question, since invoking the skill was the go-ahead.

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
- the issue lists choices to settle before building (an "Open" section, or a
  question put to the owner), even when it names a default: ask, offering the
  default as the recommended answer;
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
`in-place | worktree | n/a`; `first-step` is one of `superpowers:brainstorming`, `writing-plans`,
`subagent-driven-development`, `executing-plans`, `systematic-debugging`,
`test-driven-development`, or `n/a`; `base`, `branch` and `first-step` are `n/a`
when the answer depends on a question asked.

## 3. Why Claude Code's built-in `claude plugin eval`

Claude Code 2.1.278 ships an eval runner that targets a single skill folder.
It provides a with-skill and a without-skill arm per case (the ablation is the
RED/GREEN comparison), repeated runs, LLM judges, cost ceilings, concurrency,
JSON results and an HTML report. A case is a folder holding one `case.yaml`:
`context.scaffold_script` (prepares the run's workspace), `execution`
(`prompt`, `max_turns`, `timeout_seconds`, `allowed_tools`,
`append_system_prompt`, `env`), `runs` and `graders` (`regex`, `tool_used`,
`tool_order`, `file_exists`, `llm`, `baseline`). A regex grader reads the last
message, the whole trace, or a file in the run's directory. (The `prompt.md`
plus `graders/*.md` form exists too, but cannot declare a scaffold.)

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

`evals/dry-run.md`, followed by the triage template from
`scripts/evals/lib/triage.ts`, is every case's `append_system_prompt`, given to
both arms. In substance:

> This is a dry run in a disposable copy of the repository. Read `CLAUDE.md`
> first: a real session would have it loaded. Do every read-only step you
> would do. Make no change to the repository, its branches or worktrees, or
> GitHub. If the request leads you to work on an existing issue, end your final message
> with the triage block, filled in; questions you would ask the owner go in
> the block, with `decision: ask`. Otherwise answer and leave the block out.

Eval runs set `CLAUDE_CODE_DISABLE_CLAUDE_MDS=1`, so `CLAUDE.md` is not
preloaded (§11). Telling both arms to read it restores the information a real
session has, without embedding 26 KB in every case. The instruction is
identical in both arms, so the delta measures what the skill adds to the
decisions, not whether the agent knew the format. On a negative case (§7) the
request does not lead to working an issue, and no block is expected.

## 5. The sandbox

The runner gives each run a fresh directory with a sandboxed `HOME` and
`TMPDIR`, and runs the case's `scaffold.sh` there, unsandboxed, as the owner.
Each generated `scaffold.sh` hands off to `scripts/evals/scaffold.ts`, which
builds:

```
$TMPDIR/origin.git/    bare clone of the real repo; its own `origin` removed;
                       only the pinned branches: main → deb2e3b9,
                       release/1.0.0 → d8f2d21b
$HOME/cwd/             clone of origin.git: the agent's working directory
  .git/sandbox/        issues/*.json, prs.json, gh.log (created empty)
  .git/sandbox/bin/    gh and git wrappers, the fake gh's code, package.json
```

- **Pinned commits** freeze the specs, plans and handoff to match the issue
  snapshots, and keep the skill out of the clone's reachable history (it is
  written after `deb2e3b9`), so the without arm really is without it. A local
  clone still carries the source repo's unreachable objects (other branches'
  commits); fetching only the pinned commits would close that, at the cost of
  a pack transfer the scaffold's 120 s may not allow. Bumping a pin is
  deliberate and goes with re-capturing the snapshots.
- **Project skills in the clone do not load** in eval runs, and neither do the
  owner's plugins (superpowers included): the run's config directory is
  sandboxed. Both arms see the same thing; `first-step` is graded as a name.
- **Per-case state** is applied on top: synthetic docs committed into
  `docs/superpowers/` as if they were history, `(#9007, part 1)` commits, an
  open-PR branch pushed to `origin.git`, a checked-out `release/1.0.0` or
  `feat/other`, a modified tracked file.
- **No `npm install`.** A triage never runs the app.

### 5.1 The fake `gh`

The agent runs under an OS sandbox that cannot read the real repo, so the fake
lives inside the sandbox: the scaffold copies `scripts/evals/sandbox/gh.ts` and
`gh-cli.ts` (Node built-ins only) into `.git/sandbox/bin/`, next to a `gh`
wrapper that runs them with Node 24 and a `package.json` that marks them as ES
modules. `run.ts` puts the **relative** entries `.git/sandbox/bin`,
`../.git/sandbox/bin` and `../../.git/sandbox/bin` first on `PATH`; they
resolve against the agent's working directory, so a `cd` one or two levels
down keeps the wrappers. The fake finds its fixtures through
`git rev-parse --git-common-dir`.

**`git` needs a wrapper too.** `/usr/bin/git` is Apple's xcrun shim, which
fails inside the sandbox (it cannot write its cache). The scaffold writes a
`.git/sandbox/bin/git` that runs the real binary (`$(git --exec-path)/git`)
directly, and sets `remote.origin.uploadpack` and `receivepack` to the real
helpers, which git otherwise also finds through the shim.

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

Four layers keep a run away from the real GitHub and the real repo:

1. The agent's OS sandbox: reading the real repo fails with "Operation not
   permitted", and writes outside the run's working directory fail.
2. The fake `gh` is first on `PATH`, refuses every write and logs it.
3. A real `gh` reached by mistake (say, after a `cd`) is not signed in: the
   sandboxed `HOME` has no gh config, and the runner passes only an allowlist
   of variables (`GH_TOKEN` is not among them, and a case may set only
   `EVAL_*` names).
4. `origin` is the sandbox's bare repo outside the working directory, so a
   stray push fails ("unpacker error").

The `no-writes` grader (§8) fails any run that tried a GitHub write. The skill
folder's `evals/`, where the expected answers live, is also out of reach: the
runner's permissions deny reading it.

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
- **A snapshot records the issue as it stands at the main pin.** An issue
  closed after the pin, by work the sandbox does not contain, is recorded open,
  and its `source` says so: #129 closed through #135 a few hours after
  `deb2e3b9`. Body edits made after the pin are undone too, not only state:
  #129's boxes were ticked after it.
- **Synthetic issues** (`#9001`…) only for boundaries no real issue covers,
  with their docs under `_fixtures/docs/`. Their wording follows the real
  issues' style (Size line, Work checklist, Acceptance criteria).
- A case's open PRs are declared in `cases.ts`, and land in the sandbox's
  `prs.json`.
- `#9000` belongs to `sandbox-smoke`, a cheap case outside the matrix that
  checks the sandbox itself: the fake `gh`, the `git` wrapper, a commit that
  succeeds inside the sandbox (allowed tools do not deny Bash; §11) and a logged
  write. It also proves `stayed-dry`'s pattern matches that commit in the trace,
  so a trace format change after an upgrade shows. Run it after a Claude Code
  upgrade, before anything else.

## 7. The case matrix

Starting state, unless a row says otherwise: `main`, clean tree, no open PR.

| Case                      | Source | Setup                                   | Decision          | Workspace · base             | First step                  |
| ------------------------- | ------ | --------------------------------------- | ----------------- | ---------------------------- | --------------------------- |
| `126-small-bug`           | #126   | —                                       | proceed           | in-place · main              | systematic-debugging        |
| `129-large-spec`          | #129   | —                                       | ask: execution    | worktree · main              | writing-plans               |
| `129-large-spec-subagent` | #129   | prompt asks for subagents               | ask: open choices | worktree · main              | writing-plans               |
| `117-owner-decision`      | #117   | —                                       | ask               | n/a                          | n/a                         |
| `55-tbc`                  | #55    | —                                       | ask               | n/a                          | n/a                         |
| `59-gh-pages`             | #59    | —                                       | ask               | n/a                          | n/a                         |
| `116-release`             | #116   | —                                       | ask               | n/a                          | n/a                         |
| `115-closed`              | #115   | issue closed                            | ask               | n/a                          | n/a                         |
| `on-release-branch`       | #9001  | on `release/1.0.0`                      | proceed           | in-place · release/1.0.0     | systematic-debugging        |
| `shipped-fix-from-main`   | #9002  | —                                       | proceed           | worktree · release/1.0.0     | systematic-debugging        |
| `fingerprint-on-release`  | #9003  | —                                       | ask               | n/a                          | n/a                         |
| `m-boundary`              | #9004  | M, no docs                              | proceed           | in-place · main              | brainstorming               |
| `on-feature-branch`       | #9005  | on `feat/other`                         | proceed           | worktree · main              | test-driven-development     |
| `dirty-tree`              | #9006  | a tracked file modified                 | proceed           | worktree · main              | test-driven-development     |
| `plan-half-done`          | #9007  | L; spec, plan, `(#9007, part 1)` merged | ask: execution    | worktree · main              | n/a (depends on the answer) |
| `open-pr`                 | #9008  | open PR #9101 on `fix/9008-…`           | proceed           | in-place · main, that branch | —                           |
| `no-size`                 | #9009  | no Size anywhere                        | proceed           | in-place · main              | systematic-debugging        |
| `neg-create-issue`        | —      | "open an issue for …"                   | no triage         | —                            | —                           |
| `neg-question`            | #117   | "what does #117 say about …?"           | no triage         | —                            | —                           |

What each real case tests: #126, an S bug in place, a size disagreement, a
device check that is not a question; #129, L to a worktree, finding spec
§2.4/§6/§8 and the handoff, the execution question (asked, or answered by the
prompt), and the issue's two open choices, the ball's depth and the trail
(asked in both cases, though the issue names defaults); #117, an issue that
hands the owner the release route; #55, `[TBC]`; #59, pushing `gh-pages` and
the store-badge licence rule while Play is not live; #116, the handoff as the primary doc and cutting a release branch;
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

| Grader              | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Weight | Cases                                          |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------- |
| `decision`          | regex `^decision:` followed by the expected value, which must not be the start of a longer one                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 3      | every positive case                            |
| `workspace`, `base` | regex                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 2 each | proceed cases and asks that do not change them |
| `branch`            | regex on `<type>/<N>-` (the exact name for `open-pr`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 1      | same                                           |
| `first-step`        | regex                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 1      | same, except `open-pr`, `plan-half-done`       |
| `execution`         | regex                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 1      | same                                           |
| `size`              | regex `(estimated)`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | 1      | `no-size`                                      |
| `docs`              | regex, one lookahead per required path                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 1      | cases with docs                                |
| `existing`          | regex on the PR or the part-1 commit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 1      | `open-pr`, `plan-half-done`                    |
| `questions`         | `llm`, concrete claims                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 2      | every ask case                                 |
| `no-writes`         | regex over `.git/sandbox/gh.log`, `not_contains WRITE`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 3      | every case                                     |
| `stayed-dry`        | regex over the trace: no Bash call that changes history, branches, tags, the index, tracked files or worktrees (commit, push, pull, merge, rebase, cherry-pick, revert, am, reset, restore, clean, rm, mv, stash, add, tag, branch create, delete, move or copy, `worktree add`/`remove`/`move`/`prune`, `switch -c`, `checkout -b`, `checkout --`); `git` counts only in command position, after wrappers and prefixes (`sudo`, `env`, `NAME=value`, `then`, `do`…) and the global options (`-C`, `-c`, `--no-pager`…), so quoted text such as `grep "git commit"` does not; the dry-run forms (`clean -n`, `rm --dry-run`, `reset --help`, `tag` that only lists) pass. Known limit: a `;` or `\|` inside a quoted string still counts as a command start | 2      | every triage and negative case                 |
| `no-triage`         | regex, `not_contains` `decision:`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | 3      | negative cases                                 |
| `answered`          | `llm`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 2      | negative cases                                 |

- No grader checks whether the skill fired. Under `--ablation none` (the RED
  run) a `tool_used: Skill` grader would be scored rather than shown, and a
  skill that never fires already shows as a failing case.
- Ask cases with an open answer skip `workspace`, `base` and `branch`: grading
  a guess at an answer that depends on the owner is noise.
- Weights follow the cost of an error: asking when the agent should have
  proceeded (or the reverse), or writing anything, is expensive; a slug in
  another style is cheap.
- `questions` claims are checkable: "asks which release route #117 takes",
  "asks nothing the issue or spec already answers". The scaffold creates
  `gh.log` empty, since a file grader needs the file to exist.
- **Allowed tools** are a backstop, not the measurement: `Read`, `Glob`,
  `Grep`, `Skill`, and `Bash` scoped to read-only `git` commands, `gh` (the
  fake refuses its writes, and logging them is the point), and read-only
  shell tools. The runner's sandbox approves every Bash command, so the list
  denies nothing in a run (§11); `stayed-dry` is what notices a run that acted.
  `EnterWorktree`, `Write` and `Edit` are not granted, so no grader checks for
  them; the runner may still refuse them.
- **Models:** the agent runs on Sonnet (`--model sonnet`) and the judge on
  Opus (`--judge-model opus`); the judge must differ from the agent.
- **Pass bar:** in the with arm, every case scores ≥ 0.9 (`--threshold 0.9`),
  and the suite-wide delta over the without arm is positive. The without arm
  is not gated; its scores are the RED record. `no-writes` (3) and
  `stayed-dry` (2) are points any compliant run earns, so at 0.9 any grader of
  weight 2 or more fails a run on its own, while one missed 1-point field
  passes (`126-small-bug`: 15/16 = 0.94; a wrong decision, 13/16 = 0.81). A
  case's score is the mean of its runs.

## 9. Layout and running

```
scripts/evals/                        the harness: skill-agnostic
  scaffold.ts                         entry: builds a run's sandbox
  gen-cases.ts                        entry: cases.ts → each case's files
  run.ts                              entry: wraps `claude plugin eval`
  capture-issue.ts                    entry: real issue → fixture snapshot
  sandbox/gh.ts, gh-cli.ts            the fake gh, copied into each sandbox
  lib/                                pure: triage format, YAML, graders,
                                      cases, sandbox build, run args, capture
  __tests__/                          mirrors lib/ and sandbox/, plus the
                                      suite-in-sync test
  README.md                           the front door: run, budget, pins, capture

.claude/skills/escuadra-issue-runner/
  SKILL.md
  evals/
    cases.ts                          the suite as typed data: the one source
    dry-run.md
    _fixtures/issues/*.json, _fixtures/docs/…
    <case>/case.yaml, scaffold.sh,    GENERATED; never edited by hand
           setup.json
```

- **Cases are generated** from `cases.ts`: each case's `case.yaml` repeats the
  dry-run text, the tool list and the shared graders, which hand-kept files
  would let drift. A Vitest test fails when the generated files drift from
  `cases.ts`, the pattern `gen:squads` uses for `data/index.json`. It sits
  under `scripts/`, which `vitest.config.ts`, `tsc`, ESLint and Prettier
  already cover, so `npm run check` runs it; importing `cases.ts` from it is
  what brings that file under `tsc`.
- **No YAML dependency.** `lib/yaml.ts` writes the few shapes a case uses
  (block maps and lists, JSON-quoted strings), and the generator formats the
  result with Prettier, so `format:check` agrees with it.
- **Tests never need the pinned history.** CI checks out one commit, so the
  sandbox tests build a throwaway source repo of their own.
- **No npm scripts and no `.gitignore` lines**, since both move the
  fingerprint. Commands run as `node scripts/evals/run.ts --tag core`
  (or `--case 129-*`, or `--full`). `run.ts` passes `--scaffold`, the models,
  `--threshold 0.9`, `--max-cost-usd` and `--no-publish`, prepends the
  relative `.git/sandbox/bin` entries (§5.1) to `PATH`, and sends
  `--output-dir` and `--report` to a temporary directory, so results never
  land in the repo. `--keep` adds
  `--keep-temp`: a run's trace survives only with it.
- **Tags:** `core` (one case per rule: about 8), `workspace`, `ask`, `negative`,
  and `smoke` for `sandbox-smoke`. The generator adds `graded` to every case but the smoke
  case, and `--full` runs `--tag graded`: the smoke case is a Haiku check that a Sonnet run
  would fail.
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

## 11. Spike results (2026-10-16)

The CLI documents little of this, so five one-case probes on Haiku (about
$0.04–0.07 estimated each, 30 s) and its own schema settled it before the plan
was written. Re-check after a Claude Code upgrade; `sandbox-smoke` covers most
of it.

1. **The case format.** `scaffold_script` lives in `case.yaml`
   (`context.scaffold_script`), as a path inside the case folder (`..` and
   absolute paths are refused). A case's `env` may set only `EVAL_*` names.
2. **The scaffold** runs as `bash <script>`, unsandboxed, for up to 120 s, in
   the run's working directory (`$HOME/cwd`), with the operator's `PATH`, a
   sandboxed `HOME` and `TMPDIR`, no `EVAL_*` variables, stdout discarded and
   stderr kept. `$0` is the script's absolute path, so it finds its case
   folder from that. A bare clone of this repo takes about 3 s.
3. **The agent** starts in the same directory, under an OS sandbox: the real
   repo and the scratch directory are unreadable, `~/.nvm` (Node) and system
   tools are readable, and writes outside the working directory fail. It
   inherits `PATH` but not `GH_*`. `CLAUDE_CODE_DISABLE_CLAUDE_MDS=1` is set,
   the config directory is sandboxed (no user plugins, no superpowers), and
   project skills in the working directory do not load. The skill under test
   loads as `<name>:<name>`.
4. **Paths outside the working directory** are denied by permission, the
   skill folder's `evals/` included, even when `Bash` is granted.
5. **`/usr/bin/git` fails** inside the sandbox (xcrun's cache), and so do
   git's transport helpers; §5.1's wrapper and config fix both. A relative
   `PATH` entry finds the wrappers.
6. **Cost:** `cost_usd` is an API-rate estimate on a claude.ai login. A run's
   trace exists only with `--keep-temp`; the kept directory is readable as is
   (its `out/trace.jsonl` included), and only its `sealed/` folder needs
   `chmod 700` to look. Never run git inside it.
7. **`allowed_tools` does not deny Bash.** The runner's sandbox approves every
   Bash command, so `git commit` succeeded in the smoke case. A case's tool
   list is a backstop for non-Bash tools only; `stayed-dry` grades whether a
   dry run stayed dry. File graders resolve their path from the run's working
   directory. A smoke run runs both arms by default (about $0.07–0.09
   estimated).
8. **A rule does not load on Read inside a run (2026-10-24, Claude Code 2.1.278).**
   One Haiku probe in the clone pinned past #165, with
   `CLAUDE_CODE_DISABLE_CLAUDE_MDS=1` set: the agent Read `lib/photos.ts`, which
   `.claude/rules/photos.md` covers, and the rule's text appeared nowhere in the
   trace (no `<system-reminder>` came with the Read result). A run therefore gets a
   rule only when the agent opens the rule file, which `dry-run.md` tells it to do for
   each topic the request touches. Re-check after a Claude Code upgrade.

## 12. Out of scope

- End-to-end runs that implement a fixture issue. One smoke case run by hand is
  the natural next step once the decision suite is green.
- Running evals in CI: every run is billed to a plan and needs credentials.
- Suites for other skills.
- MCP mocks: the skill under test reaches GitHub through `gh`, not MCP.
