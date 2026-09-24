// The `preview` job: publishes a passing, labelled PR to the preview channel, one
// platform at a time, when a preview build on the same runtime exists to receive it.
// Not a required check: a failure here never blocks a merge.
import { done, failed, skipped, type Outcome } from '../lib/outcome.ts';
import { isDocsOrCiOnly } from '../lib/pr.ts';
import { PLATFORM_NAMES, short, type Platform } from '../lib/release.ts';
import { COMMENT_MARKER, withPreview } from '../lib/render.ts';
import { listBuilds, publishUpdate } from './eas.ts';
import { findComment, pullRequestFiles, updateComment } from './github.ts';
import type { Runner } from './runner.ts';

export interface PreviewContext {
  repo: string;
  prNumber: number;
  prTitle: string;
  headSha: string;
  platforms: Platform[];
  fingerprints: Partial<Record<Platform, string>>;
}

export async function runPreview(runner: Runner, ctx: PreviewContext): Promise<Outcome> {
  const files = await pullRequestFiles(runner, ctx.repo, ctx.prNumber);
  const results: string[] = [];
  let published = false;
  let broken = false;
  if (isDocsOrCiOnly(files.map((file) => file.filename))) {
    results.push('skipped, the PR only changes docs or CI');
  } else {
    for (const platform of ctx.platforms) {
      const name = PLATFORM_NAMES[platform];
      const fingerprint = ctx.fingerprints[platform];
      if (!fingerprint) {
        results.push(`${name}: skipped, the gate reported no fingerprint`);
        continue;
      }
      const receivers = await listBuilds(runner, {
        platform,
        profile: 'preview',
        fingerprint,
        finishedOnly: true,
      });
      if (receivers.length === 0) {
        results.push(
          `${name}: skipped, no preview build on runtime \`${short(fingerprint)}\` (cut one with store-build, profile: preview)`,
        );
        continue;
      }
      const message = `PR #${ctx.prNumber}: ${ctx.prTitle} @ ${ctx.headSha.slice(0, 7)}`;
      const update = (await publishUpdate(runner, { channel: 'preview', platform, message })).find(
        (candidate) => candidate.platform === platform,
      );
      if (!update || update.runtimeVersion !== fingerprint) {
        broken = true;
        results.push(
          `${name}: ❌ published runtime \`${short(update?.runtimeVersion)}\`, expected \`${short(fingerprint)}\``,
        );
        continue;
      }
      published = true;
      results.push(`${name} → group \`${short(update.group)}\` (open the preview app twice)`);
    }
  }
  const text = results.join(' · ');
  const comment = await findComment(runner, ctx.repo, ctx.prNumber, COMMENT_MARKER);
  if (comment) await updateComment(runner, ctx.repo, comment.id, withPreview(comment.body, text));
  const summary = `**Preview:** ${text}`;
  if (broken) return failed(summary);
  return published ? done(summary) : skipped(summary);
}
