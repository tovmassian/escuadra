---
paths:
  - "CLAUDE.md"
  - ".claude/**"
  - "docs/**"
  - "README.md"
  - "CHANGELOG.md"
---

# Writing the instructions

How `CLAUDE.md`, these rules and the docs are written, so they stay short and true.
`scripts/claude/__tests__/repo.test.ts` checks what a test can.

## Where a sentence goes

- **`CLAUDE.md`** holds only what every session needs: the game in brief, the
  guardrails, the release rules, scope, conventions, commands and an index. At most 200
  lines (tested). Keep a line only if removing it would make a session go wrong.
- **A rule in `.claude/rules/`** holds one topic's detail and loads when a session Reads
  a file its `paths` match. At most 100 lines (tested). Add a rule rather than grow
  `CLAUDE.md`, and list it in `CLAUDE.md`'s index.
- **`docs/`** holds procedures and concepts that people read too: `release.md`,
  `license.md`. A rule points at a doc rather than repeat it.
- **State lives where it changes:** what shipped in `CHANGELOG.md`, what is live in EAS
  and the store consoles, what is next in GitHub milestones and issues. A rule or
  `CLAUDE.md` never says "today", "next version", a current count or a status.
- **History** stays in git, specs and issues. A past incident survives only as the one
  line of why a rule exists.

## Writing a rule

- The frontmatter is a `paths:` list and nothing else, one double-quoted glob per line
  (tested). An unquoted glob that starts with `*` breaks the YAML, and the rule then
  loads in every session.
- Every glob matches a tracked file (tested), so a rename that strands a rule fails
  `npm run check`.
- Name the check that enforces a rule beside it, so a failing check leads back here.
- A guardrail keeps its number and its rule in `CLAUDE.md`, because code cites the
  number; its detail lives in a rule.
- Emphasis (bold, ⚠️) marks the one line sessions keep getting wrong, not many.

## How rules load

Measured on Claude Code 2.1.278
(`docs/superpowers/specs/2026-10-21-claude-rules-design.md`): a rule loads when a matching
file is Read, and in a subagent that Reads one. It does not load when a file is read
through Bash, or when a new one is written; `scripts/claude/rules-hook.ts` covers the new
file. Compaction drops a rule until a matching file is touched again. Open project files
with Read.
