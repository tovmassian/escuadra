---
name: escuadra-issue-creator
description: Use when creating a GitHub issue for Escuadra to gather project, milestone, size, and assignee metadata before opening
---

# Escuadra Issue Creator

## Overview

GitHub issues without proper metadata (project, milestone, size, assignee) create blind spots in the roadmap and project board. This skill ensures every issue lands with complete context, avoiding silent omissions and keeping the board synchronized.

**Core principle:** Discover available options first, then prompt for each field with context. Never create an issue without metadata.

## When to Use

Use this skill whenever you create a GitHub issue for Escuadra:

- Bug reports ("animation stutter", "test failure")
- Feature requests ("add study screen", "persist scores")
- Refactoring work ("simplify question engine")
- Documentation updates
- Data additions

**NOT for:**

- PRs (use standard flow)
- Issues in other projects

## Before You Create

**Required setup (one-time):**

```bash
# Ensure GitHub CLI is authenticated and has project scope
gh auth refresh -s project
```

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
gh api -R tovmassian/escuadra repos/tovmassian/escuadra/milestones --jq '.[].title'

# Available labels
gh label list -R tovmassian/escuadra --limit 100

# Projects (requires auth scope 'read:project')
# Note: This may fail if scope not granted; if so, skip project assignment
gh project list --owner tovmassian 2>/dev/null || echo "⚠️  Projects unavailable (needs auth scope 'read:project')"
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
- Explain what the milestone contains

**Size:**

> **Complexity estimate:** Trivial / Small / Medium / Large

- If size labels exist (size-trivial, size-small, etc.), map the choice to labels
- If size labels don't exist yet, ask the user which label(s) to add and propose creating them in one batch
- Explain: what effort does "Medium" mean for Escuadra? (1-2 hours, ~200 lines)
- **As of now:** Escuadra has no size labels; offer to create them or ask: "Should I add a size label?"

**Labels (Type):**
Automatically apply based on issue type:

- Bug → `bug` label
- Feature → `enhancement` label
- Refactor → `refactor` label
- Doc → `documentation` label
- Data → `data` label

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

If yes, create with `gh issue create`:

```bash
gh issue create \
  -R tovmassian/escuadra \
  --title "[title]" \
  --body "[description]" \
  --assignee [assignee] \
  --label "[labels]" \
  [--milestone "[milestone]" if set] \
  [--project "[project]" if supported]
```

If no, loop back to step 1.

### 5. Link to Project (If CLI Can't)

If `gh issue create --project` doesn't work (GitHub API limitation), create the issue first, then:

```bash
# Get the issue number from output
ISSUE_NUM=123

# Add to project manually via the UI, or use gh api:
gh api graphql -F owner=tovmassian -F project=PROJECT_NUMBER -F itemId=ISSUE_ID << 'EOF'
mutation($owner:String!, $project:Int!, $itemId:String!) {
  addProjectV2ItemById(input:{projectId:$project, contentId:$itemId}) {
    item {
      id
    }
  }
}
EOF
```

## Common Mistakes

| Mistake                                         | Fix                                                                                                        |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Use `gh milestone list` command (doesn't exist) | Use `gh api repos/tovmassian/escuadra/milestones` instead                                                  |
| Assume projects are always available            | Check auth scope; `gh auth refresh -s read:project` if missing                                             |
| Ask for size label when none exist              | Check available labels first; offer to create them or skip size field                                      |
| Apply wrong label for issue type                | Map type → label programmatically: bug→bug, feature→enhancement, refactor→investigation, doc→documentation |
| Silent assignee default to current user         | Always ask, but default to repo owner (@tovmassian) unless overridden                                      |
| Forget to confirm before creating               | Show full issue template + metadata, ask "Create?" before `gh issue create`                                |
| Silently fail when projects unavailable         | Report clearly: "Projects require auth scope read:project. Skipping project assignment."                   |

## Quick Reference

**Default values for Escuadra:**

- Assignee: `@tovmassian`
- Project: v0 planning board (if exists)
- Milestone: Highest-priority open milestone
- Size: Ask (no sensible default)
- Labels: Type-based (bug/feature/refactor/doc/data)

**Labels to apply by type:**

```
bug        → bug
feature    → enhancement
refactor   → refactor (or create if missing)
doc        → documentation
data       → data (or create if missing)
```

**Size scale (if using labels):**

- Trivial: fix typo, small config change (<30 min)
- Small: isolated bug fix, add one component (30 min - 1 hour)
- Medium: feature with multiple parts, refactor one module (1-2 hours)
- Large: new subsystem, major refactor, complex feature (4+ hours)

**Escuadra milestones to expect:**

- v0 (first release: team picker, 10-question round, study screen)
- v1 (post-v0: player photos, more squads)
- Future (beyond current scope)

## Example Walkthrough

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
   Milestones: ["v0 (active)", "v1 (future)"]
   Labels: ["bug", "enhancement", "documentation", "data", ...]
   ```

3. **Prompt for metadata:**

   ```
   Assignee: @tovmassian (default, no change)

   Project: Add to "v0 planning"?
   - (shows: this is the active planning board)

   Milestone: "v0 (active)"?
   - (shows: 8 issues in v0 milestone)

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
     Milestone: v0 (active)
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

## Integration Notes

- **Auth scope for projects**: `gh auth refresh -s read:project` once per session (only if you want to use project assignment)
- **Milestones require API**: Use `gh api repos/tovmassian/escuadra/milestones` not `gh milestone list`
- **Size labels don't exist yet**: Offer to create trivial/small/medium/large labels in bulk, or skip size field
- **GraphQL fallback for project assignment**: If CLI `--project` flag doesn't work, use the GraphQL API example (see step 5)
- **Batch creation**: For multiple issues, run this skill sequentially — one issue per invocation
- **Metadata override**: User can specify any field explicitly (skip discovery, use provided value)
- **Graceful degradation**: If projects unavailable (no auth scope), continue without adding to project board

## Red Flags (When to Stop & Ask)

- [ ] Missing GitHub CLI authentication — error message will say so
- [ ] GitHub API call fails (milestone, labels, projects) — report error clearly, don't silently skip
- [ ] Projects unavailable due to missing `read:project` scope — report: "Skipping project assignment (auth scope required)"
- [ ] User provides issue type you don't recognize — ask to clarify: bug/feature/refactor/doc/data
- [ ] Label for issue type doesn't exist (e.g., no "refactor" label) — ask: should I create it?
- [ ] Size labels don't exist — ask: should I create them (trivial/small/medium/large)?
- [ ] Milestone list is empty — ask: should this issue have a milestone?
- [ ] Assignee doesn't exist in repo — ask: verify username (e.g., is it @tovmassian?)
