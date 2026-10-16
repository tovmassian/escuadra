import { describe, expect, it } from 'vitest';
import {
  gradersFor,
  STAYED_DRY_PATTERN,
  type Expectation,
  type Triage,
} from '../../lib/graders.ts';
import { fieldPattern, TRIAGE_TEMPLATE } from '../../lib/triage.ts';
import type { YamlMap } from '../../lib/yaml.ts';

const BLOCK = [
  'I read the issue and the handoff.',
  '```triage',
  'issue: 126',
  'size: S (board; body says M)',
  'docs: docs/superpowers/handoff/2026-10-16-2-0-redesign-handoff.md',
  'existing: none',
  'decision: proceed',
  'questions: none',
  'execution: n/a',
  'workspace: in-place',
  'base: main',
  'branch: fix/126-photo-credits-sheet',
  'first-step: superpowers:systematic-debugging',
  '```',
].join('\n');

const regexes = (graders: YamlMap[]) =>
  graders.filter((g) => g.type === 'regex' && g.target === undefined);
const passes = (grader: YamlMap, text: string) =>
  new RegExp(String(grader.pattern), String(grader.flags ?? '')).test(text);

const proceed: Triage = {
  kind: 'triage',
  decision: 'proceed',
  workspace: 'in-place',
  base: 'main',
  branch: { prefix: 'fix/126-' },
  firstStep: 'systematic-debugging',
  execution: 'n/a',
  docs: ['docs/superpowers/handoff/2026-10-16-2-0-redesign-handoff.md'],
};

describe('gradersFor a triage', () => {
  it('passes a block that meets every expectation', () => {
    for (const grader of regexes(gradersFor(proceed))) {
      expect(passes(grader, BLOCK), String(grader.name)).toBe(true);
    }
  });

  it('fails each field that decided differently', () => {
    const other: Triage = {
      kind: 'triage',
      decision: 'ask',
      workspace: 'worktree',
      base: 'release/1.0.0',
      branch: { prefix: 'feat/126-' },
      firstStep: 'brainstorming',
      execution: 'ask',
      docs: ['docs/superpowers/plans/2026-10-16-2-0-study.md'],
    };
    for (const grader of regexes(gradersFor(other))) {
      expect(passes(grader, BLOCK), String(grader.name)).toBe(false);
    }
  });

  it('accepts an exact branch name and a skill named without its prefix', () => {
    const exact: Triage = {
      kind: 'triage',
      decision: 'proceed',
      branch: { exact: 'fix/126-photo-credits-sheet' },
      firstStep: 'systematic-debugging',
    };
    const block = BLOCK.replace('superpowers:systematic-debugging', 'systematic-debugging');
    for (const grader of regexes(gradersFor(exact))) expect(passes(grader, block)).toBe(true);
  });

  it('weighs the decision and writing above the slug', () => {
    const graders = gradersFor(proceed);
    const weight = (name: string) => graders.find((g) => g.name === name)?.weight;
    expect(weight('decision')).toBe(3);
    expect(weight('no-writes')).toBe(3);
    expect(weight('branch')).toBe(1);
  });

  it('checks gh.log for writes, and judges questions with an LLM', () => {
    const graders = gradersFor({ kind: 'triage', decision: 'ask', questions: 'it asks X.' });
    expect(graders.find((g) => g.name === 'no-writes')).toMatchObject({
      target: { source: 'file', path: '.git/sandbox/gh.log' },
      match: 'not_contains',
    });
    expect(graders.find((g) => g.name === 'questions')).toMatchObject({ type: 'llm', weight: 2 });
  });
});

describe('gradersFor a negative case', () => {
  it('expects no triage block and an answer', () => {
    const names = gradersFor({ kind: 'no-triage', answered: 'It answers.' }).map((g) => g.name);
    expect(names).toEqual(['no-triage', 'answered', 'no-writes', 'stayed-dry']);
  });
});

describe('stayed-dry', () => {
  const stayedDry = (graders: YamlMap[]) => graders.find((g) => g.name === 'stayed-dry');
  const call = (command: string) =>
    `"name":"Bash","input":{"command":${JSON.stringify(command)},"description":"x"}`;

  it('is on every triage and negative case, over the trace, weighted 2', () => {
    const expectations: Expectation[] = [
      { kind: 'triage', decision: 'proceed' },
      { kind: 'no-triage', answered: 'It answers.' },
    ];
    for (const expectation of expectations) {
      expect(stayedDry(gradersFor(expectation))).toMatchObject({
        type: 'regex',
        target: 'trace',
        match: 'not_contains',
        weight: 2,
      });
    }
  });

  it('is not added to a smoke case', () => {
    expect(stayedDry(gradersFor({ kind: 'smoke', graders: [] }))).toBeUndefined();
  });

  it('exports its pattern, for the smoke case to prove it on a real trace', () => {
    expect(stayedDry(gradersFor({ kind: 'triage', decision: 'proceed' }))?.pattern).toBe(
      STAYED_DRY_PATTERN,
    );
  });

  it('catches a Bash call that changes branches, commits or worktrees', () => {
    const grader = stayedDry(gradersFor({ kind: 'triage', decision: 'proceed' }));
    if (!grader) throw new Error('no stayed-dry grader');
    for (const command of [
      'git switch -c fix/126-credits',
      'git checkout -b fix/126-credits',
      'git worktree add .claude/worktrees/126 -b fix/126-x main',
      'git commit -m "wip"',
      'cd docs && git commit -am x',
      'git push -u origin fix/126-x',
      'git stash push -m tag',
      'git reset --hard origin/main',
      'echo a\ngit commit -m x',
      'cat <<EOF\nnotes\nEOF\ngit push',
      'git -C docs commit -am x',
      'git -c user.name=x commit -m y',
      'git branch fix/126-x',
      'git branch -D old',
      'git checkout -B x',
      'git switch -C x',
      'git cherry-pick abc123',
      'git tag v1.0.1',
      'git add .',
      'git worktree remove .claude/worktrees/126',
      '/usr/bin/git commit -m x',
      'git reset HEAD~1',
      'git reset --soft HEAD^',
      'git restore README.md',
      'git clean -fd',
      'git rm old.ts',
      'git mv a.ts b.ts',
      'git pull',
      'git revert abc123',
      'git checkout -- README.md',
      'git branch --delete old',
      '(cd docs; git commit -m x)',
      'ls && git add .',
      'x=$(git stash)',
    ]) {
      expect(passes(grader, call(command)), command).toBe(true);
    }
  });

  it('lets read-only git through, and prose that only mentions a command', () => {
    const grader = stayedDry(gradersFor({ kind: 'triage', decision: 'proceed' }));
    if (!grader) throw new Error('no stayed-dry grader');
    for (const text of [
      call('git log --oneline -5'),
      call('git branch -a'),
      call('git worktree list'),
      call('git status --short'),
      call('git merge-base main HEAD'),
      call('git stash list'),
      call('git stash show -p'),
      call('git commit-graph verify'),
      call('git push --dry-run origin fix/1'),
      call('git tag -l'),
      call('git tag'),
      call('git branch --show-current'),
      call('git branch -v'),
      call('git log --grep "#9007"'),
      call('grep "git cherry-pick" docs/release.md'),
      call('grep -n "git commit" CLAUDE.md'),
      call('echo "run git push later"'),
      call('git checkout main'),
      call('cat docs/release.md | grep reset'),
      '"type":"text","text":"Next I would run git switch -c fix/126-credits."',
    ]) {
      expect(passes(grader, text), text).toBe(false);
    }
  });
});

describe('fieldPattern', () => {
  it('does not take a longer value for the one expected', () => {
    expect(new RegExp(fieldPattern('base', 'main'), 'm').test('base: main-next')).toBe(false);
    expect(new RegExp(fieldPattern('base', 'release/1.0'), 'm').test('base: release/1.0.0')).toBe(
      false,
    );
  });

  it('matches the template it is written against', () => {
    expect(TRIAGE_TEMPLATE).toMatch(/^```triage\n/);
    expect(TRIAGE_TEMPLATE).toMatch(/\n```$/);
  });
});

describe('anchoring and boundaries', () => {
  const named = (graders: YamlMap[], name: string): YamlMap => {
    const grader = graders.find((g) => g.name === name);
    if (!grader) throw new Error(`no grader named ${name}`);
    return grader;
  };
  const DOC = 'docs/superpowers/handoff/2026-10-16-2-0-redesign-handoff.md';

  it('docs passes only on the docs line, not a narrative mention or a longer name', () => {
    const docs = named(gradersFor({ kind: 'triage', decision: 'proceed', docs: [DOC] }), 'docs');
    expect(passes(docs, BLOCK)).toBe(true);

    const narrative = BLOCK.replace(`docs: ${DOC}`, 'docs: none').replace(
      'I read the issue and the handoff.',
      `I read ${DOC}.`,
    );
    expect(passes(docs, narrative)).toBe(false);

    const longer = BLOCK.replace(
      `docs: ${DOC}`,
      'docs: docs/superpowers/handoff/x-2026-10-16-2-0-redesign-handoff.md',
    );
    expect(passes(docs, longer)).toBe(false);
  });

  it('existing passes on the number and not a longer one', () => {
    const existing = named(
      gradersFor({ kind: 'triage', decision: 'proceed', existing: ['#9101'] }),
      'existing',
    );
    const withExisting = (line: string) => BLOCK.replace('existing: none', line);
    expect(
      passes(existing, withExisting('existing: open PR #9101 (fix/9008-progress-bar-last-step)')),
    ).toBe(true);
    expect(passes(existing, withExisting('existing: PR #91010'))).toBe(false);
  });

  it('branch rejects a slash after the slug', () => {
    const branch = named(gradersFor(proceed), 'branch');
    const slashed = BLOCK.replace('branch: fix/126-photo-credits-sheet', 'branch: fix/126-foo/bar');
    expect(passes(branch, slashed)).toBe(false);
  });

  it('a field pattern does not match across a line break', () => {
    expect(new RegExp(fieldPattern('base', 'main'), 'm').test('base:\nmain')).toBe(false);
  });
});
