// Entry point for squad-sweep: runs from main's checkout, sweeping the checkout of
// SWEEP_BASE at SWEEP_DIR.
import path from 'node:path';
import { env, errorMessage, finish, optionalEnv, runUrl, writeSummary } from './flows/actions.ts';
import { createRunner } from './flows/runner.ts';
import { runSweep } from './flows/sweep.ts';

try {
  finish(
    await runSweep(createRunner(env('SWEEP_DIR')), {
      repo: env('GITHUB_REPOSITORY'),
      base: optionalEnv('SWEEP_BASE'),
      today: new Date().toISOString().slice(0, 10),
      envelopes: path.join(env('RUNNER_TEMP'), 'envelopes'),
      runUrl: runUrl(),
    }),
  );
} catch (error) {
  writeSummary(`❌ squad-sweep failed: ${errorMessage(error)}`);
  process.exitCode = 1;
}
