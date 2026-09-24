// Entry point for ota-production. `resolve` decides which platforms a push (a merged PR)
// or a manual run publishes; `run` publishes one platform.
import {
  env,
  errorMessage,
  finish,
  optionalEnv,
  readEvent,
  setOutput,
  writeSummary,
} from './flows/actions.ts';
import { pullRequestsForCommit } from './flows/github.ts';
import { runPublish } from './flows/publish.ts';
import { createRunner } from './flows/runner.ts';
import { parsePlatform, platformsFromInput, platformsFromLabels } from './lib/pr.ts';
import type { Platform } from './lib/release.ts';

const runner = createRunner();

async function resolve(repo: string, branch: string, sha: string): Promise<void> {
  let platforms: Platform[] = [];
  let message = '';
  let pr = '';
  if (env('GITHUB_EVENT_NAME') === 'workflow_dispatch') {
    platforms = platformsFromInput(env('INPUT_PLATFORMS'));
    message = optionalEnv('INPUT_MESSAGE') || `Manual publish from ${branch} @ ${sha.slice(0, 7)}`;
    writeSummary(
      `Manual run: publishing ${platforms.join(' and ')} from ${branch} @ ${sha.slice(0, 7)}.`,
    );
  } else {
    const event = readEvent<{ created?: boolean }>();
    const prs = event.created ? [] : await pullRequestsForCommit(runner, repo, sha);
    const merged = prs.find((candidate) => candidate.merged && candidate.baseRef === branch);
    if (!merged) {
      writeSummary(`No merged PR behind ${sha.slice(0, 7)}: nothing to publish.`);
    } else {
      platforms = platformsFromLabels(merged.labels);
      message = `${merged.title} (#${merged.number})`;
      pr = String(merged.number);
      writeSummary(
        platforms.length
          ? `#${merged.number} publishes to ${platforms.join(' and ')}.`
          : `#${merged.number} has no ota:* label: nothing to publish.`,
      );
    }
  }
  setOutput('platforms', JSON.stringify(platforms));
  setOutput('message', message);
  setOutput('pr', pr);
}

async function run(repo: string, branch: string, sha: string): Promise<void> {
  const prNumber = optionalEnv('PR_NUMBER');
  finish(
    await runPublish(runner, {
      repo,
      branch,
      sha,
      platform: parsePlatform(env('PLATFORM')),
      message: env('MESSAGE'),
      trigger: env('GITHUB_EVENT_NAME') === 'push' ? 'push' : 'dispatch',
      prNumber: prNumber ? Number(prNumber) : null,
      account: env('EAS_ACCOUNT'),
    }),
  );
}

try {
  const repo = env('GITHUB_REPOSITORY');
  const branch = env('GITHUB_REF_NAME');
  const sha = env('GITHUB_SHA');
  const command = process.argv[2];
  if (command === 'resolve') await resolve(repo, branch, sha);
  else if (command === 'run') await run(repo, branch, sha);
  else throw new Error(`usage: node scripts/ci/publish.ts resolve|run, got "${command ?? ''}"`);
} catch (error) {
  writeSummary(`❌ ota-production failed: ${errorMessage(error)}`);
  process.exitCode = 1;
}
