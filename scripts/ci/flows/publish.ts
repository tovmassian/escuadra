// The production publish for one platform (`ota-production`). It re-checks the lock and
// the fingerprint on the exact commit — the branch may have moved since the PR check —
// honours freezes, refuses duplicates, publishes, and verifies the runtime it published.
// §7 of the design.
import { findFreeze } from '../lib/freeze.ts';
import { done, failed, skipped, type Outcome } from '../lib/outcome.ts';
import {
  PLATFORM_NAMES,
  lockState,
  parseReleaseBranch,
  short,
  type Platform,
} from '../lib/release.ts';
import { alreadyPublished } from '../lib/updates.ts';
import { usageReport } from '../lib/usage.ts';
import {
  accountUsage,
  computeFingerprint,
  listBuilds,
  listUpdateGroups,
  publishUpdate,
  viewUpdateGroup,
} from './eas.ts';
import { commentOnPr, openFreezes } from './github.ts';
import type { Runner } from './runner.ts';

export interface PublishContext {
  repo: string;
  branch: string;
  sha: string;
  platform: Platform;
  message: string;
  trigger: 'push' | 'dispatch';
  prNumber: number | null;
  account: string;
}

export async function runPublish(runner: Runner, ctx: PublishContext): Promise<Outcome> {
  const name = PLATFORM_NAMES[ctx.platform];
  const version = parseReleaseBranch(ctx.branch);
  if (!version)
    return failed(
      `\`${ctx.branch}\` isn't a release branch: production publishes run only on release/X.Y.Z.`,
    );

  const builds = await listBuilds(runner, {
    platform: ctx.platform,
    profile: 'production',
    appVersion: version,
  });
  const lock = lockState(builds, ctx.platform, version);
  if (lock.state === 'open') {
    const why = `No ${version} production build for ${name} yet: nothing to publish to.`;
    return ctx.trigger === 'push' ? skipped(why) : failed(why);
  }
  if (lock.state === 'pending') {
    return failed(
      `Build ${lock.build.appBuildVersion} of ${version} is still running. Publish after it finishes.`,
    );
  }

  const fingerprint = await computeFingerprint(runner, ctx.platform);
  if (fingerprint !== lock.runtime) {
    return failed(
      `This commit's ${name} fingerprint \`${short(fingerprint)}\` doesn't match build ` +
        `${lock.build.appBuildVersion} (\`${short(lock.runtime)}\`). Nothing was published.`,
    );
  }

  const freeze = findFreeze(await openFreezes(runner, ctx.repo), ctx.platform, version);
  if (freeze) {
    return failed(
      `Frozen by #${freeze.number} (${freeze.url}). Close it when the review passes, then Re-run failed jobs.`,
    );
  }

  const [newest] = await listUpdateGroups(runner, 'production', ctx.platform, lock.runtime, 1);
  if (
    newest &&
    alreadyPublished(await viewUpdateGroup(runner, newest.group), ctx.platform, ctx.sha)
  ) {
    return skipped(
      `The newest ${name} production update (\`${short(newest.group)}\`) already came from ${ctx.sha.slice(0, 7)}.`,
    );
  }

  const updates = await publishUpdate(runner, {
    channel: 'production',
    platform: ctx.platform,
    message: ctx.message,
  });
  const update = updates.find((candidate) => candidate.platform === ctx.platform);
  if (!update)
    return failed(
      `eas update returned no ${name} update. Check the EAS dashboard before retrying.`,
    );
  if (update.runtimeVersion !== lock.runtime) {
    return failed(
      `🚨 Published group \`${short(update.group)}\` on runtime \`${short(update.runtimeVersion)}\`, but build ` +
        `${lock.build.appBuildVersion} runs \`${short(lock.runtime)}\`: it reaches nobody. Roll back with ` +
        'ota-rollback and investigate before publishing again.',
    );
  }

  let usage = 'EAS usage: unavailable';
  const warnings: string[] = [];
  try {
    const report = usageReport(await accountUsage(runner, ctx.account));
    usage = report.line;
    warnings.push(...report.warnings);
  } catch {
    // Usage is advisory, and the update is already out.
  }
  const summary = [
    `🚀 production · ${name} · ${version} · group \`${short(update.group)}\` · runtime ` +
      `\`${short(update.runtimeVersion)}\` ✅ matches build ${lock.build.appBuildVersion}`,
    'Open the store app twice to see it · rollback: Actions → ota-rollback',
    usage,
    ...warnings.map((warning) => `⚠️ ${warning}`),
  ].join('\n\n');
  if (ctx.prNumber !== null) await commentOnPr(runner, ctx.repo, ctx.prNumber, summary);
  return done(summary);
}
