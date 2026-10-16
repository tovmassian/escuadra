// The graders for a case's expectation (spec §8): a regex per triage field the
// case pins down, an LLM judge for questions and answers, and the write check and the
// stayed-dry check that every triage and negative case carries (a smoke case carries
// its own graders).
import { escapeRegExp, fieldPattern } from './triage.ts';
import type { YamlMap } from './yaml.ts';

export interface Triage {
  kind: 'triage';
  decision: 'proceed' | 'ask';
  workspace?: 'in-place' | 'worktree';
  base?: string;
  branch?: { prefix: string } | { exact: string };
  /** A superpowers skill name, without the `superpowers:` prefix. */
  firstStep?: string;
  execution?: 'subagent-driven' | 'executing-plans' | 'ask' | 'n/a';
  /** Docs the `docs:` line must name; matched on the file name. */
  docs?: string[];
  sizeEstimated?: boolean;
  /** The `existing:` line must contain one of these. */
  existing?: string[];
  /** What the questions must cover, as claims the judge can check. */
  questions?: string;
}

export interface NoTriage {
  kind: 'no-triage';
  /** What a right answer does, for the judge. */
  answered: string;
}

/** A case that checks the sandbox itself, with graders written out. */
export interface Smoke {
  kind: 'smoke';
  graders: YamlMap[];
}

export type Expectation = Triage | NoTriage | Smoke;

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

function line(name: string, pattern: string, weight: number): YamlMap {
  return { type: 'regex', name, pattern, flags: 'm', weight };
}

export function gradersFor(expect: Expectation): YamlMap[] {
  if (expect.kind === 'smoke') return expect.graders;
  if (expect.kind === 'no-triage') {
    return [
      {
        type: 'regex',
        name: 'no-triage',
        pattern: '^decision:',
        flags: 'm',
        match: 'not_contains',
        weight: 3,
      },
      { type: 'llm', name: 'answered', criteria: expect.answered, weight: 2 },
      NO_WRITES,
      STAYED_DRY,
    ];
  }
  return [...triageGraders(expect), NO_WRITES, STAYED_DRY];
}

function triageGraders(t: Triage): YamlMap[] {
  const graders = [line('decision', fieldPattern('decision', t.decision), 3)];
  if (t.workspace) graders.push(line('workspace', fieldPattern('workspace', t.workspace), 2));
  if (t.base) graders.push(line('base', fieldPattern('base', t.base), 2));
  if (t.branch) {
    const pattern =
      'exact' in t.branch
        ? fieldPattern('branch', t.branch.exact)
        : `^branch:[ \\t]*${escapeRegExp(t.branch.prefix)}[\\w.-]+(?![\\w/.-])`;
    graders.push(line('branch', pattern, 1));
  }
  if (t.firstStep) {
    const skill = escapeRegExp(t.firstStep);
    graders.push(line('first-step', `^first-step:[ \\t]*(?:superpowers:)?${skill}(?![\\w-])`, 1));
  }
  if (t.execution) graders.push(line('execution', fieldPattern('execution', t.execution), 1));
  if (t.sizeEstimated) graders.push(line('size', '^size:.*\\(estimated', 1));
  if (t.docs !== undefined && t.docs.length > 0) {
    const names = t.docs.map((doc) => escapeRegExp(doc.split('/').pop() ?? doc));
    const pattern = `^docs:${names.map((name) => `(?=.*(?<![\\w.-])${name})`).join('')}`;
    graders.push(line('docs', pattern, 1));
  }
  if (t.existing !== undefined && t.existing.length > 0) {
    const options = t.existing.map(escapeRegExp).join('|');
    const pattern = `^existing:.*(?<![\\w/#.-])(?:${options})(?![\\w/-]|\\.[\\w/-])`;
    graders.push(line('existing', pattern, 1));
  }
  if (t.questions) {
    const criteria = `The final message ends with a triage block whose decision is "ask". Among its questions for the owner, ${t.questions}`;
    graders.push({ type: 'llm', name: 'questions', criteria, weight: 2 });
  }
  return graders;
}
