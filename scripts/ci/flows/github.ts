// The `gh` calls the flows make: PR data, freeze issues, the gate's comment and
// workflow runs. GH_TOKEN comes from the workflow.
import { FREEZE_LABEL, freezeTitle, type Issue } from '../lib/freeze.ts';
import type { ChangedFile } from '../lib/pr.ts';
import type { Platform } from '../lib/release.ts';
import { runJson, runOk, type Runner } from './runner.ts';

export interface PullRequest {
  number: number;
  title: string;
  labels: string[];
  baseRef: string;
  merged: boolean;
}

interface ApiPullRequest {
  number: number;
  title: string;
  labels: { name: string }[];
  merged_at: string | null;
  base: { ref: string };
}

/** NDJSON from `gh api --paginate --jq '.[] | …'`: one object per line. */
function objects<T>(output: string): T[] {
  return output
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

export async function pullRequestsForCommit(
  runner: Runner,
  repo: string,
  sha: string,
): Promise<PullRequest[]> {
  const prs = await runJson<ApiPullRequest[]>(runner, 'gh', [
    'api',
    `repos/${repo}/commits/${sha}/pulls`,
  ]);
  return prs.map((pr) => ({
    number: pr.number,
    title: pr.title,
    labels: pr.labels.map((label) => label.name),
    baseRef: pr.base.ref,
    merged: pr.merged_at !== null,
  }));
}

export async function pullRequestFiles(
  runner: Runner,
  repo: string,
  number: number,
): Promise<ChangedFile[]> {
  return objects<ChangedFile>(
    await runOk(runner, 'gh', [
      'api',
      '--paginate',
      `repos/${repo}/pulls/${number}/files`,
      '--jq',
      '.[] | {filename, patch}',
    ]),
  );
}

export function openFreezes(runner: Runner, repo: string): Promise<Issue[]> {
  return runJson<Issue[]>(runner, 'gh', [
    'issue',
    'list',
    '--repo',
    repo,
    '--label',
    FREEZE_LABEL,
    '--state',
    'open',
    '--json',
    'number,title,url',
    '--limit',
    '100',
  ]);
}

/** Opens `OTA freeze: <platform>@<version>` and returns its URL. */
export async function createFreeze(
  runner: Runner,
  repo: string,
  platform: Platform,
  version: string,
  body: string,
): Promise<string> {
  const url = await runOk(runner, 'gh', [
    'issue',
    'create',
    '--repo',
    repo,
    '--title',
    freezeTitle(platform, version),
    '--label',
    FREEZE_LABEL,
    '--body',
    body,
  ]);
  return url.trim();
}

export interface Comment {
  id: number;
  body: string;
}

export async function findComment(
  runner: Runner,
  repo: string,
  number: number,
  marker: string,
): Promise<Comment | undefined> {
  const comments = objects<Comment>(
    await runOk(runner, 'gh', [
      'api',
      '--paginate',
      `repos/${repo}/issues/${number}/comments`,
      '--jq',
      '.[] | {id, body}',
    ]),
  );
  return comments.find((comment) => comment.body.includes(marker));
}

export async function updateComment(
  runner: Runner,
  repo: string,
  id: number,
  body: string,
): Promise<void> {
  await runOk(runner, 'gh', [
    'api',
    '--method',
    'PATCH',
    `repos/${repo}/issues/comments/${id}`,
    '-f',
    `body=${body}`,
  ]);
}

export async function commentOnPr(
  runner: Runner,
  repo: string,
  number: number,
  body: string,
): Promise<void> {
  await runOk(runner, 'gh', [
    'api',
    '--method',
    'POST',
    `repos/${repo}/issues/${number}/comments`,
    '-f',
    `body=${body}`,
  ]);
}

/** The gate's comment: edited in place when it exists, created otherwise. */
export async function upsertComment(
  runner: Runner,
  repo: string,
  number: number,
  marker: string,
  body: string,
): Promise<void> {
  const existing = await findComment(runner, repo, number, marker);
  if (existing) await updateComment(runner, repo, existing.id, body);
  else await commentOnPr(runner, repo, number, body);
}

/** Runs of `workflow` on `branch` that haven't completed: queued, waiting or in progress. */
export async function activeRuns(
  runner: Runner,
  repo: string,
  workflow: string,
  branch: string,
): Promise<number> {
  const runs = await runJson<{ status: string }[]>(runner, 'gh', [
    'run',
    'list',
    '--repo',
    repo,
    '--workflow',
    workflow,
    '--branch',
    branch,
    '--json',
    'status',
    '--limit',
    '50',
  ]);
  return runs.filter((run) => run.status !== 'completed').length;
}
