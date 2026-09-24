---
name: escuadra-issue-creator
description: Use when creating a GitHub issue for Escuadra to gather project, milestone, size, and assignee metadata before opening
---

# Escuadra Issue Creator

## Overview

GitHub issues without proper metadata (project, milestone, size, assignee) create blind spots in the roadmap and project board. This skill ensures every issue lands with complete context, avoiding silent omissions and keeping the board synchronized.

**Core principle:** Discover available options first, then prompt for each field with context. Never create an issue without metadata.

## When to use

Use this skill whenever you create a GitHub issue for Escuadra:

- Bug reports ("animation stutter", "test failure")
- Feature requests ("add study screen", "persist scores")
- Refactoring work ("simplify question engine")
- Documentation updates
- Data additions

**NOT for:**

- PRs (use standard flow)
- Issues in other projects

## Before you create

**Optional setup — only if you intend to add the issue to a project board:**

```bash
# Grants the 'project' scope; triggers an interactive browser/device-code flow,
# so only run this when the user actually wants project assignment.
gh auth refresh -s project
```

If this scope isn't granted, skip project assignment gracefully (see step 2) rather
than prompting for it up front.

## Workflow

### 1. Gather Title & Description (User)

Ask the user:

> **Issue title:** [await input]
> **Description:** [await input]
> **Issue type:** Bug / Feature / Refactor / Doc / Data

**Title follows conventional-commit style**, matching the prefixes already used in
this repo's git history (`feat:`, `fix:`, `docs:`, `data:`, ...). Prefix the title
with the type mapped from the chosen issue type — see the canonical mapping in
[Quick Reference](#quick-reference) — e.g. issue type "Bug" + title "AsyncStorage
loses scores on force-close" becomes `fix: AsyncStorage loses scores on
force-close`. Don't double up if the user already typed a prefix themselves.

### 2. Discover Available Options (Silent)

Before prompting for metadata, enumerate what exists:

```bash
# Milestones (via API, since gh milestone doesn't exist)
# Note: `gh api` has no -R flag; the repo is already fully qualified in the path
gh api repos/tovmassian/escuadra/milestones --jq '.[].title'

# Available labels
gh label list -R tovmassian/escuadra --limit 100

# Projects (requires auth scope 'project')
# Note: This may fail if scope not granted; if so, skip project assignment
gh project list --owner tovmassian 2>/dev/null || echo "⚠️  Projects unavailable (needs auth scope 'project')"
```

**Store the results.** You need these for prompting. If a command fails, gracefully skip that field.

### 3. Gather Metadata (Prompted)

For each field, prompt with context:

**Assignee:**

> **Who should own this?** (yourself unless otherwise stated)

- Default to `@tovmassian` (the repo owner/maintainer)
- Ask only if the user specifies someone else

**Project:**

> **Add to project:** [list discovered projects with descriptions]

- Default: v0 planning board (if exists) or primary project
- Show which board it will appear on

**Milestone:**

> **Milestone:** [list open milestones]

- Default: current active milestone or none
- If more than one milestone is open, don't guess — list them all and ask the user
  to pick rather than silently defaulting
- Explain what the milestone contains

**Size:**

> **Complexity estimate:** XS / S / M / L / XL

- Escuadra does **not** use size labels — sizing is a `Size` single-select field
  on the **Escuadra project board** (Projects v2), with options `XS`, `S`, `M`,
  `L`, `XL`. It can only be set once the issue is an item on that project (see
  step 4), via `gh project item-edit` with the field's node ID — there is no
  `gh issue create` flag for it.
- Explain: what effort does "M" mean for Escuadra? (1-2 hours, ~200 lines)

**Labels (Type):**
Automatically apply based on issue type — see the canonical mapping in
[Quick Reference](#quick-reference). If the mapped label doesn't exist yet
(check against the discovered label list from step 2), offer to create it
rather than silently applying nothing. The same mapping also supplies the
title's conventional-commit prefix (step 1).

Show which labels will be applied, confirm.

### 4. Confirm & Create

Show the issue template before creation:

```
Title: [prefix][title]
Description: [description]

Metadata:
  Assignee: [assignee]
  Project: [project]
  Milestone: [milestone]
  Size: [size]
  Labels: [labels]
```

**Ask:** Create this issue? (y/n)

If yes, create with `gh issue create`. Write the title/description to temp files
first rather than interpolating raw user text into the command string — free-text
input can contain quotes, backticks, or `$(...)` that would break shell quoting or
get evaluated:

```bash
TITLE_FILE=$(mktemp)
BODY_FILE=$(mktemp)
printf '%s' "[title]" > "$TITLE_FILE"
printf '%s' "[description]" > "$BODY_FILE"

gh issue create \
  -R tovmassian/escuadra \
  --title "$(cat "$TITLE_FILE")" \
  --body-file "$BODY_FILE" \
  --assignee [assignee] \
  --label "[labels]" \
  [--milestone "[milestone]" if set]

rm -f "$TITLE_FILE" "$BODY_FILE"
```

`gh issue create` has no `--project` flag that also lets you set custom fields
like `Size` in one step, so project assignment and sizing always happen as a
follow-up (step 5), not inline here.

If no, loop back to step 1.

### 5. Add to Project & Set Size

`gh project item-add` returns the **project item ID** (`PVTI_...`), distinct
from the issue's own node ID — that's the ID `item-edit` needs:

```bash
ITEM_ID=$(gh project item-add 1 --owner tovmassian \
  --url https://github.com/tovmassian/escuadra/issues/ISSUE_NUM \
  --format json --jq '.id')
```

If the body contains control characters (multiline text) the `--jq` filter on
`item-add`'s own output can choke — if so, drop `--jq` and read `.id` from the
plain JSON output instead, or reuse the `ITEM_ID` printed in the command's
non-JSON output.

To set `Size`, resolve the project's node ID and the `Size` field's node ID
once per session (these are stable, so cache them for repeat use):

```bash
PROJECT_ID=$(gh project view 1 --owner tovmassian --format json --jq '.id')
gh project field-list 1 --owner tovmassian --format json \
  --jq '.fields[] | select(.name=="Size")'
# → gives the Size field's id and its XS/S/M/L/XL option ids
```

Then set the value — **by-name form is simpler and preferred** when you already
have the issue URL:

```bash
gh project item-edit --id "$ITEM_ID" \
  --project-id "$PROJECT_ID" \
  --field-id "<Size field node id>" \
  --single-select-option-id "<chosen option's node id>"
```

(There is also a `gh project item-edit <number> --owner ... --url ... --field "Size" --value "M"`
by-name form documented in `gh project item-edit --help`; the node-ID form
above is what's been verified to work end-to-end for this repo.)

Milestone and assignee are set at issue-creation time (step 4); only `Size`
and project membership need this separate step, since Escuadra's board is a
Projects v2 board and sizing is a custom field on it, not a label.

## Common mistakes

| Mistake                                          | Fix                                                                                                                                                         |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Use `gh milestone list` command (doesn't exist)  | Use `gh api repos/tovmassian/escuadra/milestones` instead                                                                                                   |
| Pass `-R` to `gh api`                            | `gh api` has no `-R` flag — the repo is already fully qualified in the path                                                                                 |
| Assume projects are always available             | Check auth scope; `gh auth refresh -s project` if missing                                                                                                   |
| Try to set Size via a label                      | Size is a Projects v2 field (`XS`/`S`/`M`/`L`/`XL`) on the Escuadra board, not a label — set it with `gh project item-edit` after `item-add`, not `--label` |
| Apply wrong label for issue type                 | Use the canonical mapping in [Quick Reference](#quick-reference), not a restated one                                                                        |
| Leave title without a conventional-commit prefix | Prefix with the type's mapping (`fix:`, `feat:`, `docs:`, ...); skip if the user already typed one                                                          |
| Silent assignee default to current user          | Always ask, but default to repo owner (@tovmassian) unless overridden                                                                                       |
| Forget to confirm before creating                | Show full issue template + metadata, ask "Create?" before `gh issue create`                                                                                 |
| Silently fail when projects unavailable          | Report clearly: "Projects require auth scope 'project'. Skipping project assignment."                                                                       |

## Quick reference

**Default values for Escuadra:**

- Assignee: `@tovmassian`
- Project: v0 planning board (if exists)
- Milestone: Highest-priority open milestone
- Size: Ask (no sensible default); set via the project board's `Size` field, not a label
- Labels: Type-based (bug/feature/refactor/doc/data)
- Title prefix: Type-based, conventional-commit style (`fix:`/`feat:`/`refactor:`/`docs:`/`data:`)

**Type → label / title-prefix mapping (canonical — verified against current repo
labels and commit history):**

```
bug        → label: bug            → title prefix: fix:
feature    → label: enhancement    → title prefix: feat:
refactor   → label: investigation  → title prefix: refactor:   (no dedicated "refactor" label exists; reuses "investigation")
doc        → label: documentation  → title prefix: docs:
data       → label: data           → title prefix: data:       (label doesn't exist yet; offer to create it)
```

**Size scale (Escuadra project board `Size` field — XS/S/M/L/XL):**

- XS: fix typo, small config change, copy tweak (<30 min)
- S: isolated bug fix, add one component (30 min - 1 hour)
- M: feature with multiple parts, refactor one module (1-2 hours)
- L: new subsystem, major refactor, complex feature (4+ hours)
- XL: multi-day effort, spans several modules or a new pipeline

**Escuadra milestones:** don't hardcode names — always discover the live list via
`gh api repos/tovmassian/escuadra/milestones` (step 2). Milestone names and how many
are open change over time.

## Example walkthrough

**Input:**

```
User: Create an issue for the offline persistence bug
```

**Workflow:**

1. **Gather context:**

   ```
   Issue title: AsyncStorage persistence lost on app close
   Description: Best scores not saved when app is force-closed
   Issue type: bug
   ```

2. **Discover options (silent):**

   ```
   Projects found: "v0 planning"
   Milestones: ["First release"]
   Labels: ["bug", "enhancement", "documentation", "investigation", ...]
   ```

3. **Prompt for metadata:**

   ```
   Assignee: @tovmassian (default, no change)

   Project: Add to "v0 planning"?
   - (shows: this is the active planning board)

   Milestone: "First release"?
   - (shows: N issues in this milestone)

   Size: [ask] M (1-2 hours debugging/fixing AsyncStorage) — set on the project board after creation

   Labels: [auto] bug (type-based)

   Title prefix: [auto] fix: (type-based)
   ```

4. **Confirm:**

   ```
   Title: fix: AsyncStorage persistence lost on app close
   Description: Best scores not saved when app is force-closed

   Metadata:
     Assignee: @tovmassian
     Project: v0 planning
     Milestone: First release
     Size: M
     Labels: bug

   Create? (y/n)
   ```

5. **Create, add to project, set size:**
   ```
   ✓ Issue #18 created
   https://github.com/tovmassian/escuadra/issues/18
   Added to project: Escuadra
   Size set: M
   ```

## Integration notes

- **Auth scope for projects**: `gh auth refresh -s project` once per session (only if you want to use project assignment)
- **Milestones require API**: Use `gh api repos/tovmassian/escuadra/milestones` not `gh milestone list`
- **Size is a project board field, not a label**: `Size` (XS/S/M/L/XL) lives on the Escuadra Projects v2 board; set it with `gh project item-edit` after `gh project item-add`, never `gh label create`
- **Project add / size set is always a follow-up step**: `gh issue create` has no flag that sets custom project fields; step 5 always runs after the issue exists
- **Batch creation**: For multiple issues, run this skill sequentially — one issue per invocation
- **Metadata override**: User can specify any field explicitly (skip discovery, use provided value)
- **Graceful degradation**: If projects unavailable (no auth scope), continue without adding to project board

## Red flags (when to stop & ask)

- [ ] Missing GitHub CLI authentication — error message will say so
- [ ] GitHub API call fails (milestone, labels, projects) — report error clearly, don't silently skip
- [ ] Projects unavailable due to missing `project` scope — report: "Skipping project assignment (auth scope required)"
- [ ] User provides issue type you don't recognize — ask to clarify: bug/feature/refactor/doc/data
- [ ] Label for issue type doesn't exist (e.g., no "data" label) — ask: should I create it?
- [ ] `gh project item-add`/`item-edit` fails — report the actual error; don't silently skip sizing
- [ ] Milestone list is empty — ask: should this issue have a milestone?
- [ ] Assignee doesn't exist in repo — ask: verify username (e.g., is it @tovmassian?)
