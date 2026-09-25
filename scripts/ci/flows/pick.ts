// pick-to-main: after a PR merges into a release branch, cherry-picks its squash commit
// onto `main` and opens the PR, so a fix can't be forgotten on the release branch.
// Needs full history (checkout with fetch-depth 0) and a token that may push and open PRs.
import { done, failed, skipped, type Outcome } from '../lib/outcome.ts';
import { cameFromMain, manualPick, pickBody, pickBranch, pickTitle } from '../lib/pick.ts';
import { commentOnPr, createPullRequest, dispatchWorkflow } from './github.ts';
import { runOk, type Runner } from './runner.ts';

export interface PickContext {
  repo: string;
  prNumber: number;
  baseRef: string;
  sha: string;
}

export async function runPick(runner: Runner, ctx: PickContext): Promise<Outcome> {
  const message = await runOk(runner, 'git', ['log', '-1', '--format=%B', ctx.sha]);
  if (cameFromMain(message)) {
    return skipped(`#${ctx.prNumber} was cherry-picked from \`main\`: nothing to take back.`);
  }
  // A pick made by hand before this ran: main has since moved, so git would call a
  // second pick a conflict rather than empty.
  const onMain = await runOk(runner, 'git', [
    'log',
    'origin/main',
    '--fixed-strings',
    `--grep=(cherry picked from commit ${ctx.sha})`,
    '--format=%h',
  ]);
  if (onMain.trim()) {
    return skipped(`#${ctx.prNumber} is on \`main\` already, as ${onMain.trim().split('\n')[0]}.`);
  }
  const branch = pickBranch(ctx.prNumber);
  const existing = await runner.run('git', [
    'ls-remote',
    '--exit-code',
    '--heads',
    'origin',
    branch,
  ]);
  if (existing.code === 0) {
    return skipped(`\`${branch}\` already exists: the pick was made by an earlier run.`);
  }

  await runOk(runner, 'git', ['switch', '-c', branch, 'origin/main']);
  const picked = await runner.run('git', ['cherry-pick', '-x', ctx.sha]);
  if (picked.code !== 0) {
    const unmerged = await runOk(runner, 'git', ['diff', '--name-only', '--diff-filter=U']);
    await runner.run('git', ['cherry-pick', '--abort']);
    if (!unmerged.trim()) {
      return skipped(`#${ctx.prNumber} changes nothing on \`main\`: it's there already.`);
    }
    const view = { prNumber: ctx.prNumber, baseRef: ctx.baseRef, sha: ctx.sha };
    const files = unmerged
      .trim()
      .split('\n')
      .map((file) => `\`${file}\``)
      .join(', ');
    const summary = `⚠️ Couldn't cherry-pick this onto \`main\`: conflicts in ${files}. Pick it by hand:\n\n${manualPick(view)}`;
    await commentOnPr(runner, ctx.repo, ctx.prNumber, summary);
    return failed(summary);
  }

  await runOk(runner, 'git', ['push', 'origin', branch]);
  const view = { prNumber: ctx.prNumber, baseRef: ctx.baseRef, sha: ctx.sha };
  let url: string;
  try {
    url = await createPullRequest(runner, ctx.repo, {
      base: 'main',
      head: branch,
      title: pickTitle(message),
      body: pickBody(view),
    });
  } catch (error) {
    const summary =
      `⚠️ Pushed \`${branch}\` but couldn't open its PR into \`main\`. Open it by hand. ` +
      'If Actions may not create PRs, switch on Settings → Actions → General → ' +
      '"Allow GitHub Actions to create and approve pull requests".';
    await commentOnPr(runner, ctx.repo, ctx.prNumber, summary);
    return failed(`${summary}\n\n${error instanceof Error ? error.message : String(error)}`);
  }
  await dispatchWorkflow(runner, ctx.repo, 'check.yml', branch);
  await commentOnPr(runner, ctx.repo, ctx.prNumber, `↪️ Taking this to \`main\`: ${url}`);
  return done(`Opened ${url} from \`${branch}\`; \`check\` started on it.`);
}
