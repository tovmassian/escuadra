// The triage block (spec §2.6): the template a dry run ends with, and the regex
// helpers its graders are built from. The skill's SKILL.md copies the template.

export const TRIAGE_TEMPLATE = [
  '```triage',
  'issue: <number>',
  'size: <XS|S|M|L|XL> (<board|estimated>; <a disagreement, if any>)',
  'docs: <paths, comma-separated, or none>',
  'existing: <open PR, branch or commits for the issue, or none>',
  'decision: <proceed|ask>',
  'questions: <none, or one per line below, each starting with "- ">',
  'execution: <subagent-driven|executing-plans|ask|n/a>',
  'workspace: <in-place|worktree|n/a>',
  'base: <main|release/X.Y.Z|n/a>',
  'branch: <type>/<number>-<slug>, or n/a',
  'first-step: <superpowers:brainstorming|writing-plans|subagent-driven-development|executing-plans|systematic-debugging|test-driven-development, or n/a>',
  '```',
].join('\n');

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

/**
 * `<field>: <value>` at a line start (flag m), where the value is not the start of a longer one.
 * A `.` may follow it, as at the end of a sentence, unless more of a value follows the `.`.
 */
export function fieldPattern(field: string, value: string): string {
  return `^${escapeRegExp(field)}:[ \\t]*${escapeRegExp(value)}(?![\\w/-]|\\.[\\w/-])`;
}
