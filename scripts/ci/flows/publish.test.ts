import { describe, expect, it } from 'vitest';
import { fixture } from '../fixtures/load.ts';
import type { Issue } from '../lib/freeze.ts';
import type { EasBuild } from '../lib/release.ts';
import type { UpdateGroupSummary } from '../lib/updates.ts';
import { fakeRunner, json, ok, ran } from './fake-runner.ts';
import { runPublish, type PublishContext } from './publish.ts';

const builds = fixture<EasBuild[]>('builds.json');
const history = fixture<UpdateGroupSummary[]>('updates-production.json');
const IOS = '8b8b8840bd6e265b91976ef4690a9ef5cb632508';
const HEAD = '1111111111111111111111111111111111111111';

const ctx: PublishContext = {
  repo: 'tovmassian/escuadra',
  branch: 'release/1.0.0',
  sha: HEAD,
  platform: 'ios',
  message: 'fix: show the update ID on About (#74)',
  trigger: 'push',
  prNumber: 74,
  account: 'tovmassian27',
};

interface World {
  fingerprint?: string;
  freezes?: Issue[];
  newestCommit?: string;
  publishedRuntime?: string;
}

function world(w: World = {}) {
  return fakeRunner(({ tool, args }) => {
    const [sub] = args;
    if (tool === 'eas' && sub === 'build:list') return json(builds);
    if (tool === 'eas' && sub === 'fingerprint:generate')
      return json({ hash: w.fingerprint ?? IOS });
    if (tool === 'gh' && sub === 'issue') return json(w.freezes ?? []);
    if (tool === 'eas' && sub === 'update:list') {
      return json({
        currentPage: history
          .filter((g) => g.platforms === 'ios' && g.runtimeVersion === IOS)
          .slice(0, 1),
      });
    }
    if (tool === 'eas' && sub === 'update:view') {
      return json([
        {
          id: 'u0',
          group: 'e43368a2-cfde-483d-a99d-fd1e9bc2691f',
          platform: 'ios',
          runtimeVersion: IOS,
          gitCommitHash: w.newestCommit ?? 'daf142b21e841e33c8575ba3241b8a4bcdbf982b',
          isRollBackToEmbedded: false,
        },
      ]);
    }
    if (tool === 'eas' && sub === 'update') {
      return json([
        {
          id: 'u1',
          group: '5e6f7a8b-0000-0000-0000-000000000000',
          platform: 'ios',
          runtimeVersion: w.publishedRuntime ?? IOS,
          gitCommitHash: HEAD,
          isRollBackToEmbedded: false,
        },
      ]);
    }
    if (tool === 'eas' && sub === 'account:usage') {
      return json({
        updates: {
          uniqueUpdaters: { plan: { used: 44, limit: 1000 } },
          bandwidth: { plan: { usedBytes: 272507447, limitBytes: 107374182400 } },
        },
      });
    }
    if (tool === 'gh' && sub === 'api') return ok('{}');
    return undefined;
  });
}

const published = (calls: Parameters<typeof ran>[0]): boolean => ran(calls, 'eas', 'update');

describe('runPublish', () => {
  it('publishes a locked, matching, unfrozen commit and comments on the PR', async () => {
    const runner = world();
    const outcome = await runPublish(runner, ctx);
    expect(outcome.status).toBe('done');
    expect(outcome.summary).toContain('matches build 3');
    expect(outcome.summary).toContain('44 / 1,000 update users');
    const update = runner.calls.find((call) => call.tool === 'eas' && call.args[0] === 'update');
    expect(update?.args).toEqual(
      expect.arrayContaining(['--channel', 'production', '--platform', 'ios']),
    );
    expect(
      runner.calls.some((call) =>
        call.args.includes('repos/tovmassian/escuadra/issues/74/comments'),
      ),
    ).toBe(true);
  });

  it('never publishes while the platform and version are frozen', async () => {
    const freeze = {
      number: 80,
      title: 'OTA freeze: ios@1.0.0',
      url: 'https://github.com/tovmassian/escuadra/issues/80',
    };
    const runner = world({ freezes: [freeze] });
    const outcome = await runPublish(runner, ctx);
    expect(outcome.status).toBe('failed');
    expect(outcome.summary).toContain('#80');
    expect(published(runner.calls)).toBe(false);
  });

  it('ignores a freeze for another version', async () => {
    const freeze = {
      number: 81,
      title: 'OTA freeze: ios@1.1.0',
      url: 'https://github.com/tovmassian/escuadra/issues/81',
    };
    expect((await runPublish(world({ freezes: [freeze] }), ctx)).status).toBe('done');
  });

  it('never publishes a commit whose fingerprint moved', async () => {
    const runner = world({ fingerprint: 'c0a62aca64074feadd73c7042a3a9a8737a30405' });
    expect((await runPublish(runner, ctx)).status).toBe('failed');
    expect(published(runner.calls)).toBe(false);
  });

  it('skips a push to an open version but fails a manual run', async () => {
    const open = { ...ctx, branch: 'release/1.1.0' };
    expect((await runPublish(world(), open)).status).toBe('skipped');
    expect((await runPublish(world(), { ...open, trigger: 'dispatch' })).status).toBe('failed');
  });

  it('skips when the newest production update already came from this commit', async () => {
    const runner = world({ newestCommit: HEAD });
    expect((await runPublish(runner, ctx)).status).toBe('skipped');
    expect(published(runner.calls)).toBe(false);
  });

  it('fails loudly when the published runtime differs from the build', async () => {
    const outcome = await runPublish(
      world({ publishedRuntime: 'ffffffffffffffffffffffffffffffffffffffff' }),
      ctx,
    );
    expect(outcome.status).toBe('failed');
    expect(outcome.summary).toContain('🚨');
  });

  it("refuses a branch that isn't release/X.Y.Z before touching EAS", async () => {
    const runner = world();
    expect((await runPublish(runner, { ...ctx, branch: 'main' })).status).toBe('failed');
    expect(runner.calls).toEqual([]);
  });
});
