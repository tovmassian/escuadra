// The `eas` calls the flows make, typed. JSON commands run with --json and
// --non-interactive: eas-cli then writes progress to stderr and only JSON to stdout.
import type { EasBuild, Platform } from '../lib/release.ts';
import type { UpdateGroupSummary, UpdateInfo } from '../lib/updates.ts';
import type { AccountUsage } from '../lib/usage.ts';
import { runJson, type Runner } from './runner.ts';

/** Build profiles and channels share these names (eas.json). */
export type Channel = 'production' | 'preview';

/** The fingerprint `eas update` would publish to from this checkout. */
export async function computeFingerprint(runner: Runner, platform: Platform): Promise<string> {
  const result = await runJson<{ hash: string }>(runner, 'eas', [
    'fingerprint:generate',
    '--platform',
    platform,
    '--environment',
    'production',
    '--json',
    '--non-interactive',
  ]);
  return result.hash;
}

export interface BuildQuery {
  platform: Platform;
  profile: Channel;
  appVersion?: string;
  fingerprint?: string;
  finishedOnly?: boolean;
}

export function listBuilds(runner: Runner, query: BuildQuery): Promise<EasBuild[]> {
  const args = [
    'build:list',
    '--platform',
    query.platform,
    '--build-profile',
    query.profile,
    '--limit',
    '50',
    '--json',
    '--non-interactive',
  ];
  if (query.appVersion) args.push('--app-version', query.appVersion);
  if (query.fingerprint) args.push('--fingerprint-hash', query.fingerprint);
  if (query.finishedOnly) args.push('--status', 'finished');
  return runJson<EasBuild[]>(runner, 'eas', args);
}

/** fingerprint:compare's own explanation of why this checkout differs from a build. */
export async function explainMismatch(runner: Runner, buildId: string): Promise<string> {
  const result = await runner.run('eas', [
    'fingerprint:compare',
    '--build-id',
    buildId,
    '--environment',
    'production',
    '--non-interactive',
  ]);
  const text = result.stdout.includes('Fingerprint')
    ? result.stdout
    : `${result.stdout}\n${result.stderr}`;
  const lines = text.split('\n');
  const from = lines.findIndex((line) => /differs|matches/.test(line));
  return lines.slice(Math.max(from, 0)).join('\n').trim().slice(0, 4000);
}

export function publishUpdate(
  runner: Runner,
  update: { channel: Channel; platform: Platform; message: string },
): Promise<UpdateInfo[]> {
  return runJson<UpdateInfo[]>(runner, 'eas', [
    'update',
    '--channel',
    update.channel,
    '--platform',
    update.platform,
    '--environment',
    update.channel,
    '--message',
    update.message,
    '--non-interactive',
    '--json',
  ]);
}

/** Update groups on a branch for one platform and runtime, newest first. */
export async function listUpdateGroups(
  runner: Runner,
  branch: Channel,
  platform: Platform,
  runtime: string,
  limit: number,
): Promise<UpdateGroupSummary[]> {
  const page = await runJson<{ currentPage?: UpdateGroupSummary[] }>(runner, 'eas', [
    'update:list',
    '--branch',
    branch,
    '--platform',
    platform,
    '--runtime-version',
    runtime,
    '--limit',
    String(limit),
    '--json',
    '--non-interactive',
  ]);
  return page.currentPage ?? [];
}

export function viewUpdateGroup(runner: Runner, group: string): Promise<UpdateInfo[]> {
  return runJson<UpdateInfo[]>(runner, 'eas', ['update:view', group, '--json']);
}

/** Republishes a group to its own branch and returns the new group's ID. */
export async function republishGroup(
  runner: Runner,
  group: string,
  platform: Platform,
  message: string,
): Promise<string> {
  const updates = await runJson<{ group?: string }[]>(runner, 'eas', [
    'update:republish',
    '--group',
    group,
    '--platform',
    platform,
    '--message',
    message,
    '--non-interactive',
    '--json',
  ]);
  const newGroup = updates.find((update) => typeof update.group === 'string')?.group;
  if (!newGroup) throw new Error('update:republish reported no new group');
  return newGroup;
}

/** Points a runtime back at the JS embedded in its build; returns the directive's group ID. */
export async function rollBackToEmbedded(
  runner: Runner,
  channel: Channel,
  platform: Platform,
  runtime: string,
  message: string,
): Promise<string> {
  const updates = await runJson<UpdateInfo[]>(runner, 'eas', [
    'update:roll-back-to-embedded',
    '--channel',
    channel,
    '--platform',
    platform,
    '--runtime-version',
    runtime,
    '--message',
    message,
    '--non-interactive',
    '--json',
  ]);
  const group = updates[0]?.group;
  if (!group) throw new Error('update:roll-back-to-embedded reported no group');
  return group;
}

export function accountUsage(runner: Runner, account: string): Promise<AccountUsage> {
  return runJson<AccountUsage>(runner, 'eas', [
    'account:usage',
    account,
    '--json',
    '--non-interactive',
  ]);
}

/** Builds (and with `submit`, uploads to the store) and waits for the result. */
export function startBuild(
  runner: Runner,
  platform: Platform,
  profile: Channel,
  submit: boolean,
): Promise<EasBuild[]> {
  const args = [
    'build',
    '--platform',
    platform,
    '--profile',
    profile,
    '--non-interactive',
    '--json',
  ];
  if (submit) args.push('--auto-submit');
  return runJson<EasBuild[]>(runner, 'eas', args);
}
