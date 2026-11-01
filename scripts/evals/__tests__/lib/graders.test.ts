import { describe, expect, it } from 'vitest';
import {
  gradersFor,
  isSmoke,
  STAYED_DRY_PATTERN,
  type Expectation,
  type Smoke,
} from '../../lib/graders.ts';
import type { YamlMap } from '../../lib/yaml.ts';

// A made-up suite's expectation and grader, to show the harness takes any.
interface Echo extends Expectation {
  kind: 'echo';
  text: string;
}
const echo = (expect: Echo): YamlMap[] => [
  { type: 'regex', name: 'echo', pattern: expect.text, weight: 1 },
];
const ECHO: Echo = { kind: 'echo', text: 'hello' };

// Matches a grader's pattern against a text, as the eval runner does.
const passes = (grader: YamlMap, text: string) =>
  new RegExp(String(grader.pattern), String(grader.flags ?? '')).test(text);

describe('gradersFor', () => {
  it("puts the suite's graders first, then no-writes and stayed-dry", () => {
    expect(gradersFor(ECHO, echo).map((g) => g.name)).toEqual(['echo', 'no-writes', 'stayed-dry']);
  });

  it('checks gh.log for writes, weighted 3', () => {
    expect(gradersFor(ECHO, echo).find((g) => g.name === 'no-writes')).toEqual({
      type: 'regex',
      name: 'no-writes',
      target: { source: 'file', path: '.git/sandbox/gh.log' },
      pattern: '^WRITE ',
      flags: 'm',
      match: 'not_contains',
      weight: 3,
    });
  });

  it("gives a smoke case only its own graders, without calling the suite's", () => {
    const graders: YamlMap[] = [{ type: 'regex', name: 'x', pattern: 'x' }];
    const never = (): YamlMap[] => {
      throw new Error('graded a smoke case');
    };
    expect(gradersFor({ kind: 'smoke', graders }, never)).toBe(graders);
  });
});

describe('isSmoke', () => {
  it('tells a smoke case from a suite expectation', () => {
    const smoke: Smoke = { kind: 'smoke', graders: [] };
    expect(isSmoke(smoke)).toBe(true);
    expect(isSmoke(ECHO)).toBe(false);
  });
});

describe('stayed-dry', () => {
  const stayedDry = (graders: YamlMap[]) => graders.find((g) => g.name === 'stayed-dry');
  const call = (command: string) =>
    `"name":"Bash","input":{"command":${JSON.stringify(command)},"description":"x"}`;

  it('is on every graded case, over the trace, weighted 2', () => {
    expect(stayedDry(gradersFor(ECHO, echo))).toMatchObject({
      type: 'regex',
      target: 'trace',
      match: 'not_contains',
      weight: 2,
    });
  });

  it('is not added to a smoke case', () => {
    expect(stayedDry(gradersFor<Echo>({ kind: 'smoke', graders: [] }, echo))).toBeUndefined();
  });

  it('exports its pattern, for the smoke case to prove it on a real trace', () => {
    expect(stayedDry(gradersFor(ECHO, echo))?.pattern).toBe(STAYED_DRY_PATTERN);
  });

  it('catches a Bash call that changes branches, commits or worktrees', () => {
    const grader = stayedDry(gradersFor(ECHO, echo));
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
      'if true; then\n  git commit -m x\nfi',
      'cd docs && \\\n  git commit -am x',
      '  git commit -m x',
      'GIT_AUTHOR_NAME=x git commit -m y',
      'env X=1 git push',
      'sudo git push',
      '{ git add .; }',
      'echo `git stash`',
      'git --no-pager commit -m x',
      'git checkout .',
      'git checkout HEAD -- README.md',
      'git checkout -f main',
      'git switch --discard-changes main',
      'git tag -a v1.0.1 -m x',
      'git tag -d v1',
    ]) {
      expect(passes(grader, call(command)), command).toBe(true);
    }
  });

  it('lets read-only git through, and prose that only mentions a command', () => {
    const grader = stayedDry(gradersFor(ECHO, echo));
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
      call('git tag --sort=-v:refname'),
      call('git tag -n'),
      call('git tag --contains HEAD'),
      call('git tag --points-at HEAD'),
      call('git clean -n'),
      call('git clean --dry-run -d'),
      call('git rm --dry-run old.ts'),
      call('git mv -n a b'),
      call('git reset --help'),
      call('git --no-pager log -5'),
      call('git --no-pager diff main...HEAD'),
      call('cat docs/release.md | grep reset'),
      '"type":"text","text":"Next I would run git switch -c fix/126-credits."',
    ]) {
      expect(passes(grader, text), text).toBe(false);
    }
  });
});
