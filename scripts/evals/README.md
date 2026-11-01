# Evals

A harness for grading how an agent does a task with and without a skill, using Claude Code's `claude plugin eval`. Each skill's suite lives in its own `.claude/skills/<skill>/evals/`; this folder knows none of them. Design: [the eval spec](../../docs/superpowers/specs/2026-10-16-issue-runner-evals-design.md).

## Run a suite

Every run draws on your Claude plan's usage limits; each suite's section below says what a full gate costs. Start small:

| What                                                                                         | Command                                                                                    |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Check the sandbox with the suite's `smoke` case, if it has one (after a Claude Code upgrade) | `node scripts/evals/run.ts --suite <skill> --tag smoke --model haiku --judge-model sonnet` |
| A slice, once each, while iterating                                                          | `node scripts/evals/run.ts --suite <skill> --tag core --runs 1`                            |
| One case                                                                                     | `node scripts/evals/run.ts --suite <skill> --case '<case>'`                                |
| Every graded case (not the smoke case), before a skill change merges                         | `node scripts/evals/run.ts --suite <skill> --full`                                         |

Use `--full` on its own; combined with `--tag`, which cases run depends on how the runner combines tags.

The defaults are a Sonnet agent, an Opus judge, a pass threshold of 0.9 per case, a $15 ceiling (estimated at API rates) and both arms, the eval runner's default (`--ablation with-without`). The results directory is printed first, and holds `report.html` and `result.json`. Nothing is written to the repo, and nothing is published.

To see why a run failed, add `--keep`. The run's directory is kept, and its `out/trace.jsonl` is readable as it is; only its `sealed/` folder needs `chmod 700` before you can look inside. Never run git inside the run's directory.

## Change a suite

- **Cases** are data in the suite's `evals/cases.ts`. Edit them, then run `node scripts/evals/gen-cases.ts`, which regenerates every suite (`gen-cases.ts --suite <skill>` regenerates one). Never edit a case's `case.yaml`, `scaffold.sh` or `setup.json`: `npm run check` fails when they drift.
- **A real issue** becomes a fixture in the suite's `evals/_fixtures/issues/` with `node scripts/evals/capture-issue.ts <number> --suite <skill> --why "<what it tests>"`. A snapshot records the issue as it stands at the main pin, so compare the issue's last edit and close times with the pin's commit date, and undo body edits and state changes made after it by hand, saying so in `source`.
- **Bumping the pins** (`pins` in the suite's `cases.ts`) means re-capturing the real issues and checking every expectation still holds at the new commit. Check the synthetic issues too: each must ask for something the new pin does not already have.
- **Hidden paths** (`hidden` in the suite's `cases.ts`) are removed from the clone and its history, so the skill under test and the expected answers are not reachable; a new file that holds answers belongs in that list.

## Add a suite for another skill

1. `.claude/skills/<skill>/evals/cases.ts` exports `SUITE: Suite<E>` ([`lib/cases.ts`](lib/cases.ts)): the pins, the hidden paths, the tools, the cases, the `grade` function for the suite's own expectation type `E`, and optionally `dryRunAppendix`.
2. `dry-run.md` beside it is required: it is every graded case's system prompt, followed by `dryRunAppendix`.
3. Expectation types and their graders, and their tests in `evals/__tests__/`, stay in the suite: the harness adds `no-writes` and `stayed-dry` after them, and a `smoke` case carries its own graders.
4. List the skill folder in `hidden`: see **Hidden paths** above.
5. Give every issue a case loads a `_fixtures/issues/<number>.json`, captured as in **A real issue** above or written by hand for a synthetic one; the in-sync test fails without it.
6. Generate the cases: see **Cases** above.

## What a run can and cannot do

The runner gives each run a fresh directory and an OS sandbox (spec §11):

- The agent cannot read the real repo or write outside its directory. The clone holds only the pinned commits, with the suite's `hidden` paths removed from every one.
- It gets no `CLAUDE.md` preloaded, no user plugins and no project skills.
- `gh` is a fake that answers from fixtures and refuses writes.
- `git` is a wrapper around the real binary, because macOS's `/usr/bin/git` shim fails inside the sandbox.
- A case's `allowed_tools` does not deny Bash: the runner's sandbox approves every command. Only the dry-run instruction keeps a run from acting, and the `stayed-dry` grader fails a run whose Bash calls changed history, branches or worktrees.
- A case's `env` may set only `EVAL_*` names.

## Suites

### escuadra-issue-runner

Grades the triage block the issue runner prints before it works ([`evals/`](../../.claude/skills/escuadra-issue-runner/evals/)): `triage.ts` holds the template, `graders.ts` a regex per field and the LLM judges. A full gate is about 130 sessions and $45; what past runs cost, in sessions, estimated dollars and time, is in the spec's [Run costs](../../docs/superpowers/specs/2026-10-16-issue-runner-evals-design.md#run-costs) table. One case, for example: `node scripts/evals/run.ts --suite escuadra-issue-runner --case 'open-pr'`. Its `dry-run.md` must tell the agent to read `CLAUDE.md` and the rule for each topic the request touches, since a run preloads none of them (`CLAUDE_CODE_DISABLE_CLAUDE_MDS=1`).
