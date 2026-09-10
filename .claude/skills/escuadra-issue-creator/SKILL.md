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

> **Complexity estimate:** Trivial / Small / Medium / Large

- If size labels exist (size-trivial, size-small, etc.), map the choice to labels
- If size labels don't exist yet, ask the user which label(s) to add and propose creating them in one batch
- Explain: what effort does "Medium" mean for Escuadra? (1-2 hours, ~200 lines)
- **As of now:** Escuadra has no size labels; offer to create them or ask: "Should I add a size label?"

**Labels (Type):**
Automatically apply based on issue type — see the canonical mapping in
[Quick Reference](#quick-reference). If the mapped label doesn't exist yet
(check against the discovered label list from step 2), offer to create it
rather than silently applying nothing.

Show which labels will be applied, confirm.

### 4. Confirm & Create

Show the issue template before creation:

```
Title: [title]
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
  [--milestone "[milestone]" if set] \
  [--project "[project]" if supported]

rm -f "$TITLE_FILE" "$BODY_FILE"
```

If no, loop back to step 1.

### 5. Link to Project (If CLI Can't)

If `gh issue create --project` doesn't work (GitHub API limitation), the simplest
fix is to add it via the web UI. If a scripted fallback is needed, `addProjectV2ItemById`
takes a project **node ID** and issue **node ID** (both GraphQL `ID`, not numbers),
and the query must be piped in with `-f query=@-`:

```bash
# Get the project's node ID (not its number) and the issue's node ID first:
PROJECT_ID=$(gh project view PROJECT_NUMBER --owner tovmassian --format json --jq '.id')
ISSUE_ID=$(gh issue view ISSUE_NUM -R tovmassian/escuadra --json id --jq '.id')

gh api graphql -f query=@- -F projectId="$PROJECT_ID" -F itemId="$ISSUE_ID" << 'EOF'
mutation($projectId: ID!, $itemId: ID!) {
  addProjectV2ItemById(input: {projectId: $projectId, contentId: $itemId}) {
    item {
      id
    }
  }
}
EOF
```

## Common mistakes

| Mistake                                         | Fix                                                                                |
| ----------------------------------------------- | ----------------------------------------------------------------------------------- |
| Use `gh milestone list` command (doesn't exist) | Use `gh api repos/tovmassian/escuadra/milestones` instead                           |
| Pass `-R` to `gh api`                           | `gh api` has no `-R` flag — the repo is already fully qualified in the path         |
| Assume projects are always available            | Check auth scope; `gh auth refresh -s project` if missing                           |
| Ask for size label when none exist              | Check available labels first; offer to create them or skip size field               |
| Apply wrong label for issue type                | Use the canonical mapping in [Quick Reference](#quick-reference), not a restated one |
| Silent assignee default to current user         | Always ask, but default to repo owner (@tovmassian) unless overridden               |
| Forget to confirm before creating               | Show full issue template + metadata, ask "Create?" before `gh issue create`         |
| Silently fail when projects unavailable         | Report clearly: "Projects require auth scope 'project'. Skipping project assignment." |

## Quick reference

**Default values for Escuadra:**

- Assignee: `@tovmassian`
- Project: v0 planning board (if exists)
- Milestone: Highest-priority open milestone
- Size: Ask (no sensible default)
- Labels: Type-based (bug/feature/refactor/doc/data)

**Labels to apply by type (canonical mapping — verified against current repo labels):**

```
bug        → bug
feature    → enhancement
refactor   → investigation   (no dedicated "refactor" label exists; reuses "investigation")
doc        → documentation
data       → data (doesn't exist yet; offer to create it)
```

**Size scale (if using labels):**

- Trivial: fix typo, small config change (<30 min)
- Small: isolated bug fix, add one component (30 min - 1 hour)
- Medium: feature with multiple parts, refactor one module (1-2 hours)
- Large: new subsystem, major refactor, complex feature (4+ hours)

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
   Issue title: Fix AsyncStorage persistence on app close
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

   Size: [ask] Medium (1-2 hours debugging/fixing AsyncStorage)

   Labels: [auto] bug (type-based)
   ```

4. **Confirm:**

   ```
   Title: Fix AsyncStorage persistence on app close
   Description: Best scores not saved when app is force-closed

   Metadata:
     Assignee: @tovmassian
     Project: v0 planning
     Milestone: First release
     Size: Medium
     Labels: bug

   Create? (y/n)
   ```

5. **Create & confirm:**
   ```
   ✓ Issue #18 created
   https://github.com/tovmassian/escuadra/issues/18
   Added to project: v0 planning
   ```

## Integration notes

- **Auth scope for projects**: `gh auth refresh -s project` once per session (only if you want to use project assignment)
- **Milestones require API**: Use `gh api repos/tovmassian/escuadra/milestones` not `gh milestone list`
- **Size labels don't exist yet**: Offer to create trivial/small/medium/large labels in bulk, or skip size field
- **GraphQL fallback for project assignment**: If CLI `--project` flag doesn't work, use the GraphQL API example (see step 5)
- **Batch creation**: For multiple issues, run this skill sequentially — one issue per invocation
- **Metadata override**: User can specify any field explicitly (skip discovery, use provided value)
- **Graceful degradation**: If projects unavailable (no auth scope), continue without adding to project board

## Red flags (when to stop & ask)

- [ ] Missing GitHub CLI authentication — error message will say so
- [ ] GitHub API call fails (milestone, labels, projects) — report error clearly, don't silently skip
- [ ] Projects unavailable due to missing `project` scope — report: "Skipping project assignment (auth scope required)"
- [ ] User provides issue type you don't recognize — ask to clarify: bug/feature/refactor/doc/data
- [ ] Label for issue type doesn't exist (e.g., no "data" label) — ask: should I create it?
- [ ] Size labels don't exist — ask: should I create them (trivial/small/medium/large)?
- [ ] Milestone list is empty — ask: should this issue have a milestone?
- [ ] Assignee doesn't exist in repo — ask: verify username (e.g., is it @tovmassian?)
