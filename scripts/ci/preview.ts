// Entry point for the `preview` job of release-gate: publishes the PR to the preview
// channel for the platforms the gate passed through.
import { env, errorMessage, finish, readEvent, writeSummary } from './flows/actions.ts';
import { runPreview } from './flows/preview.ts';
import { createRunner } from './flows/runner.ts';
import { parsePlatform } from './lib/pr.ts';
import type { Platform } from './lib/release.ts';

interface PullRequestEvent {
  pull_request: { number: number; title: string; head: { sha: string } };
}

try {
  const pr = readEvent<PullRequestEvent>().pull_request;
  finish(
    await runPreview(createRunner(), {
      repo: env('GITHUB_REPOSITORY'),
      prNumber: pr.number,
      prTitle: pr.title,
      headSha: pr.head.sha,
      platforms: (JSON.parse(env('PLATFORMS')) as string[]).map(parsePlatform),
      fingerprints: JSON.parse(env('FINGERPRINTS')) as Partial<Record<Platform, string>>,
    }),
  );
} catch (error) {
  writeSummary(`❌ preview publish failed: ${errorMessage(error)}`);
  process.exitCode = 1;
}
