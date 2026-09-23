import { describe, expect, it } from 'vitest';
import type { EasBuild } from '../lib/release.ts';
import { COMMENT_MARKER } from '../lib/render.ts';
import { fakeRunner, json, ok, ran } from './fake-runner.ts';
import { runPreview, type PreviewContext } from './preview.ts';

const IOS = '8b8b8840bd6e265b91976ef4690a9ef5cb632508';
const ANDROID = 'a616db8911b507fe2e4b9502b1d48e24a397a84b';
const PREVIEW_IOS: EasBuild = {
  id: 'p1',
  status: 'FINISHED',
  platform: 'IOS',
  buildProfile: 'preview',
  appVersion: '1.0.0',
  appBuildVersion: '4',
  runtime: { version: IOS },
  fingerprint: { hash: IOS },
  gitCommitHash: 'c5633fbcd25206a103cf0e5fd3a9ac9c820dc983',
  createdAt: '2026-09-30T10:00:00.000Z',
};
const GATE_BODY = `${COMMENT_MARKER}\n**Labels:** ota:ios\n\n<!-- preview -->**Preview:** after this check passes<!-- /preview -->`;

const ctx: PreviewContext = {
  repo: 'tovmassian/escuadra',
  prNumber: 74,
  prTitle: 'fix: show the update ID on About',
  headSha: '1111111111111111111111111111111111111111',
  platforms: ['ios', 'android'],
  fingerprints: { ios: IOS, android: ANDROID },
};

function world(options: { files?: string[]; publishedRuntime?: string } = {}) {
  return fakeRunner(({ tool, args }) => {
    const [sub] = args;
    const path = args.find((arg) => arg.startsWith('repos/')) ?? '';
    if (tool === 'gh' && path.endsWith('/files')) {
      return ok(
        (options.files ?? ['app/about.tsx'])
          .map((filename) => JSON.stringify({ filename, patch: null }))
          .join('\n'),
      );
    }
    if (tool === 'eas' && sub === 'build:list') {
      return json(args.includes('ios') ? [PREVIEW_IOS] : []);
    }
    if (tool === 'eas' && sub === 'update') {
      return json([
        {
          id: 'u',
          group: '1a2b3c4d-0000-0000-0000-000000000000',
          platform: 'ios',
          runtimeVersion: options.publishedRuntime ?? IOS,
          isRollBackToEmbedded: false,
        },
      ]);
    }
    if (tool === 'gh' && path.endsWith('/comments'))
      return ok(JSON.stringify({ id: 9, body: GATE_BODY }));
    if (tool === 'gh' && sub === 'api') return ok('{}');
    return undefined;
  });
}

describe('runPreview', () => {
  it('publishes iOS, skips Android without a preview build, and fills the comment', async () => {
    const runner = world();
    const outcome = await runPreview(runner, ctx);
    expect(outcome.status).toBe('done');
    expect(outcome.summary).toContain('iOS → group `1a2b3c4d`');
    expect(outcome.summary).toContain('Android: skipped, no preview build on runtime `a616db89`');
    // Pinned: the preview token can reach any channel, since protection isn't available.
    const args =
      runner.calls.find((call) => call.tool === 'eas' && call.args[0] === 'update')?.args ?? [];
    expect(args[args.indexOf('--channel') + 1]).toBe('preview');
    expect(args[args.indexOf('--environment') + 1]).toBe('preview');
    const patch = runner.calls.find((call) => call.args.includes('PATCH'));
    expect(patch?.args.find((arg) => arg.startsWith('body='))).toContain('iOS → group `1a2b3c4d`');
  });

  it('publishes nothing for a docs-only PR', async () => {
    const runner = world({ files: ['docs/release.md'] });
    expect((await runPreview(runner, ctx)).status).toBe('skipped');
    expect(ran(runner.calls, 'eas', 'update')).toBe(false);
  });

  it('fails when the published runtime differs from the gate fingerprint', async () => {
    const outcome = await runPreview(
      world({ publishedRuntime: 'ffffffffffffffffffffffffffffffffffffffff' }),
      ctx,
    );
    expect(outcome.status).toBe('failed');
  });
});
