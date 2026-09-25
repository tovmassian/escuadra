import { describe, expect, it } from 'vitest';
import { fixture } from '../fixtures/load.ts';
import type { EasBuild } from '../../lib/release.ts';
import { runStoreBuild, type BuildContext } from '../../flows/build.ts';
import { fakeRunner, json, ok, ran } from '../fake-runner.ts';

const builds = fixture<EasBuild[]>('builds.json');
const IOS_1_0_0 = '8b8b8840bd6e265b91976ef4690a9ef5cb632508';
const NEW_RUNTIME = '1234567890abcdef1234567890abcdef12345678';

const BUILT: EasBuild = {
  id: 'b4',
  status: 'FINISHED',
  platform: 'IOS',
  buildProfile: 'production',
  appVersion: '1.1.0',
  appBuildVersion: '4',
  runtime: { version: NEW_RUNTIME },
  fingerprint: { hash: NEW_RUNTIME },
  gitCommitHash: null,
  createdAt: '2026-10-01T09:00:00.000Z',
};

const ctx: BuildContext = {
  repo: 'tovmassian/escuadra',
  branch: 'release/1.1.0',
  platform: 'ios',
  profile: 'production',
  submit: true,
  rebuild: false,
  appJsonVersion: '1.1.0',
  account: 'tovmassian27',
  runUrl: 'https://github.com/tovmassian/escuadra/actions/runs/1',
};

function world(
  options: { fingerprint?: string; built?: Partial<EasBuild>; viewed?: Partial<EasBuild> } = {},
) {
  return fakeRunner(({ tool, args }) => {
    const [sub] = args;
    if (tool === 'eas' && sub === 'build:list') return json(builds);
    if (tool === 'eas' && sub === 'fingerprint:generate')
      return json({ hash: options.fingerprint ?? NEW_RUNTIME });
    if (tool === 'eas' && sub === 'build') return json([{ ...BUILT, ...options.built }]);
    if (tool === 'eas' && sub === 'build:view')
      return json({ ...BUILT, ...options.built, ...options.viewed });
    if (tool === 'gh' && sub === 'issue')
      return ok('https://github.com/tovmassian/escuadra/issues/81\n');
    return undefined;
  });
}

describe('runStoreBuild', () => {
  it('builds an open platform, checks the runtime and opens the freeze', async () => {
    const runner = world();
    const outcome = await runStoreBuild(runner, ctx);
    expect(outcome.status).toBe('done');
    expect(runner.calls.find((call) => call.args[0] === 'build')?.args).toContain('--auto-submit');
    expect(ran(runner.calls, 'gh', 'issue')).toBe(true);
    expect(outcome.summary).toContain('Submit for Review');
  });

  it('refuses an app.json version that differs from the branch before touching EAS', async () => {
    const runner = world();
    expect((await runStoreBuild(runner, { ...ctx, appJsonVersion: '1.0.0' })).status).toBe(
      'failed',
    );
    expect(runner.calls).toEqual([]);
  });

  it('refuses a locked platform on another runtime', async () => {
    const runner = world({ fingerprint: NEW_RUNTIME });
    const locked = { ...ctx, branch: 'release/1.0.0', appJsonVersion: '1.0.0', rebuild: true };
    const outcome = await runStoreBuild(runner, locked);
    expect(outcome.status).toBe('failed');
    expect(outcome.summary).toContain('needs a new version');
    expect(ran(runner.calls, 'eas', 'build')).toBe(false);
  });

  it('rebuilds the same runtime only when asked', async () => {
    const locked = { ...ctx, branch: 'release/1.0.0', appJsonVersion: '1.0.0' };
    const same = {
      fingerprint: IOS_1_0_0,
      built: { appVersion: '1.0.0', runtime: { version: IOS_1_0_0 } },
    };
    expect((await runStoreBuild(world(same), locked)).status).toBe('failed');
    expect((await runStoreBuild(world(same), { ...locked, rebuild: true })).status).toBe('done');
  });

  it('fails loudly when EAS built another runtime than the runner computed', async () => {
    const runner = world({
      built: { runtime: { version: 'ffffffffffffffffffffffffffffffffffffffff' } },
    });
    const outcome = await runStoreBuild(runner, ctx);
    expect(outcome.status).toBe('failed');
    expect(outcome.summary).toContain('🚨');
    expect(ran(runner.calls, 'gh', 'issue')).toBe(false);
  });

  it('a preview build never submits or freezes', async () => {
    const runner = world({ built: { buildProfile: 'preview' } });
    const outcome = await runStoreBuild(runner, { ...ctx, profile: 'preview' });
    expect(outcome.status).toBe('done');
    expect(runner.calls.find((call) => call.args[0] === 'build')?.args).not.toContain(
      '--auto-submit',
    );
    expect(ran(runner.calls, 'gh', 'issue')).toBe(false);
  });

  it('re-reads the build after --auto-submit, whose JSON can carry the status from enqueue', async () => {
    const runner = world({ built: { status: 'IN_QUEUE' }, viewed: { status: 'FINISHED' } });
    const outcome = await runStoreBuild(runner, ctx);
    expect(outcome.status).toBe('done');
    expect(runner.calls.find((call) => call.args[0] === 'build:view')?.args).toEqual([
      'build:view',
      'b4',
      '--json',
    ]);
    expect(ran(runner.calls, 'gh', 'issue')).toBe(true);
  });

  it("fails a build that didn't finish", async () => {
    expect((await runStoreBuild(world({ built: { status: 'ERRORED' } }), ctx)).status).toBe(
      'failed',
    );
  });
});
