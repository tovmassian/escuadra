import { describe, expect, it } from 'vitest';
import { fixture } from '../fixtures/load.ts';
import type { EasBuild, Platform } from '../../lib/release.ts';
import { fail, fakeRunner, indexOf, json, ok, ran } from '../fake-runner.ts';
import { runGate, type GateContext } from '../../flows/gate.ts';

const builds = fixture<EasBuild[]>('builds.json');
const SHIPPED: Record<Platform, string> = {
  ios: '8b8b8840bd6e265b91976ef4690a9ef5cb632508',
  android: 'a616db8911b507fe2e4b9502b1d48e24a397a84b',
};
const PACKAGE_JSON = JSON.stringify({ dependencies: { expo: '~57.0.22' } });

const ctx: GateContext = {
  repo: 'tovmassian/escuadra',
  baseRef: 'release/1.0.0',
  prNumber: 74,
  labels: ['ota:ios', 'ota:android'],
  appJsonVersion: '1.0.0',
  packageJson: PACKAGE_JSON,
};

function world(
  options: { fingerprints?: Partial<Record<Platform, string>>; mainOnBase?: boolean } = {},
) {
  return fakeRunner(({ tool, args }) => {
    const [sub] = args;
    const path = args.find((arg) => arg.startsWith('repos/')) ?? '';
    if (tool === 'eas' && sub === 'fingerprint:generate') {
      const platform = args[2] as Platform;
      return json({ hash: options.fingerprints?.[platform] ?? SHIPPED[platform] });
    }
    if (tool === 'eas' && sub === 'build:list') return json(builds);
    if (tool === 'eas' && sub === 'fingerprint:compare') {
      return ok(
        '🔄 Fingerprint a616db89 from ANDROID build differs\n📝 Modified content: package.json scripts',
      );
    }
    if (tool === 'git' && args[1] === '--all')
      return ok('c5633fbcd25206a103cf0e5fd3a9ac9c820dc983\n');
    if (tool === 'git' && args[1] === '--is-ancestor')
      return options.mainOnBase === false ? fail(1, '') : ok();
    if (tool === 'git' && sub === 'show') return ok(PACKAGE_JSON);
    if (tool === 'gh' && sub === 'issue') return json([]);
    if (tool === 'gh' && path.endsWith('/files'))
      return ok(JSON.stringify({ filename: 'app/about.tsx', patch: '+const x = 1;' }));
    if (tool === 'gh' && path.endsWith('/comments') && args.includes('--jq')) return ok('');
    if (tool === 'gh' && sub === 'api') return ok('{}');
    return undefined;
  });
}

describe('runGate', () => {
  it('passes a cherry-pick PR that keeps both 1.0.0 runtimes, and comments', async () => {
    const runner = world();
    const report = await runGate(runner, ctx);
    expect(report.passed).toBe(true);
    expect(report.publishable).toEqual(['ios', 'android']);
    expect(report.fingerprints).toEqual(SHIPPED);
    expect(report.body).toContain('✅ OTA-compatible');
    expect(indexOf(runner.calls, 'gh', 'api', 'POST')).toBeGreaterThan(-1);
    expect(ran(runner.calls, 'eas', 'fingerprint:compare')).toBe(false);
  });

  it('fails a PR that moves the Android runtime, and says why', async () => {
    const moved = 'c0a62aca64074feadd73c7042a3a9a8737a30405';
    const report = await runGate(world({ fingerprints: { android: moved } }), ctx);
    expect(report.passed).toBe(false);
    expect(report.publishable).toEqual([]);
    expect(report.body).toContain('❌ runtime changed');
    expect(report.body).toContain('package.json scripts');
  });

  it('fails main history on a locked branch and accepts it on an open one', async () => {
    expect((await runGate(world({ mainOnBase: false }), ctx)).passed).toBe(false);
    const open = await runGate(world({ mainOnBase: false }), {
      ...ctx,
      baseRef: 'release/1.1.0',
      appJsonVersion: '1.1.0',
    });
    expect(open.passed).toBe(true);
    expect(open.body).toContain('no 1.1.0 build yet');
  });

  it("refuses a base that isn't release/X.Y.Z without asking EAS anything", async () => {
    const runner = world();
    const report = await runGate(runner, { ...ctx, baseRef: 'release-1.1.0' });
    expect(report.passed).toBe(false);
    expect(runner.calls.some((call) => call.tool === 'eas')).toBe(false);
  });

  it('dry run: reads no PR and comments nowhere', async () => {
    const runner = world();
    const report = await runGate(runner, { ...ctx, prNumber: null, labels: [] });
    expect(report.passed).toBe(true);
    expect(runner.calls.some((call) => call.tool === 'gh')).toBe(false);
  });

  it('warns when app.json disagrees with the branch', async () => {
    const report = await runGate(world(), { ...ctx, baseRef: 'release/1.1.0' });
    expect(report.body).toContain('`app.json` says 1.0.0 but the branch is 1.1.0');
  });
});
