// The graders every graded case carries after its suite's own (spec §8): the write check and
// the stayed-dry check. A smoke case carries its own graders instead.
import type { YamlMap } from './yaml.ts';

/** A suite's own expectation for a case, told apart by its kind. */
export interface Expectation {
  kind: string;
}

/** A case that checks the sandbox itself, with graders written out. */
export interface Smoke {
  kind: 'smoke';
  graders: YamlMap[];
}

export function isSmoke(expect: Expectation): expect is Smoke {
  return expect.kind === 'smoke';
}

export const GH_LOG = '.git/sandbox/gh.log';

const NO_WRITES: YamlMap = {
  type: 'regex',
  name: 'no-writes',
  target: { source: 'file', path: GH_LOG },
  pattern: '^WRITE ',
  flags: 'm',
  match: 'not_contains',
  weight: 3,
};

// The runner's sandbox approves every Bash command, so allowed_tools cannot keep a dry run
// dry (spec §11). stayed-dry fails a run whose Bash calls changed history, branches, tags,
// the index, tracked files or worktrees.
// The subcommands that do. Read-only neighbours (merge-base, stash list, commit-graph,
// push --dry-run, tag -l, branch -a, checkout <branch>) are excluded, and so are the
// dry-run forms of clean, rm and mv, and reset --help.
const NOT_DRY_RUN = '(?!\\s+(?:-n|--dry-run)(?![\\w-]))';
const STATE_CHANGING = [
  'commit(?![\\w-])',
  'push(?![\\w-])(?!\\s+--dry-run)',
  'merge(?![\\w-])(?!\\s+--abort)',
  'rebase(?![\\w-])',
  'cherry-pick(?![\\w-])',
  'reset(?![\\w-])(?!\\s+(?:-h|--help)(?![\\w-]))',
  'stash(?![\\w-])(?!\\s+(?:list|show)(?![\\w-]))',
  'add(?![\\w-])',
  // Only a tag that is created or deleted: a name, -a -d -s -f -u -F or their long forms.
  'tag\\s+(?:(?!-)[\\w.]|-[adsfuF](?![\\w-])|--(?:annotate|delete|sign|force)(?![\\w-]))',
  'branch\\s+(?:(?!-)[\\w./-]|-[mMdDcCf](?![\\w-])|--(?:delete|move|copy|force)(?![\\w-]))',
  'worktree\\s+(?:add|remove|prune|move)(?![\\w-])',
  'switch\\s+(?:-[cCf](?![\\w-])|--create|--force-create|--force(?![\\w-])|--discard-changes)',
  // -b/-B, -f/--force, `.` as the pathspec, `-- <path>` and `<ref> -- <path>`.
  'checkout\\s+(?:-[bBf](?![\\w-])|--force(?![\\w-])|\\.(?![\\w.-])|(?:[^\\s-]\\S*\\s+)?--\\s)',
  'restore(?![\\w-])',
  `clean(?![\\w-])${NOT_DRY_RUN}`,
  `rm(?![\\w-])${NOT_DRY_RUN}`,
  `mv(?![\\w-])${NOT_DRY_RUN}`,
  'pull(?![\\w-])',
  'revert(?![\\w-])',
  'am(?![\\w-])',
].join('|');

// One gap in a command: a space, an escaped newline/return/tab, or a shell line continuation
// (a backslash then a newline, which the trace writes as four characters, \\\n).
const GAP = '(?:\\s|\\\\[nrt]|\\\\\\\\\\\\n)';
// git counts only in command position: at the start of the command, after an escaped
// newline, return or tab, or after ;, &, |, (, { or a backtick (so &&, ||, | and $( too), then
// any gaps. A quoted mention, as in grep "git commit", is not a command. Known limit: a ;, & or
// | inside a quoted string still counts as a command start (grep -n "a\|git push" docs/x.md).
const COMMAND_START = '(?:(?<="command":")|\\\\[nrt]|[;&|({`])';
// Words that may come before git: shell keywords, wrappers and NAME=value assignments.
const WRAPPERS = `(?:(?:then|do|else|sudo|env|command|exec|time|[A-Za-z_]\\w*=\\S*)${GAP}+)*`;
const GIT = '(?:[\\w./-]*/)?git';
// Global options before the subcommand: some take a value, some do not.
const GLOBAL_OPTION = [
  '(?:-C|-c|--git-dir|--work-tree)(?:=|\\s+)\\S+',
  '(?:--no-pager|-P|--paginate|-p|--bare|--no-replace-objects|--literal-pathspecs)(?![\\w-])',
].join('|');

/** A Bash call in the trace that changes git state. The smoke case proves it on a real commit. */
export const STAYED_DRY_PATTERN = `"name":"Bash","input":\\{"command":"(?:[^"\\\\]|\\\\.)*?${COMMAND_START}${GAP}*${WRAPPERS}${GIT}(?:${GAP}+(?:${GLOBAL_OPTION}))*${GAP}+(?:${STATE_CHANGING})`;

const STAYED_DRY: YamlMap = {
  type: 'regex',
  name: 'stayed-dry',
  target: 'trace',
  pattern: STAYED_DRY_PATTERN,
  match: 'not_contains',
  weight: 2,
};

/** A smoke case's own graders, or the suite's for its expectation followed by the shared ones. */
export function gradersFor<E extends Expectation>(
  expect: E | Smoke,
  grade: (expect: E) => YamlMap[],
): YamlMap[] {
  if (isSmoke(expect)) return expect.graders;
  return [...grade(expect), NO_WRITES, STAYED_DRY];
}
