// Entry point for pick-to-main: runs on a merged PR into a release branch.
import { env, errorMessage, finish, readEvent, writeSummary } from './flows/actions.ts';
import { runPick } from './flows/pick.ts';
import { createRunner } from './flows/runner.ts';

interface ClosedPullRequestEvent {
  pull_request: {
    number: number;
    merged: boolean;
    merge_commit_sha: string;
    base: { ref: string };
  };
}

try {
  const pr = readEvent<ClosedPullRequestEvent>().pull_request;
  if (!pr.merged) {
    writeSummary(`#${pr.number} closed without merging: nothing to pick.`);
  } else {
    finish(
      await runPick(createRunner(), {
        repo: env('GITHUB_REPOSITORY'),
        prNumber: pr.number,
        baseRef: pr.base.ref,
        sha: pr.merge_commit_sha,
      }),
    );
  }
} catch (error) {
  writeSummary(`❌ pick-to-main failed: ${errorMessage(error)}`);
  process.exitCode = 1;
}
