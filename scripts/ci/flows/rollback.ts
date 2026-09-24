// `ota-rollback` for one platform. Production: open the freeze first (the bad commit
// is still on the branch and the next merged PR would publish it again), wait out
// running publishes, roll back, verify. Preview: the same without freeze or wait.
// §9 of the design, plus a dry run.
import { done, failed, skipped, type Outcome } from '../lib/outcome.ts';
import {
  PLATFORM_NAMES,
  lockState,
  parseReleaseBranch,
  short,
  type Platform,
} from '../lib/release.ts';
import { cleanMessage, rollbackTarget, type RollbackMode } from '../lib/updates.ts';
import { listBuilds, listUpdateGroups, republishGroup, rollBackToEmbedded } from './eas.ts';
import { activeRuns, createFreeze } from './github.ts';
import type { Runner } from './runner.ts';

export interface RollbackContext {
  repo: string;
  branch: string;
  platform: Platform;
  channel: 'production' | 'preview';
  mode: RollbackMode;
  groupId: string | null;
  reason: string;
  dryRun: boolean;
  runUrl: string;
}

export interface Waiter {
  sleep(ms: number): Promise<void>;
  pollMs: number;
  maxPolls: number;
}

export async function runRollback(
  runner: Runner,
  ctx: RollbackContext,
  waiter: Waiter,
): Promise<Outcome> {
  const name = PLATFORM_NAMES[ctx.platform];
  const version = parseReleaseBranch(ctx.branch);
  if (!version) return failed(`\`${ctx.branch}\` isn't a release branch.`);
  const builds = await listBuilds(runner, {
    platform: ctx.platform,
    profile: 'production',
    appVersion: version,
  });
  const lock = lockState(builds, ctx.platform, version);
  if (lock.state !== 'locked')
    return failed(`${name} ${version} has no finished production build: nothing to roll back.`);

  const history = await listUpdateGroups(runner, ctx.channel, ctx.platform, lock.runtime, 10);
  const target = rollbackTarget(history, ctx.platform, lock.runtime, ctx.mode, ctx.groupId);
  if (target.kind === 'error') return failed(target.message);

  const from = target.from
    ? `"${cleanMessage(target.from.message)}" (\`${short(target.from.group)}\`)`
    : 'the embedded JS';
  const to =
    target.kind === 'republish'
      ? `"${cleanMessage(target.to.message)}" (\`${short(target.to.group)}\`)`
      : `the JS inside build ${lock.build.appBuildVersion}`;
  const headline = `⏪ ${ctx.channel} · ${name} · ${version} · ${from} → ${to}`;
  if (ctx.dryRun) return skipped(`${headline}\n\nDry run: nothing changed.`);

  let freezeUrl: string | null = null;
  if (ctx.channel === 'production') {
    freezeUrl = await createFreeze(
      runner,
      ctx.repo,
      ctx.platform,
      version,
      `Rolled back by ${ctx.runUrl}: ${ctx.reason}\n\nThe bad change is still on \`${ctx.branch}\`. ` +
        'Revert or fix it there (cherry-picked from `main`), then close this issue to let production publishes through.',
    );
    for (
      let poll = 0;
      (await activeRuns(runner, ctx.repo, 'ota-production.yml', ctx.branch)) > 0;
      poll += 1
    ) {
      if (poll >= waiter.maxPolls) {
        return failed(
          `${headline}\n\nota-production is still running on ${ctx.branch}, so nothing was rolled back. ` +
            `The freeze (${freezeUrl}) stays; re-run this rollback.`,
        );
      }
      await waiter.sleep(waiter.pollMs);
    }
  }

  const message = `Rollback: ${ctx.reason}`;
  const newGroup =
    target.kind === 'republish'
      ? await republishGroup(runner, target.to.group, ctx.platform, message)
      : await rollBackToEmbedded(runner, ctx.channel, ctx.platform, lock.runtime, message);

  const [newest] = await listUpdateGroups(runner, ctx.channel, ctx.platform, lock.runtime, 1);
  if (!newest || newest.group !== newGroup) {
    return failed(
      `${headline}\n\n🚨 Rolled back as \`${short(newGroup)}\`, but the newest ${name} update is ` +
        `\`${short(newest?.group)}\`. Check \`eas update:list\` and re-run.`,
    );
  }
  return done(
    [
      headline,
      `New group \`${short(newGroup)}\` · runtime \`${short(lock.runtime)}\` ✅ build ${lock.build.appBuildVersion}`,
      freezeUrl
        ? `Freeze opened: ${freezeUrl}. Revert the bad change on ${ctx.branch}, then close it.`
        : 'Preview rollback: no freeze.',
      'Devices switch after two launches.',
    ].join('\n\n'),
  );
}
