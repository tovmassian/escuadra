// Commands the user is meant to run next, rendered exactly as they have to be
// typed. There is no global `squadctl` binary, so everything here is the
// `npm run` form — a hint you have to reassemble by hand is not a hint.
import path from 'node:path';

/** Repo-relative when the target is inside the repo (shorter, and `npm run`
 *  always executes from the repo root), absolute when it is not — a hint
 *  starting `../../..` depends on a working directory the reader cannot see. */
export function displayPath(repoRoot: string, target: string): string {
  const relative = path.relative(repoRoot, target);
  return relative === '' || relative.startsWith('..') || path.isAbsolute(relative)
    ? target
    : relative;
}

export function applyCommand(repoRoot: string, envelopeDir: string, dryRun = false): string {
  return `npm run squadctl -- apply ${displayPath(repoRoot, envelopeDir)}${dryRun ? ' --dry-run' : ''}`;
}
