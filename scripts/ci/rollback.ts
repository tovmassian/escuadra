// Entry point for ota-rollback: one platform per job.
import {
  env,
  errorMessage,
  finish,
  optionalEnv,
  runUrl,
  sleep,
  writeSummary,
} from './flows/actions.ts';
import { runRollback } from './flows/rollback.ts';
import { createRunner } from './flows/runner.ts';
import { parsePlatform } from './lib/pr.ts';
import type { RollbackMode } from './lib/updates.ts';

function parseMode(value: string): RollbackMode {
  if (value === 'previous' || value === 'group' || value === 'embedded') return value;
  throw new Error(`mode must be previous, group or embedded, got "${value}"`);
}

try {
  const channel = env('CHANNEL');
  if (channel !== 'production' && channel !== 'preview') {
    throw new Error(`channel must be production or preview, got "${channel}"`);
  }
  finish(
    await runRollback(
      createRunner(),
      {
        repo: env('GITHUB_REPOSITORY'),
        branch: env('GITHUB_REF_NAME'),
        platform: parsePlatform(env('PLATFORM')),
        channel,
        mode: parseMode(env('MODE')),
        groupId: optionalEnv('GROUP_ID') || null,
        reason: env('REASON'),
        dryRun: optionalEnv('DRY_RUN') === 'true',
        runUrl: runUrl(),
      },
      { sleep, pollMs: 20_000, maxPolls: 45 },
    ),
  );
} catch (error) {
  writeSummary(`❌ ota-rollback failed: ${errorMessage(error)}`);
  process.exitCode = 1;
}
