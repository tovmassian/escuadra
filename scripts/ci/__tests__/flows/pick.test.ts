import { describe, expect, it } from 'vitest';
import { runPick, type PickContext } from '../../flows/pick.ts';
import { fail, fakeRunner, indexOf, ok, ran } from '../fake-runner.ts';

const SHA = '4a8b8a5c0000000000000000000000000000beef';
const PR_URL = 'https://github.com/tovmassian/escuadra/pull/97';

const ctx: PickContext = {
  repo: 'tovmassian/escuadra',
  prNumber: 94,
  baseRef: 'release/1.0.1',
  sha: SHA,
};

interface World {
  message?: string;
  pickedByHand?: string;
  branchExists?: boolean;
  conflict?: string;
  empty?: boolean;
  prCreateFails?: boolean;
}

function world(options: World = {}) {
  return fakeRunner(({ tool, args }) => {
    const [sub] = args;
    if (tool === 'git' && sub === 'log' && args[1] === 'origin/main')
      return ok(options.pickedByHand ?? '');
    if (tool === 'git' && sub === 'log')
      return ok(options.message ?? 'fix(android): inset the icon (#94)\n\n* body\n');
    if (tool === 'git' && sub === 'ls-remote') return options.branchExists ? ok('abc\n') : fail(2);
    if (tool === 'git' && sub === 'switch') return ok();
    if (tool === 'git' && sub === 'cherry-pick' && args[1] === '-x')
      return options.conflict !== undefined || options.empty ? fail(1, 'could not apply') : ok();
    if (tool === 'git' && sub === 'cherry-pick' && args[1] === '--abort') return ok();
    if (tool === 'git' && sub === 'diff') return ok(options.conflict ?? '');
    if (tool === 'git' && sub === 'push') return ok();
    if (tool === 'gh' && sub === 'pr')
      return options.prCreateFails
        ? fail(1, 'GitHub Actions is not permitted to create or approve pull requests')
        : ok(`${PR_URL}\n`);
    if (tool === 'gh' && sub === 'workflow') return ok();
    if (tool === 'gh' && sub === 'api') return ok('{}');
    return undefined;
  });
}

const comments = (calls: { tool: string; args: string[] }[]) =>
  calls
    .filter((call) => call.tool === 'gh' && call.args.includes('POST'))
    .map((call) => call.args.find((arg) => arg.startsWith('body=')) ?? '');

describe('runPick', () => {
  it('picks onto main, opens the PR, starts check on it and says so on the release PR', async () => {
    const runner = world();
    const outcome = await runPick(runner, ctx);
    expect(outcome.status).toBe('done');
    const pr = runner.calls.find((call) => call.args[0] === 'pr')?.args ?? [];
    expect(pr[pr.indexOf('--base') + 1]).toBe('main');
    expect(pr[pr.indexOf('--head') + 1]).toBe('pick/94-to-main');
    expect(pr[pr.indexOf('--title') + 1]).toBe('fix(android): inset the icon (#94)');
    const dispatch = runner.calls.find((call) => call.args[0] === 'workflow')?.args;
    expect(dispatch).toEqual([
      'workflow',
      'run',
      'check.yml',
      '--repo',
      'tovmassian/escuadra',
      '--ref',
      'pick/94-to-main',
    ]);
    expect(indexOf(runner.calls, 'git', 'switch', 'origin/main')).toBeLessThan(
      indexOf(runner.calls, 'git', 'cherry-pick', '-x'),
    );
    expect(indexOf(runner.calls, 'git', 'push')).toBeLessThan(indexOf(runner.calls, 'gh', 'pr'));
    expect(comments(runner.calls)).toEqual([`body=↪️ Taking this to \`main\`: ${PR_URL}`]);
  });

  it('never takes a pick from main back to main', async () => {
    const runner = world({
      message: 'fix: UI polish (#91) (#92)\n\n(cherry picked from commit b0eb46fd1234567)\n',
    });
    expect((await runPick(runner, ctx)).status).toBe('skipped');
    expect(ran(runner.calls, 'git', 'switch')).toBe(false);
  });

  it('skips a commit someone already picked by hand, before git can call it a conflict', async () => {
    const runner = world({ pickedByHand: 'b0eb46f\n' });
    const outcome = await runPick(runner, ctx);
    expect(outcome.status).toBe('skipped');
    expect(outcome.summary).toContain('b0eb46f');
    const grep = runner.calls.find((call) => call.args[1] === 'origin/main')?.args ?? [];
    expect(grep).toContain(`--grep=(cherry picked from commit ${SHA})`);
    expect(grep).toContain('--fixed-strings');
    expect(ran(runner.calls, 'git', 'cherry-pick')).toBe(false);
  });

  it('does nothing when an earlier run already pushed the branch', async () => {
    const runner = world({ branchExists: true });
    expect((await runPick(runner, ctx)).status).toBe('skipped');
    expect(ran(runner.calls, 'git', 'cherry-pick')).toBe(false);
  });

  it('hands a conflict back on the release PR, pushing nothing', async () => {
    const runner = world({ conflict: 'app.json\n' });
    const outcome = await runPick(runner, ctx);
    expect(outcome.status).toBe('failed');
    expect(outcome.summary).toContain('`app.json`');
    expect(ran(runner.calls, 'git', 'push')).toBe(false);
    expect(indexOf(runner.calls, 'git', 'cherry-pick', '--abort')).toBeGreaterThan(-1);
    expect(comments(runner.calls)[0]).toContain(`git cherry-pick -x ${SHA}`);
  });

  it('skips a change main already has', async () => {
    const runner = world({ empty: true });
    expect((await runPick(runner, ctx)).status).toBe('skipped');
    expect(ran(runner.calls, 'git', 'push')).toBe(false);
    expect(comments(runner.calls)).toEqual([]);
  });

  it('says how to finish by hand when Actions may not open PRs', async () => {
    const runner = world({ prCreateFails: true });
    const outcome = await runPick(runner, ctx);
    expect(outcome.status).toBe('failed');
    expect(ran(runner.calls, 'gh', 'workflow')).toBe(false);
    expect(comments(runner.calls)[0]).toContain(
      'Allow GitHub Actions to create and approve pull requests',
    );
  });
});
