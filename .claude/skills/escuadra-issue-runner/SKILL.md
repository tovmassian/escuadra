---
name: escuadra-issue-runner
description: 'Use when asked to pick up, take, do, work on, continue or carry through an Escuadra GitHub issue by its number ("pick up #N", "let''s do issue N", "take #N and carry it through"), before running any command for it, even when the issue may be closed or done. Not for a question about an issue, or for opening one.'
---

# Escuadra issue runner

Carries one issue from its number to an open PR. Read everything, decide, print the triage
block, then either ask the owner once or work through to the PR without stopping.

**Invoking this skill is the owner's approval** for any spec or plan written on the way:
`superpowers:brainstorming` and `superpowers:writing-plans` commit theirs and go on, without
waiting for review. The one stop is the ask gate (step 2), and it asks everything at once.

A question about an issue ("what does #117 say about …?") is answered from the issue, and
opening one is `escuadra-issue-creator`. Neither gets a triage block.

## 1. Read

All of it, before deciding anything. `N` is the issue number.

```bash
gh issue view N --json number,title,state,body,comments,labels,milestone
gh api graphql -f query='{repository(owner:"tovmassian",name:"escuadra"){issue(number:N){projectItems(first:5){nodes{fieldValueByName(name:"Size"){... on ProjectV2ItemFieldSingleSelectValue{name}}}}}}}'
grep -rlE '#N([^0-9]|$)' docs/superpowers     # docs that cite the issue
ls docs/superpowers/handoff                   # the handoff for the issue's milestone
gh pr list --state all --search N --json number,title,state,headRefName,baseRefName
git branch -a --list '*/N-*'
git log main --oneline -E --grep '#N([^0-9]|$)'
git status --short --branch
```

- **Size** is the board's `Size` field, from the GraphQL query;
  `gh issue view --json projectItems` shows only Status (`Backlog`, `Done`), which is not
  Size. The board wins over a `**Size:**` line in the body: write a disagreement as
  `S (board; body says M)`. With no board value, use the body's, `S (body)`; with neither,
  estimate on `escuadra-issue-creator`'s scale, `S (estimated)`. Size is the whole issue's,
  even when part of it is done.
- **Docs** are the specs, plans and handoffs under `docs/superpowers/` that cover the issue:
  every one the issue links, every one that cites `#N`, and the handoff for the issue's
  milestone (`v2.0.0` → `…-2-0-…-handoff.md`), whether or not it names the issue. A handoff is
  binding: what it decided is not asked again. Code files are not docs.
- **Progress through a plan** comes from git and PRs: merged `(#N, part K)` commits are the
  parts that are done. Plans never tick their checkboxes in this repo.

## 2. The ask gate

`decision: ask` when any of these hold:

1. The issue is closed: ask whether anything is left to do, or whether to reopen it, and
   say in the question that it is closed. Fill in `docs` and `existing` first, as for any
   issue: a closed issue's work is in its docs and its commits.
2. The title carries `[TBC]`, or the issue leaves a choice to the owner ("the owner's
   decision", "decide the release route").
3. The issue lists choices to settle before building (an "Open" section, a question to the
   owner), even when it names a default. Ask, offering the default as the recommended answer.
4. It touches a legal guardrail (`CLAUDE.md` 2: crests, asset licences, store badges), or
   About text that needs a privacy, licensing or legal judgement (7).
5. It is a product-direction change no issue covers, or it contradicts its spec, `CLAUDE.md`
   or a rule in `.claude/rules/`.
6. The work needs something published or built: an OTA update, a store build, a `gh-pages`
   push, a store console (App Store Connect, the Play Console), or cutting or pushing a
   `release/*` branch.
7. A fingerprint-moving change (a dependency, an npm script, a `.gitignore` line, `app.json`,
   `eas.json`, `fingerprint.config.js`) would land on a release branch.
8. A plan will run (one has work left, or step 4 writes one) and the request did not say how:
   "with subagents" is `subagent-driven`, "inline" or "in this session" is `executing-plans`.
   The mode is the owner's to pick, never yours, so ask it now, before the plan exists.

Every question ends with the gate it comes from, as `[gate 3]`. A doubt that fits no gate is
not a question: the first step settles it, or the PR body notes it. That covers how to
implement the fix, how to reproduce a bug, a step in the issue's Work list that looks wrong,
whether to continue an open PR (continue it), a check on a real device (the PR body carries a
device checklist), plain About wording such as a count, and what `CLAUDE.md`, its rules, the
issue or its docs already settle.

Each question is one choice with its options, the recommended one first. When asking, still
fill in every field the answers cannot change; only the ones they can change are `n/a`.

## 3. Base and workspace

**Base** is `release/X.Y.Z` for a fix to a shipped version whose issue names that route, and
`main` otherwise. A shipped version affected with the route left open is gate 2.

**Workspace**, the first row that holds:

| Situation                                                | workspace                      |
| -------------------------------------------------------- | ------------------------------ |
| an open PR or a `*/N-*` branch carries unmerged work     | that branch, by the rows below |
| L or XL                                                  | `worktree`                     |
| the current branch is not the base                       | `worktree`                     |
| the tree is dirty (`git status --short` prints anything) | `worktree`                     |
| XS, S or M, on the base, clean                           | `in-place`                     |

- **M stays in place.** Only L and XL get a worktree by size.
- **In place** is a new branch off the current one, `git switch -c <branch>`, or `git switch`
  to the existing one. Never commit to `main` or `release/*` directly.
- **A worktree** is `git worktree add .claude/worktrees/N-<slug> -b <branch> <base>`, then
  `EnterWorktree` with that `path`. Never `EnterWorktree` with a `name`: it names the branch
  `worktree-<name>` and starts from `origin/main`. `.claude/worktrees/` is already ignored;
  a `.gitignore` line would move the fingerprint.
- **Branch** is `<type>/N-<slug>`: `<type>` is the title's conventional-commit prefix
  (`fix(about): …` → `fix`), the slug a few words of the title. An existing branch keeps its
  name, and the block names it alone.

## 4. First step and execution

The first row whose left column holds wins, whatever the size: an L issue with a spec starts
with `writing-plans`, not `brainstorming`.

| What exists for this issue  | first-step                                                   | execution          |
| --------------------------- | ------------------------------------------------------------ | ------------------ |
| a plan with work left       | the mode's skill, or `n/a` while the mode is asked           | the mode, or `ask` |
| a linked spec, no plan      | `superpowers:writing-plans`                                  | the mode, or `ask` |
| nothing, L or XL            | `superpowers:brainstorming`: spec, plan, then execute        | the mode, or `ask` |
| nothing, M                  | `superpowers:brainstorming`: a short design, no spec or plan | `n/a`              |
| nothing, XS or S, a bug     | `superpowers:systematic-debugging`                           | `n/a`              |
| nothing, XS or S, otherwise | `superpowers:test-driven-development`                        | `n/a`              |

- **`execution` is how a plan runs**, nothing else. With no plan to run, it is `n/a`. The
  modes are `subagent-driven` (`superpowers:subagent-driven-development`) and
  `executing-plans` (`superpowers:executing-plans`).
- **A bug** is a `fix` title or a `bug` label, and starts with systematic debugging even
  when the cause looks known.
- **A linked spec** is one the issue names (a `**Spec:**` line, a link into
  `docs/superpowers/specs/`) or one that cites `#N`. It counts even when it predates the
  issue, covers other issues too, or is a section the issue rewrites: the design is the spec
  plus the issue's body, and the plan comes next. A handoff is not a spec or a plan, and
  neither is a plan written for other issues.
- **An open PR** continues with the step its remaining work needs. On `proceed`,
  `first-step` is always a skill, never `n/a`.

## 5. The triage block

Print it before any change, filled in, as the last thing in the message:

```triage
issue: <number>
size: <XS|S|M|L|XL> (<board|estimated>; <a disagreement, if any>)
docs: <paths, comma-separated, or none>
existing: <open PR, branch or commits for the issue, or none>
decision: <proceed|ask>
questions: <none, or one per line below, each starting with "- ">
execution: <subagent-driven|executing-plans|ask|n/a>
workspace: <in-place|worktree|n/a>
base: <main|release/X.Y.Z|n/a>
branch: <type>/<number>-<slug>, or n/a
first-step: <superpowers:brainstorming|writing-plans|subagent-driven-development|executing-plans|systematic-debugging|test-driven-development, or n/a>
```

Each line is `key: value`, the value one of the template's choices; a short note may follow
in parentheses. `decision` follows from `questions`: `ask` when it lists one, `proceed` when
it is `none`. For an L feature with a spec, no plan, and one open choice:

```triage
issue: 9999
size: L (board)
docs: docs/superpowers/specs/2026-11-02-daily-challenge-design.md
existing: none
decision: ask
questions:
- The daily squad resets at local midnight (the issue's default, recommended) or at 00:00 UTC? [gate 3]
- Run the plan with superpowers:subagent-driven-development (recommended) or superpowers:executing-plans? [gate 8]
execution: ask
workspace: worktree
base: main
branch: feat/9999-daily-challenge
first-step: superpowers:writing-plans
```

## 6. Then

- **ask:** stop, and ask the questions in one message (`AskUserQuestion`, recommended option
  first). With the answers, go on from step 3.
- **proceed:** make the workspace, invoke the first step's skill, and work through to the
  PR. Stop again only if the work turns up a new ask-gate condition.

## 7. Finish

`npm run check` passes. Push the branch and open a PR with `Closes #N`: against the release
branch for a shipped-version fix, its body noting the `git cherry-pick -x` follow-up to
`main`, and with a device checklist when a check needs a real device. Then stop. Never merge,
publish an OTA update, start a store build, or push `gh-pages` or a `release/*` branch.
