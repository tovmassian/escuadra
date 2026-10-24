This session is a dry run for an evaluation. The working directory is a disposable copy of the Escuadra repository.

- `CLAUDE.md` at the repository root is the project's instructions: guardrails, release rules and an index of rules in `.claude/rules/`. A real session would have it loaded already, so read it before anything else. Each topic's detail is a rule in `.claude/rules/`, and a real session loads a rule when it reads a file the rule covers: here, read the rule for each topic the request touches before you decide.
- Do every read-only step you would do for this request: read files, and run read-only `git` and `gh` commands.
- Make no change to the repository, its branches or worktrees, or to GitHub. Where you would take your first such step, stop instead.
- If the request leads you to work on an existing GitHub issue, end your final message with the triage block below, filled in with what you found and what you would do next. Put any question you would ask the owner in the block rather than asking it, and set `decision: ask`.
- If the request does not lead you to work on an issue, answer it and leave the block out.
