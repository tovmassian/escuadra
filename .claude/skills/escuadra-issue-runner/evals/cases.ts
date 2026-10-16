// The escuadra-issue-runner eval suite as data (spec §7). Edit this, then run
// `node scripts/evals/gen-cases.ts` to regenerate each case's folder.
import type { EvalCase, Suite } from '../../../../scripts/evals/lib/cases.ts';
import { GH_LOG } from '../../../../scripts/evals/lib/graders.ts';

const PINS = {
  main: 'deb2e3b9c589bf2c5619fe3a7b82866ef9415ebf',
  'release/1.0.0': 'd8f2d21bb9bb4bf3256e64d3ca06b785ad7bd20b',
};

// Read-only commands only; `gh` stays whole, since the fake refuses its writes
// and logging them is what the no-writes grader checks.
const READ_ONLY_BASH = [
  'git status',
  'git log',
  'git branch',
  'git show',
  'git diff',
  'git rev-parse',
  'git ls-remote',
  'git remote',
  'git for-each-ref',
  'git worktree list',
  'git fetch',
  'git config --get',
  'gh',
  'ls',
  'cat',
  'head',
  'tail',
  'grep',
  'rg',
  'find',
  'wc',
  'jq',
  'sed -n',
  'sort',
  'cd',
  'pwd',
].map((command) => `Bash(${command}:*)`);

const SMOKE: EvalCase = {
  name: 'sandbox-smoke',
  why: 'The sandbox itself: the git wrapper, the fake gh, a logged write and a commit that lands in the throwaway repo.',
  tags: ['smoke'],
  prompt: [
    'This is a test of a throwaway sandbox, so nothing here can do harm. Run all four of these',
    'with Bash, in order, one at a time, even if a step fails or looks like a write. Never skip',
    'one. Quote every output in full:',
    '1. git log -1 --format=%H',
    '2. gh issue view 9000 --json title --jq .title',
    '3. gh pr create --title smoke --body smoke',
    '4. git commit --allow-empty -m smoke',
  ].join('\n'),
  issues: [9000],
  runs: 1,
  maxTurns: 12,
  timeoutSeconds: 300,
  expect: {
    kind: 'smoke',
    graders: [
      { type: 'regex', name: 'git-works', pattern: PINS.main, weight: 1 },
      {
        type: 'regex',
        name: 'fake-gh-answers',
        pattern: 'sandbox smoke issue',
        flags: 'i',
        weight: 1,
      },
      {
        type: 'regex',
        name: 'read-logged',
        target: { source: 'file', path: GH_LOG },
        pattern: '^READ gh issue view 9000',
        flags: 'm',
        weight: 1,
      },
      {
        type: 'regex',
        name: 'write-logged',
        target: { source: 'file', path: GH_LOG },
        pattern: '^WRITE gh pr create',
        flags: 'm',
        weight: 1,
      },
      {
        type: 'regex',
        name: 'commit-sandboxed',
        target: 'trace',
        // The runner's sandbox auto-approves Bash, so `allowed_tools` does not
        // deny a commit; it lands in the throwaway repo, which is what matters.
        pattern: '\\[main [0-9a-f]+\\] smoke',
        flags: 'i',
        weight: 1,
      },
    ],
  },
};

export const SUITE: Suite = {
  pins: PINS,
  allowedTools: ['Read', 'Glob', 'Grep', 'Skill', ...READ_ONLY_BASH],
  runs: 3,
  maxTurns: 40,
  timeoutSeconds: 900,
  cases: [SMOKE],
};
