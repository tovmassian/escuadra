import { describe, expect, it } from 'vitest';
import { fixture } from '../fixtures/load.ts';
import type { EasBuild } from '../lib/release.ts';
import type { UpdateGroupSummary } from '../lib/updates.ts';
import { fakeRunner, indexOf, json, ok, ran } from './fake-runner.ts';
import { runRollback, type RollbackContext, type Waiter } from './rollback.ts';

const builds = fixture<EasBuild[]>('builds.json');
const history = fixture<UpdateGroupSummary[]>('updates-production.json');
const IOS = '8b8b8840bd6e265b91976ef4690a9ef5cb632508';
const NEW_GROUP = '9a8b7c6d-0000-0000-0000-000000000000';

const ctx: RollbackContext = {
  repo: 'tovmassian/escuadra',
  branch: 'release/1.0.0',
  platform: 'ios',
  channel: 'production',
  mode: 'previous',
  groupId: null,
  reason: 'About screen crashes',
  dryRun: false,
  runUrl: 'https://github.com/tovmassian/escuadra/actions/runs/1',
};

interface World {
  active?: number[];
  groups?: UpdateGroupSummary[];
  newestAfter?: string;
}

function world(w: World = {}) {
  const active = [...(w.active ?? [0])];
  let rolledBack = false;
  return fakeRunner(({ tool, args }) => {
    const [sub] = args;
    if (tool === 'eas' && sub === 'build:list') return json(builds);
    if (tool === 'eas' && sub === 'update:list') {
      const page = (w.groups ?? history).filter(
        (g) => g.platforms === 'ios' && g.runtimeVersion === IOS,
      );
      const newest: UpdateGroupSummary = {
        group: w.newestAfter ?? NEW_GROUP,
        runtimeVersion: IOS,
        platforms: 'ios',
        isRollBackToEmbedded: false,
        message: '"Rollback: About screen crashes" (just now by robot)',
      };
      const limit = Number(args[args.indexOf('--limit') + 1]);
      return json({ currentPage: (rolledBack ? [newest, ...page] : page).slice(0, limit) });
    }
    if (tool === 'gh' && sub === 'issue')
      return ok('https://github.com/tovmassian/escuadra/issues/80\n');
    if (tool === 'gh' && sub === 'run')
      return json(Array.from({ length: active.shift() ?? 0 }, () => ({ status: 'in_progress' })));
    if (tool === 'eas' && (sub === 'update:republish' || sub === 'update:roll-back-to-embedded')) {
      rolledBack = true;
      return json([
        {
          id: 'r1',
          group: NEW_GROUP,
          platform: 'ios',
          runtimeVersion: IOS,
          isRollBackToEmbedded: sub !== 'update:republish',
        },
      ]);
    }
    return undefined;
  });
}

function waiter(): Waiter & { sleeps: number } {
  const state: Waiter & { sleeps: number } = {
    sleeps: 0,
    pollMs: 1,
    maxPolls: 2,
    sleep: async () => {
      state.sleeps += 1;
    },
  };
  return state;
}

describe('runRollback', () => {
  it('freezes first, waits out a running publish, republishes the previous group and verifies', async () => {
    const runner = world({ active: [1, 0] });
    const wait = waiter();
    const outcome = await runRollback(runner, ctx, wait);
    expect(outcome.status).toBe('done');
    expect(indexOf(runner.calls, 'gh', 'issue')).toBeLessThan(
      indexOf(runner.calls, 'eas', 'update:republish'),
    );
    expect(wait.sleeps).toBe(1);
    const republish = runner.calls.find((call) => call.args[0] === 'update:republish');
    expect(republish?.args).toEqual(
      expect.arrayContaining(['--group', '02f7fad4-83fc-41f3-8a14-04892984be7d']),
    );
    expect(outcome.summary).toContain('"Correct privacy text (#61)"');
    expect(outcome.summary).toContain('Freeze opened');
  });

  it('dry run: shows the target and changes nothing', async () => {
    const runner = world();
    const outcome = await runRollback(runner, { ...ctx, dryRun: true }, waiter());
    expect(outcome.status).toBe('skipped');
    expect(outcome.summary).toContain('Dry run');
    expect(ran(runner.calls, 'gh', 'issue')).toBe(false);
    expect(ran(runner.calls, 'eas', 'update:republish')).toBe(false);
  });

  it('refuses without a freeze when there is nothing earlier', async () => {
    const onlyNewest = history.filter((g) => g.group === 'e43368a2-cfde-483d-a99d-fd1e9bc2691f');
    const runner = world({ groups: onlyNewest });
    expect((await runRollback(runner, ctx, waiter())).status).toBe('failed');
    expect(ran(runner.calls, 'gh', 'issue')).toBe(false);
  });

  it('preview: no freeze and no waiting', async () => {
    const runner = world();
    expect((await runRollback(runner, { ...ctx, channel: 'preview' }, waiter())).status).toBe(
      'done',
    );
    expect(ran(runner.calls, 'gh', 'issue')).toBe(false);
    expect(ran(runner.calls, 'gh', 'run')).toBe(false);
  });

  it('gives up without rolling back while publishes keep running, and keeps the freeze', async () => {
    const runner = world({ active: [1, 1, 1, 1] });
    const outcome = await runRollback(runner, ctx, waiter());
    expect(outcome.status).toBe('failed');
    expect(ran(runner.calls, 'gh', 'issue')).toBe(true);
    expect(ran(runner.calls, 'eas', 'update:republish')).toBe(false);
  });

  it('embedded: rolls the runtime back to the JS inside build 3', async () => {
    const runner = world();
    expect((await runRollback(runner, { ...ctx, mode: 'embedded' }, waiter())).status).toBe('done');
    const call = runner.calls.find((c) => c.args[0] === 'update:roll-back-to-embedded');
    expect(call?.args).toEqual(
      expect.arrayContaining(['--runtime-version', IOS, '--platform', 'ios']),
    );
  });

  it('fails loudly when something else is newest afterwards', async () => {
    const outcome = await runRollback(
      world({ newestAfter: 'ffffffff-0000-0000-0000-000000000000' }),
      ctx,
      waiter(),
    );
    expect(outcome.status).toBe('failed');
    expect(outcome.summary).toContain('🚨');
  });
});
