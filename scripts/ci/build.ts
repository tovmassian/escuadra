// Entry point for store-build: one platform per job.
import {
  appJsonVersion,
  env,
  errorMessage,
  finish,
  runUrl,
  writeSummary,
} from './flows/actions.ts';
import { runStoreBuild } from './flows/build.ts';
import { createRunner } from './flows/runner.ts';
import { parsePlatform } from './lib/pr.ts';

try {
  const profile = env('PROFILE');
  if (profile !== 'production' && profile !== 'preview') {
    throw new Error(`profile must be production or preview, got "${profile}"`);
  }
  finish(
    await runStoreBuild(createRunner(), {
      repo: env('GITHUB_REPOSITORY'),
      branch: env('GITHUB_REF_NAME'),
      platform: parsePlatform(env('PLATFORM')),
      profile,
      submit: env('SUBMIT') === 'true',
      rebuild: env('REBUILD') === 'true',
      appJsonVersion: appJsonVersion(),
      account: env('EAS_ACCOUNT'),
      runUrl: runUrl(),
    }),
  );
} catch (error) {
  writeSummary(`❌ store-build failed: ${errorMessage(error)}`);
  process.exitCode = 1;
}
