import { describe, expect, it } from 'vitest';
import { fakeRunner, json, ok } from './fake-runner.ts';
import { activeRuns, pullRequestsForCommit, upsertComment } from './github.ts';

describe('upsertComment', () => {
  it('edits the marked comment when there is one, creates one otherwise', async () => {
    const comments = [
      JSON.stringify({ id: 7, body: 'other' }),
      JSON.stringify({ id: 9, body: '<!-- release-gate -->\nold' }),
    ].join('\n');
    const existing = fakeRunner(({ args }) => (args.includes('--jq') ? ok(comments) : ok('{}')));
    await upsertComment(existing, 'o/r', 12, '<!-- release-gate -->', 'new');
    expect(existing.calls[existing.calls.length - 1]?.args).toEqual([
      'api',
      '--method',
      'PATCH',
      'repos/o/r/issues/comments/9',
      '-f',
      'body=new',
    ]);

    const none = fakeRunner(({ args }) => (args.includes('--jq') ? ok('') : ok('{}')));
    await upsertComment(none, 'o/r', 12, '<!-- release-gate -->', 'new');
    expect(none.calls[none.calls.length - 1]?.args).toEqual([
      'api',
      '--method',
      'POST',
      'repos/o/r/issues/12/comments',
      '-f',
      'body=new',
    ]);
  });
});

describe('pullRequestsForCommit', () => {
  it('keeps number, title, labels, base and merged state', async () => {
    const runner = fakeRunner(() =>
      json([
        {
          number: 74,
          title: 'fix: About',
          labels: [{ name: 'ota:ios' }],
          merged_at: '2026-10-01T00:00:00Z',
          base: { ref: 'release/1.0.0' },
        },
      ]),
    );
    expect(await pullRequestsForCommit(runner, 'o/r', 'abc')).toEqual([
      {
        number: 74,
        title: 'fix: About',
        labels: ['ota:ios'],
        baseRef: 'release/1.0.0',
        merged: true,
      },
    ]);
  });
});

describe('activeRuns', () => {
  it('counts runs that have not completed', async () => {
    const runner = fakeRunner(() =>
      json([{ status: 'completed' }, { status: 'in_progress' }, { status: 'queued' }]),
    );
    expect(await activeRuns(runner, 'o/r', 'ota-production.yml', 'release/1.0.0')).toBe(2);
  });
});
