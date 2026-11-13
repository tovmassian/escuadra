import { describe, expect, it } from 'vitest';
import { runSweep, type SweepContext } from '../../flows/sweep.ts';
import { fakeRunner, indexOf, json, ok, ran, type Call } from '../fake-runner.ts';

const PR_URL = 'https://github.com/tovmassian/escuadra/pull/300';

const ctx: SweepContext = {
  repo: 'tovmassian/escuadra',
  base: 'release/2.0.0',
  today: '2026-11-16',
  envelopes: '/runner/temp/envelopes',
  runUrl: 'https://github.com/tovmassian/escuadra/actions/runs/1',
};

const APPLY_NEW = [
  '  uzb: written — 26 parsed, 4 new, 4 departed',
  '      warning:  4 new player id(s): rustam-ashurmatov, dilshod-murtozoev',
  'apply: 1 written, 0 unchanged, 0 conflicted, 0 held, 0 failed, 0 orphans',
].join('\n');

interface World {
  openSweep?: { number: number; headRefName: string; url: string };
  fetchCode?: number;
  apply?: { code: number; stdout: string };
  enrichCode?: number;
  status?: string;
}

function world(options: World = {}) {
  return fakeRunner(({ tool, args }) => {
    const [first, sub] = args;
    if (tool === 'gh' && first === 'pr' && args[1] === 'list') {
      const open = options.openSweep ? [options.openSweep] : [];
      return json([{ number: 7, headRefName: 'fix/180-scores', url: 'x' }, ...open]);
    }
    if (tool === 'gh' && first === 'pr') return ok(`${PR_URL}\n`);
    if (tool === 'gh' && first === 'workflow') return ok();
    if (tool === 'git' && first === 'status') return ok(options.status ?? ' M data/players.json\n');
    if (tool === 'git') return ok();
    if (tool === 'node' && sub === 'fetch')
      return { code: options.fetchCode ?? 0, stdout: 'fetch: 2 fetched, 0 failed', stderr: '' };
    if (tool === 'node' && sub === 'apply') {
      const apply = options.apply ?? { code: 0, stdout: APPLY_NEW };
      return { ...apply, stderr: apply.code === 5 ? 'data/decisions.json is invalid' : '' };
    }
    if (tool === 'node' && sub === 'enrich')
      return { code: options.enrichCode ?? 0, stdout: '  photos:   2 found', stderr: '' };
    return undefined;
  });
}

const arg = (call: Call | undefined, flag: string) => call?.args[call.args.indexOf(flag) + 1];
const find = (calls: Call[], tool: string, ...prefix: string[]) =>
  calls.find((call) => call.tool === tool && prefix.every((p, i) => call.args[i] === p));

describe('runSweep', () => {
  it('refuses a base that is not a release branch, before touching anything', async () => {
    for (const base of ['', 'main']) {
      const runner = world();
      const outcome = await runSweep(runner, { ...ctx, base });
      expect(outcome.status).toBe('failed');
      expect(outcome.summary).toContain('gh variable set SWEEP_BASE');
      expect(runner.calls).toEqual([]);
    }
  });

  it('sweeps on a fresh dated branch, opens the PR into the base and starts check on it', async () => {
    const runner = world();
    const outcome = await runSweep(runner, ctx);
    expect(outcome.status).toBe('done');
    expect(find(runner.calls, 'git', 'switch', '-c')?.args).toEqual([
      'switch',
      '-c',
      'data/sweep-2026-11-16',
    ]);
    const fetch = find(runner.calls, 'node', 'tools/squadctl/bin/dev.js', 'fetch');
    expect(arg(fetch, '--out')).toBe('/runner/temp/envelopes');
    expect(find(runner.calls, 'node', 'tools/squadctl/bin/dev.js', 'apply')?.args[2]).toBe(
      '/runner/temp/envelopes',
    );
    const pr = find(runner.calls, 'gh', 'pr', 'create');
    expect(arg(pr, '--base')).toBe('release/2.0.0');
    expect(arg(pr, '--head')).toBe('data/sweep-2026-11-16');
    expect(arg(pr, '--title')).toBe('data: weekly sweep');
    expect(arg(pr, '--body')).toContain('uzb: written');
    const check = find(runner.calls, 'gh', 'workflow', 'run', 'check.yml');
    expect(arg(check, '--ref')).toBe('data/sweep-2026-11-16');
    expect(indexOf(runner.calls, 'git', 'push')).toBeLessThan(
      indexOf(runner.calls, 'gh', 'pr', 'create'),
    );
  });

  it('commits only the data squadctl writes, and pushes the sweep branch, never the base', async () => {
    const runner = world();
    await runSweep(runner, ctx);
    expect(find(runner.calls, 'git', 'add')?.args).toEqual([
      'add',
      '--',
      'data',
      'lib/squads.generated.ts',
    ]);
    const pushes = runner.calls.filter((call) => call.tool === 'git' && call.args[0] === 'push');
    expect(pushes.map((call) => call.args)).toEqual([
      ['push', 'origin', 'HEAD:refs/heads/data/sweep-2026-11-16'],
    ]);
  });

  it('adds to an open sweep PR rather than opening a second one', async () => {
    const open = { number: 300, headRefName: 'data/sweep-2026-11-09', url: PR_URL };
    const runner = world({ openSweep: open });
    const outcome = await runSweep(runner, ctx);
    expect(outcome.status).toBe('done');
    expect(find(runner.calls, 'git', 'fetch')?.args).toContain('data/sweep-2026-11-09');
    expect(find(runner.calls, 'git', 'switch')?.args).toEqual([
      'switch',
      '-c',
      'data/sweep-2026-11-09',
      'FETCH_HEAD',
    ]);
    expect(find(runner.calls, 'gh', 'pr', 'create')).toBeUndefined();
    expect(find(runner.calls, 'gh', 'pr', 'edit')?.args[2]).toBe('300');
    const push = find(runner.calls, 'git', 'push');
    expect(push?.args).toEqual(['push', 'origin', 'HEAD:refs/heads/data/sweep-2026-11-09']);
    expect(push?.args).not.toContain('--force');
  });

  it('opens nothing in a quiet week', async () => {
    const runner = world({ status: '', apply: { code: 0, stdout: 'apply: 0 written' } });
    const outcome = await runSweep(runner, ctx);
    expect(outcome.status).toBe('skipped');
    expect(ran(runner.calls, 'git', 'commit')).toBe(false);
    expect(ran(runner.calls, 'git', 'push')).toBe(false);
    expect(find(runner.calls, 'gh', 'pr', 'create')).toBeUndefined();
    expect(ran(runner.calls, 'gh', 'workflow')).toBe(false);
  });

  it('applies what was fetched when some teams failed to fetch', async () => {
    const runner = world({ fetchCode: 3 });
    expect((await runSweep(runner, ctx)).status).toBe('done');
  });

  it('opens the PR with conflicts in it: they are answered on its branch', async () => {
    const runner = world({ apply: { code: 4, stdout: '  aus: conflicted (verified: false) — x' } });
    expect((await runSweep(runner, ctx)).status).toBe('done');
    expect(arg(find(runner.calls, 'gh', 'pr', 'create'), '--body')).toContain('aus: conflicted');
  });

  it('fails, writing nothing, when apply hits a repo error', async () => {
    const runner = world({ apply: { code: 5, stdout: '' } });
    const outcome = await runSweep(runner, ctx);
    expect(outcome.status).toBe('failed');
    expect(outcome.summary).toContain('data/decisions.json is invalid');
    expect(ran(runner.calls, 'git', 'commit')).toBe(false);
  });

  it('looks up photos only for the teams with new players', async () => {
    const runner = world();
    await runSweep(runner, ctx);
    const enrich = find(runner.calls, 'node', 'tools/squadctl/bin/dev.js', 'enrich');
    expect(arg(enrich, '--only')).toBe('uzb');
  });

  it('skips enrich when nobody new arrived', async () => {
    const runner = world({
      apply: { code: 0, stdout: '  fro: written — 24 parsed, 0 new, 5 departed' },
    });
    await runSweep(runner, ctx);
    expect(find(runner.calls, 'node', 'tools/squadctl/bin/dev.js', 'enrich')).toBeUndefined();
  });

  it("still opens the PR when Wikimedia can't be reached, with the local command", async () => {
    const runner = world({ enrichCode: 1 });
    expect((await runSweep(runner, ctx)).status).toBe('done');
    expect(arg(find(runner.calls, 'gh', 'pr', 'create'), '--body')).toContain('enrich --only uzb');
  });

  it('fails when enrich hits a repo error', async () => {
    const runner = world({ enrichCode: 5 });
    expect((await runSweep(runner, ctx)).status).toBe('failed');
    expect(ran(runner.calls, 'git', 'commit')).toBe(false);
  });
});
