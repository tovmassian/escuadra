// squad-sweep: runs the live release branch's squadctl over every team and opens one data
// PR into that branch, or adds to the one still open. Never pushes to the release branch,
// never force-pushes, never publishes: the owner's ota:* label and merge ship it.
// The runner's working directory is a checkout of the base. See docs/release.md
// ("Sweep squad data").
import { done, failed, skipped, type Outcome } from '../lib/outcome.ts';
import { parseReleaseBranch } from '../lib/release.ts';
import {
  SWEEP_TITLE,
  isSweepBranch,
  sweepBody,
  sweepBranch,
  teamsWithNewPlayers,
  type EnrichRun,
} from '../lib/sweep.ts';
import { createPullRequest, dispatchWorkflow } from './github.ts';
import { runJson, runOk, type CommandResult, type Runner } from './runner.ts';

export interface SweepContext {
  repo: string;
  /** The repository variable SWEEP_BASE: the live version's release branch. */
  base: string;
  /** YYYY-MM-DD, naming a new sweep branch. */
  today: string;
  /** Where fetch writes its envelopes: under $RUNNER_TEMP. */
  envelopes: string;
  runUrl: string;
}

const SQUADCTL = 'tools/squadctl/bin/dev.js';
/** What fetch, apply and enrich write; nothing else is ever committed. */
const DATA_PATHS = ['data', 'lib/squads.generated.ts'];

interface OpenPullRequest {
  number: number;
  headRefName: string;
  url: string;
}

const tail = (result: CommandResult) =>
  `${result.stdout}\n${result.stderr}`.trim().split('\n').slice(-20).join('\n');

function crashed(step: string, result: CommandResult): Outcome {
  return failed(
    `❌ squadctl ${step} exited with ${result.code}; nothing was committed.\n\n\`\`\`text\n${tail(result)}\n\`\`\``,
  );
}

async function openSweep(runner: Runner, ctx: SweepContext): Promise<OpenPullRequest | undefined> {
  const prs = await runJson<OpenPullRequest[]>(runner, 'gh', [
    'pr',
    'list',
    '--repo',
    ctx.repo,
    '--base',
    ctx.base,
    '--state',
    'open',
    '--json',
    'number,headRefName,url',
    '--limit',
    '100',
  ]);
  return prs.find((pr) => isSweepBranch(pr.headRefName));
}

export async function runSweep(runner: Runner, ctx: SweepContext): Promise<Outcome> {
  if (!parseReleaseBranch(ctx.base)) {
    return failed(
      `❌ SWEEP_BASE is \`${ctx.base || '(unset)'}\`, not a release branch. Point it at the live version's: \`gh variable set SWEEP_BASE --body release/X.Y.Z\`.`,
    );
  }

  const open = await openSweep(runner, ctx);
  const branch = open?.headRefName ?? sweepBranch(ctx.today);
  if (open) {
    // On top of whatever answers were pushed to it: the sweep re-applies with them.
    await runOk(runner, 'git', ['fetch', '--no-tags', 'origin', branch]);
    await runOk(runner, 'git', ['switch', '-c', branch, 'FETCH_HEAD']);
  } else {
    await runOk(runner, 'git', ['switch', '-c', branch]);
  }

  // A team that fails to fetch (exit 1–3) is named in the report and keeps its stored
  // squad; apply takes everything that was fetched.
  const fetch = await runner.run('node', [SQUADCTL, 'fetch', '--out', ctx.envelopes]);
  // 4 is conflicts: the files are written and the PR is where they are answered.
  const apply = await runner.run('node', [SQUADCTL, 'apply', ctx.envelopes]);
  if (apply.code !== 0 && apply.code !== 4) return crashed('apply', apply);

  let enrich: EnrichRun | undefined;
  const teams = teamsWithNewPlayers(apply.stdout);
  if (teams.length > 0) {
    const result = await runner.run('node', [SQUADCTL, 'enrich', '--only', teams.join(',')]);
    // 1: Wikimedia unreachable, so the PR gives the local command; 4: birth conflicts.
    if (![0, 1, 4].includes(result.code)) return crashed('enrich', result);
    enrich = { teams, code: result.code, output: result.stdout };
  }

  const changed = await runOk(runner, 'git', ['status', '--porcelain', '--', ...DATA_PATHS]);
  if (!changed.trim()) {
    return skipped(
      open
        ? `No squad changed since the last run; ${open.url} is still open.`
        : 'No squad changed: nothing to open.',
    );
  }

  await runOk(runner, 'git', ['add', '--', ...DATA_PATHS]);
  await runOk(runner, 'git', ['commit', '-m', `data: weekly sweep, ${ctx.today}`]);
  await runOk(runner, 'git', ['push', 'origin', `HEAD:refs/heads/${branch}`]);

  const body = sweepBody({
    base: ctx.base,
    branch,
    runUrl: ctx.runUrl,
    fetch: fetch.stdout,
    apply: apply.stdout,
    enrich,
  });
  let url: string;
  if (open) {
    await runOk(runner, 'gh', [
      'pr',
      'edit',
      String(open.number),
      '--repo',
      ctx.repo,
      '--body',
      body,
    ]);
    url = open.url;
  } else {
    url = await createPullRequest(runner, ctx.repo, {
      base: ctx.base,
      head: branch,
      title: SWEEP_TITLE,
      body,
    });
  }
  // Pushed with GITHUB_TOKEN, so no workflow started on its own.
  await dispatchWorkflow(runner, ctx.repo, 'check.yml', branch);
  return done(
    `${open ? 'Added to' : 'Opened'} ${url} from \`${branch}\`; \`check\` started on it.`,
  );
}
