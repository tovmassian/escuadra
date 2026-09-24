// Entry point for the `release-gate` check. In CI it reads the pull_request event; on a
// Mac, `node scripts/ci/gate.ts --base release/1.0.0 --dry-run` prints the verdict for
// the checked-out tree and comments nowhere (set EAS_CLI="npx --yes eas-cli@24.7.0"
// without a global eas).
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import {
  appJsonVersion,
  errorMessage,
  readEvent,
  setOutput,
  writeSummary,
} from './flows/actions.ts';
import { runGate } from './flows/gate.ts';
import { createRunner } from './flows/runner.ts';

interface PullRequestEvent {
  pull_request: { number: number; base: { ref: string }; labels: { name: string }[] };
}

const { values } = parseArgs({
  options: { base: { type: 'string' }, 'dry-run': { type: 'boolean', default: false } },
});

try {
  const pr = values['dry-run'] ? null : readEvent<PullRequestEvent>().pull_request;
  const baseRef = values.base ?? pr?.base.ref;
  if (!baseRef) throw new Error('No base branch: pass --base release/X.Y.Z with --dry-run');
  const report = await runGate(createRunner(), {
    repo: process.env.GITHUB_REPOSITORY ?? 'tovmassian/escuadra',
    baseRef,
    prNumber: pr?.number ?? null,
    labels: pr?.labels.map((label) => label.name) ?? [],
    appJsonVersion: appJsonVersion(),
    packageJson: readFileSync('package.json', 'utf8'),
  });
  setOutput('platforms', JSON.stringify(report.publishable));
  setOutput('fingerprints', JSON.stringify(report.fingerprints));
  writeSummary(report.body);
  if (!report.passed) process.exitCode = 1;
} catch (error) {
  writeSummary(`❌ release-gate couldn't finish: ${errorMessage(error)}\n\nRe-run the check.`);
  process.exitCode = 1;
}
