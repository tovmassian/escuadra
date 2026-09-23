// The two git questions the gate asks of the checked-out PR merge commit. Needs full
// history: the workflow checks out with fetch-depth 0.
import { runOk, type Runner } from './runner.ts';

/**
 * Whether HEAD carries commits from origin/main that the base branch doesn't have:
 * true when any merge base of HEAD and main isn't already on the base branch. Catches
 * both a merge of `main` and a branch cut from `main` by mistake.
 */
export async function bringsMainCommits(runner: Runner, baseRef: string): Promise<boolean> {
  const bases = await runner.run('git', ['merge-base', '--all', 'HEAD', 'origin/main']);
  if (bases.code !== 0) return false;
  for (const commit of bases.stdout.split('\n').filter(Boolean)) {
    const onBase = await runner.run('git', [
      'merge-base',
      '--is-ancestor',
      commit,
      `origin/${baseRef}`,
    ]);
    if (onBase.code !== 0) return true;
  }
  return false;
}

export function basePackageJson(runner: Runner, baseRef: string): Promise<string> {
  return runOk(runner, 'git', ['show', `origin/${baseRef}:package.json`]);
}
