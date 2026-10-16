# Evals

Grades how an agent triages an Escuadra issue, with and without a skill, using Claude Code's `claude plugin eval`. Design: [`docs/superpowers/specs/2026-10-16-issue-runner-evals-design.md`](../../docs/superpowers/specs/2026-10-16-issue-runner-evals-design.md). The suite: [`.claude/skills/escuadra-issue-runner/evals/`](../../.claude/skills/escuadra-issue-runner/evals/).

## Run it

Every run draws on your Claude plan's usage limits. Start small:

| What                                                                 | Command                                                                    |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Check the sandbox (after a Claude Code upgrade)                      | `node scripts/evals/run.ts --tag smoke --model haiku --judge-model sonnet` |
| A slice, once each, while iterating                                  | `node scripts/evals/run.ts --tag core --runs 1`                            |
| One case                                                             | `node scripts/evals/run.ts --case 'open-pr'`                               |
| Every graded case (not the smoke case), before a skill change merges | `node scripts/evals/run.ts --full`                                         |

The defaults are a Sonnet agent, an Opus judge, a pass threshold of 0.9 per case, a $15 ceiling (estimated at API rates) and both arms, the eval runner's default (`--ablation with-without`). The results directory is printed first, and holds `report.html` and `result.json`. Nothing is written to the repo, and nothing is published.

To see why a run failed, add `--keep`. The run's directory is kept, and its `out/trace.jsonl` is readable as it is; only its `sealed/` folder needs `chmod 700` before you can look inside. Never run git inside the run's directory.

## Change the suite

- **Cases** are data in [`cases.ts`](../../.claude/skills/escuadra-issue-runner/evals/cases.ts). Edit them, then run `node scripts/evals/gen-cases.ts`. Never edit a case's `case.yaml`, `scaffold.sh` or `setup.json`: `npm run check` fails when they drift.
- **A real issue** becomes a fixture with `node scripts/evals/capture-issue.ts <number> --why "<what it tests>"`. A snapshot records the issue as it stands at the main pin, so compare the issue's last edit and close times with the pin's commit date, and undo body edits and state changes made after it by hand, saying so in `source`.
- **Bumping the pins** (`PINS` in [`cases.ts`](../../.claude/skills/escuadra-issue-runner/evals/cases.ts)) means re-capturing the real issues and checking every expectation still holds at the new commit.

## What a run can and cannot do

The runner gives each run a fresh directory and an OS sandbox (spec §11):

- The agent cannot read the real repo or write outside its directory.
- It gets no `CLAUDE.md` preloaded, no user plugins and no project skills.
- `gh` is a fake that answers from fixtures and refuses writes.
- `git` is a wrapper around the real binary, because macOS's `/usr/bin/git` shim fails inside the sandbox.
- A case's `allowed_tools` does not deny Bash: the runner's sandbox approves every command. Only the dry-run instruction keeps a run from acting, and the `stayed-dry` grader fails a run whose Bash calls changed history, branches or worktrees.
- A case's `env` may set only `EVAL_*` names.
