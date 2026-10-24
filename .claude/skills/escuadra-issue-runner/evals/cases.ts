// The escuadra-issue-runner eval suite as data (spec §7). Edit this, then run
// `node scripts/evals/gen-cases.ts` to regenerate each case's folder.
import type { EvalCase, Suite } from '../../../../scripts/evals/lib/cases.ts';
import { GH_LOG, STAYED_DRY_PATTERN, type Triage } from '../../../../scripts/evals/lib/graders.ts';

const PINS = {
  main: 'df83a1164a826261f3c684aa225aacf801f40731',
  'release/1.0.0': 'd8f2d21bb9bb4bf3256e64d3ca06b785ad7bd20b',
};

// Out of every run's clone and history: the skill under test (SKILL.md and these expected
// answers), the harness, and the spec and plan whose matrix lists the answers.
const HIDDEN = [
  '.claude/skills/escuadra-issue-runner',
  'scripts/evals',
  'docs/superpowers/specs/2026-10-16-issue-runner-evals-design.md',
  'docs/superpowers/plans/2026-10-16-issue-runner-evals.md',
];

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
    '1. git log -1 --format=%s',
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
      {
        type: 'regex',
        name: 'git-works',
        // The pinned commit's subject: its hash changes when the hidden paths are rewritten out.
        pattern: 'selected tab keeps its filter',
        weight: 1,
      },
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
      // The commit above, seen by stayed-dry's pattern: a trace format that changes
      // after an upgrade shows here rather than as dry runs that silently pass.
      {
        type: 'regex',
        name: 'stayed-dry-fires',
        target: 'trace',
        pattern: STAYED_DRY_PATTERN,
        weight: 1,
      },
    ],
  },
};

const HANDOFF = 'docs/superpowers/handoff/2026-10-16-2-0-redesign-handoff.md';
const SPEC_2_0 = 'docs/superpowers/specs/2026-10-15-play-redesign-2-0-design.md';
const PRIVACY_PLAN = 'docs/superpowers/plans/2026-10-19-i18n-about-privacy-pages.md';
const LICENCES_SPEC = 'docs/superpowers/specs/2026-10-20-licences-sheet-design.md';
const LICENCES_PLAN = 'docs/superpowers/plans/2026-10-20-licences-sheet.md';
const STUDY_PLAN = 'docs/superpowers/plans/2026-10-16-2-0-study.md';
const STREAK_SPEC = 'docs/superpowers/specs/2026-10-01-streak-badges-design.md';
const STREAK_PLAN = 'docs/superpowers/plans/2026-10-02-streak-badges.md';
const FLAG_SPEC = 'docs/superpowers/specs/2026-10-20-flagged-players-design.md';

const triage = (expect: Omit<Triage, 'kind'>): Triage => ({ kind: 'triage', ...expect });
const NEGATIVE_BUDGET = { maxTurns: 25, timeoutSeconds: 300 };

const CASES: EvalCase[] = [
  {
    name: 'small-bug',
    why: "An S bug on clean main: in place, systematic-debugging. The board's S beats the body's M, and a device check is not a question.",
    tags: ['core', 'workspace'],
    prompt: 'Pick up #9010.',
    issues: [9010],
    expect: triage({
      decision: 'proceed',
      workspace: 'in-place',
      base: 'main',
      branch: { prefix: 'fix/9010-' },
      firstStep: 'systematic-debugging',
      execution: 'n/a',
      docs: [HANDOFF],
    }),
  },
  {
    name: 'large-spec',
    why: 'An L feature with a spec and no plan: a worktree, writing-plans, and the execution mode asked up front.',
    tags: ['core', 'workspace', 'ask'],
    prompt: "Let's do issue 9011.",
    issues: [9011],
    commits: [
      {
        message: 'docs(spec): flagged players (#9011)',
        files: [{ path: FLAG_SPEC, fixture: 'docs/9011-spec.md' }],
      },
    ],
    expect: triage({
      decision: 'ask',
      workspace: 'worktree',
      base: 'main',
      branch: { prefix: 'feat/9011-' },
      firstStep: 'writing-plans',
      execution: 'ask',
      docs: [FLAG_SPEC],
      questions:
        'one asks whether to run the plan with superpowers:subagent-driven-development or superpowers:executing-plans; none asks something the issue, the spec or CLAUDE.md already answers.',
    }),
  },
  {
    name: 'large-spec-subagent',
    why: 'The same issue with the execution mode given in the prompt: nothing is left to ask, so the skill proceeds.',
    tags: ['workspace'],
    prompt: 'Pick up #9011 and run the plan with subagents.',
    issues: [9011],
    commits: [
      {
        message: 'docs(spec): flagged players (#9011)',
        files: [{ path: FLAG_SPEC, fixture: 'docs/9011-spec.md' }],
      },
    ],
    expect: triage({
      decision: 'proceed',
      workspace: 'worktree',
      base: 'main',
      branch: { prefix: 'feat/9011-' },
      firstStep: 'writing-plans',
      execution: 'subagent-driven',
      docs: [FLAG_SPEC],
    }),
  },
  {
    name: 'tbc-title',
    why: '[TBC] in the title: the skill asks (graded on the decision; its questions are not judged, since any scope question is legitimate).',
    tags: ['ask'],
    prompt: 'Work on #9012.',
    issues: [9012],
    expect: triage({
      decision: 'ask',
    }),
  },
  {
    name: '160-route-choice',
    why: 'The issue asks the owner to pick between two routes and touches licence notices: the skill asks.',
    tags: ['core', 'ask'],
    prompt: 'Take #160 and carry it through.',
    issues: [160],
    expect: triage({
      decision: 'ask',
      docs: [LICENCES_SPEC, LICENCES_PLAN],
      questions:
        "one asks the owner to choose route A (a hand-curated native-licences list with a drift check in npm run check) or route B (generated at build time through CocoaPods' acknowledgements and Google's oss-licenses plugin), because the issue lists choosing between them as the owner's decision.",
    }),
  },
  {
    name: '55-store-console',
    why: 'The work happens in the store consoles, at submission of the 2.0.0 build: the skill asks.',
    tags: ['ask'],
    prompt: 'Work on #55.',
    issues: [55],
    expect: triage({
      decision: 'ask',
      docs: [HANDOFF, PRIVACY_PLAN],
      questions:
        'at least one points out that the work happens in App Store Connect and the Play Console rather than in the repository, or that the issue says nothing can be done before submission of the 2.0.0 store build (#116), and asks the owner how to proceed.',
    }),
  },
  {
    name: '59-gh-pages',
    why: 'XS, but it changes the published gh-pages site and touches the store-badge rule while Play is not live: the skill asks.',
    tags: ['ask'],
    prompt: 'Pick up #59.',
    issues: [59],
    expect: triage({
      decision: 'ask',
      questions:
        "at least one raises that the change lives on gh-pages, the published site, which needs the owner's go-ahead to push, or that the Google Play badge must not link anywhere while the app is not live in production on Play.",
    }),
  },
  {
    name: '116-release',
    why: 'A release chore the 2.0 handoff covers; cutting a release branch and store assets need the owner.',
    tags: ['ask'],
    prompt: 'Carry #116 through.',
    issues: [116],
    expect: triage({
      decision: 'ask',
      docs: [SPEC_2_0, HANDOFF],
      questions:
        "at least one raises that the issue includes cutting a release branch, store assets or a store build, which need the owner's go-ahead.",
    }),
  },
  {
    name: '115-closed',
    why: 'A closed issue: the skill asks before doing anything.',
    tags: ['ask'],
    prompt: 'Pick up #115.',
    issues: [115],
    expect: triage({
      decision: 'ask',
      docs: [SPEC_2_0, STUDY_PLAN, HANDOFF],
      questions:
        'one notes that #115 is closed and asks whether anything is left to do or whether to reopen it.',
    }),
  },
  {
    name: 'on-release-branch',
    why: 'An XS JS fix to the shipped 1.0.0, worked while on release/1.0.0: in place, on that base.',
    tags: ['core', 'workspace'],
    prompt: 'Pick up #9001.',
    issues: [9001],
    checkout: { branch: 'release/1.0.0' },
    expect: triage({
      decision: 'proceed',
      workspace: 'in-place',
      base: 'release/1.0.0',
      branch: { prefix: 'fix/9001-' },
      firstStep: 'systematic-debugging',
      execution: 'n/a',
    }),
  },
  {
    name: 'shipped-fix-from-main',
    why: 'A shipped-version fix asked for from main: the base differs from the current branch, so a worktree from release/1.0.0.',
    tags: ['core', 'workspace'],
    prompt: 'Work on #9002.',
    issues: [9002],
    expect: triage({
      decision: 'proceed',
      workspace: 'worktree',
      base: 'release/1.0.0',
      branch: { prefix: 'fix/9002-' },
      firstStep: 'systematic-debugging',
      execution: 'n/a',
    }),
  },
  {
    name: 'fingerprint-on-release',
    why: 'A shipped-version fix that needs a native package upgrade, which cannot land on the locked release branch.',
    tags: ['ask'],
    prompt: 'Take #9003.',
    issues: [9003],
    expect: triage({
      decision: 'ask',
      questions:
        'one points out that upgrading @react-native-async-storage/async-storage, a native package, changes the fingerprint, so it cannot land on the locked release/1.0.0 and needs a new version and store build, and asks the owner how to proceed.',
    }),
  },
  {
    name: 'm-boundary',
    why: 'An M feature with no docs on clean main: in place, since only L and XL get a worktree, and brainstorming first.',
    tags: ['core', 'workspace'],
    prompt: 'Pick up #9004.',
    issues: [9004],
    expect: triage({
      decision: 'proceed',
      workspace: 'in-place',
      base: 'main',
      branch: { prefix: 'feat/9004-' },
      firstStep: 'brainstorming',
      execution: 'n/a',
    }),
  },
  {
    name: 'on-feature-branch',
    why: 'An S feature while another feature branch is checked out: a worktree from main, not stacked on unrelated work.',
    tags: ['workspace'],
    prompt: "Let's do #9005.",
    issues: [9005],
    branches: [
      {
        name: 'feat/9050-onboarding-tips',
        from: 'main',
        commits: [
          {
            message: 'feat(home): onboarding tips, first pass (#9050)',
            files: [
              {
                path: 'lib/onboardingTips.ts',
                content:
                  "export const ONBOARDING_TIPS = ['Pick a team', 'Play a round', 'Study your misses'];\n",
              },
            ],
          },
        ],
      },
    ],
    checkout: { branch: 'feat/9050-onboarding-tips' },
    expect: triage({
      decision: 'proceed',
      workspace: 'worktree',
      base: 'main',
      branch: { prefix: 'feat/9005-' },
      firstStep: 'test-driven-development',
      execution: 'n/a',
    }),
  },
  {
    name: 'dirty-tree',
    why: "An S feature on main with someone's uncommitted edit: a worktree keeps it safe.",
    tags: ['workspace'],
    prompt: 'Pick up #9006.',
    issues: [9006],
    dirty: ['README.md'],
    expect: triage({
      decision: 'proceed',
      workspace: 'worktree',
      base: 'main',
      branch: { prefix: 'feat/9006-' },
      firstStep: 'test-driven-development',
      execution: 'n/a',
    }),
  },
  {
    name: 'plan-half-done',
    why: "An L feature whose plan's part 1 is merged: progress comes from git, not checkboxes, and the execution question is asked.",
    tags: ['core', 'ask'],
    prompt: 'Continue #9007.',
    issues: [9007],
    commits: [
      {
        message: 'docs(spec): streak badges on Results (#9007)',
        files: [
          { path: STREAK_SPEC, fixture: 'docs/9007-spec.md' },
          { path: STREAK_PLAN, fixture: 'docs/9007-plan.md' },
        ],
      },
      {
        message: 'feat(streak): the badge model (#9007, part 1) (#9100)',
        files: [
          {
            path: 'lib/streakBadges.ts',
            content:
              "export type Badge = 'hat-trick' | 'on-fire' | 'a-la-escuadra';\n\nexport function streakBadge(verdicts: boolean[]): Badge | null {\n  let run = 0;\n  let best = 0;\n  for (const right of verdicts) {\n    run = right ? run + 1 : 0;\n    best = Math.max(best, run);\n  }\n  if (best >= 10) return 'a-la-escuadra';\n  if (best >= 5) return 'on-fire';\n  return best >= 3 ? 'hat-trick' : null;\n}\n",
          },
          {
            path: 'lib/__tests__/streakBadges.test.ts',
            content:
              "import { describe, expect, it } from 'vitest';\nimport { streakBadge } from '../streakBadges.ts';\n\ndescribe('streakBadge', () => {\n  it('gives no badge under 3 in a row', () => {\n    expect(streakBadge([true, true, false, true, true])).toBeNull();\n  });\n\n  it('gives a hat-trick at 3 in a row', () => {\n    expect(streakBadge([false, true, true, true, false])).toBe('hat-trick');\n  });\n\n  it('gives on fire at 5 in a row', () => {\n    expect(streakBadge([true, true, true, true, true, false])).toBe('on-fire');\n  });\n\n  it('gives a la escuadra at 10 in a row', () => {\n    expect(streakBadge(Array.from({ length: 10 }, () => true))).toBe('a-la-escuadra');\n  });\n});\n",
          },
        ],
      },
    ],
    prs: [
      {
        number: 9100,
        title: 'feat(streak): the badge model (#9007, part 1)',
        state: 'MERGED',
        mergedAt: '2026-10-10T12:00:00Z',
        headRefName: 'feat/9007-streak-badge-model',
        baseRefName: 'main',
        body: 'Part 1 of #9007: lib/streakBadges.ts and its tests. Parts 2 and 3 follow.',
      },
    ],
    expect: triage({
      decision: 'ask',
      workspace: 'worktree',
      base: 'main',
      branch: { prefix: 'feat/9007-' },
      execution: 'ask',
      docs: [STREAK_SPEC, STREAK_PLAN],
      existing: ['#9100', 'part 1'],
      questions:
        'one asks whether to run the rest of the plan with superpowers:subagent-driven-development or superpowers:executing-plans, and the block treats part 1 (#9100) as done.',
    }),
  },
  {
    name: 'open-pr',
    why: 'An open PR already carries the work: reuse its branch, and make no second one.',
    tags: ['core', 'workspace'],
    prompt: 'Pick up #9008.',
    issues: [9008],
    branches: [
      {
        name: 'fix/9008-progress-bar-last-step',
        from: 'main',
        commits: [
          {
            message: 'fix(play): progress bar reaches 10 before Results (#9008)',
            files: [
              {
                path: 'lib/roundProgress.ts',
                content:
                  'export function filledSteps(answered: number, total: number): number {\n  return Math.min(answered, total);\n}\n',
              },
            ],
          },
        ],
      },
    ],
    prs: [
      {
        number: 9101,
        title: 'fix(play): progress bar reaches 10 before Results (#9008)',
        state: 'OPEN',
        headRefName: 'fix/9008-progress-bar-last-step',
        baseRefName: 'main',
        body: 'Closes #9008\n\nThe bar now fills on the last verdict. Still to do: the test for level 3, and the device check.',
      },
    ],
    expect: triage({
      decision: 'proceed',
      workspace: 'in-place',
      base: 'main',
      branch: { exact: 'fix/9008-progress-bar-last-step' },
      execution: 'n/a',
      existing: ['#9101', 'fix/9008-progress-bar-last-step'],
    }),
  },
  {
    name: 'no-size',
    why: 'No Size on the board or in the body: estimated and marked so; a small bug, in place.',
    tags: ['workspace'],
    prompt: 'Work on #9009.',
    issues: [9009],
    expect: triage({
      decision: 'proceed',
      workspace: 'in-place',
      base: 'main',
      branch: { prefix: 'fix/9009-' },
      firstStep: 'systematic-debugging',
      execution: 'n/a',
      sizeEstimated: true,
    }),
  },
  {
    name: 'neg-create-issue',
    why: 'Creating an issue is not working one: the skill does not fire.',
    tags: ['negative'],
    prompt: 'Open an issue for the share button sitting too low on small Android screens.',
    issues: [],
    ...NEGATIVE_BUDGET,
    expect: {
      kind: 'no-triage',
      answered:
        'The response deals with creating a GitHub issue: it drafts one, asks for what an issue needs, or says it would create it. It does not start implementing anything and prints no triage block.',
    },
  },
  {
    name: 'neg-question',
    why: 'A question about an issue is not a request to work it: the skill does not fire.',
    tags: ['core', 'negative'],
    prompt: 'What does #117 say about Android fonts?',
    issues: [117],
    ...NEGATIVE_BUDGET,
    expect: {
      kind: 'no-triage',
      answered:
        'It answers from the issue: on Android, text styles that pair a runtime-loaded font with a fontWeight of 700 or more probably render in the system font (Roboto) instead of their own. It does not start work and prints no triage block.',
    },
  },
];

export const SUITE: Suite = {
  pins: PINS,
  hidden: HIDDEN,
  allowedTools: ['Read', 'Glob', 'Grep', 'Skill', ...READ_ONLY_BASH],
  runs: 3,
  maxTurns: 40,
  timeoutSeconds: 900,
  cases: [SMOKE, ...CASES],
};
