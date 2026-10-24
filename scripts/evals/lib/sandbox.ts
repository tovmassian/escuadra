// Builds a run's sandbox (spec §5): a bare origin holding only the pinned
// branches, the agent's clone of it, the case's synthetic history and state,
// and the fake gh with its fixtures under .git/sandbox/. It runs unsandboxed,
// as the owner, from the case's scaffold.
import { execFileSync } from 'node:child_process';
import {
  appendFileSync,
  chmodSync,
  copyFileSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';
import type { IssueFixture, PrFixture } from '../sandbox/gh.ts';

/** A file a synthetic commit writes: inline `content`, or a `fixture` under _fixtures/. */
export interface SyntheticFile {
  path: string;
  content?: string;
  fixture?: string;
}

export interface SyntheticCommit {
  message: string;
  files: SyntheticFile[];
}

export interface SandboxSetup {
  /** Branch → commit, for every branch origin keeps. */
  pins: Record<string, string>;
  /** Issue fixtures, relative to _fixtures/ (`issues/126.json`). */
  issues: string[];
  prs: PrFixture[];
  /** Commits made on main, then pushed, before anything else. */
  commits: SyntheticCommit[];
  /** Branches pushed to origin with their own commits, and not kept locally. */
  branches: { name: string; from: string; commits: SyntheticCommit[] }[];
  /** The branch checked out when the agent starts; `from` creates it. */
  checkout: { branch: string; from?: string };
  /** Tracked files left with an uncommitted edit. */
  dirty: string[];
  /** Repo-relative paths removed from every pinned commit, and from the object database. */
  hidden: string[];
}

export interface BuildOptions {
  sourceRepo: string;
  /** The agent's working directory, still empty. */
  workDir: string;
  /** Where origin.git goes. */
  tmpDir: string;
  /** The suite's _fixtures/. */
  fixturesDir: string;
  /** scripts/evals/sandbox/, holding gh.ts and gh-cli.ts. */
  ghDir: string;
  /** The git binary the wrappers run (see realGitBinary). */
  realGit: string;
  setup: SandboxSetup;
}

const IDENTITY = [
  '-c',
  'user.name=Escuadra Sandbox',
  '-c',
  'user.email=sandbox@escuadra.invalid',
  '-c',
  'commit.gpgsign=false',
];
// Fixed dates give a case's synthetic commits the same hashes on every run.
const DATES = {
  GIT_AUTHOR_DATE: '2026-10-16T12:00:00Z',
  GIT_COMMITTER_DATE: '2026-10-16T12:00:00Z',
};

/**
 * The environment minus every GIT_* variable, so git acts on the repo `cwd` names. Git hooks
 * export GIT_DIR, and a git run under it would write to the hook's repository instead.
 */
export function withoutGitVars<E extends Readonly<Record<string, string | undefined>>>(env: E): E {
  return Object.fromEntries(Object.entries(env).filter(([name]) => !name.startsWith('GIT_'))) as E;
}

function git(cwd: string, args: string[]): string {
  return execFileSync('git', [...IDENTITY, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...withoutGitVars(process.env), ...DATES },
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

/**
 * The git binary itself, not a shim: on macOS /usr/bin/git is xcrun's, which
 * fails inside the agent's sandbox (spec §11).
 */
export function realGitBinary(): string {
  const execPath = execFileSync('git', ['--exec-path'], {
    encoding: 'utf8',
    env: withoutGitVars(process.env),
  }).trim();
  return realpathSync(join(execPath, 'git'));
}

export function buildSandbox(o: BuildOptions): void {
  const origin = join(o.tmpDir, 'origin.git');
  // Fetch only the pinned commits into an empty repo: a clone of the source would carry every
  // object it holds, the unpinned branches' and the hidden paths' included.
  git(o.tmpDir, ['init', '--quiet', '--bare', origin]);
  for (const [branch, sha] of Object.entries(o.setup.pins)) {
    git(origin, ['fetch', '--quiet', '--no-tags', o.sourceRepo, `${sha}:refs/heads/${branch}`]);
  }
  git(origin, ['symbolic-ref', 'HEAD', 'refs/heads/main']);
  if (o.setup.hidden.length > 0) hideFromHistory(origin, o.setup.hidden);

  git(o.workDir, ['clone', '--quiet', origin, '.']);
  const helpers = dirname(o.realGit);
  git(o.workDir, ['config', 'remote.origin.uploadpack', join(helpers, 'git-upload-pack')]);
  git(o.workDir, ['config', 'remote.origin.receivepack', join(helpers, 'git-receive-pack')]);

  for (const commit of o.setup.commits) commitFiles(o, commit);
  if (o.setup.commits.length > 0) git(o.workDir, ['push', '--quiet', 'origin', 'main']);
  for (const branch of o.setup.branches) {
    git(o.workDir, ['switch', '--quiet', '-c', branch.name, branch.from]);
    for (const commit of branch.commits) commitFiles(o, commit);
    git(o.workDir, ['push', '--quiet', '-u', 'origin', branch.name]);
    git(o.workDir, ['switch', '--quiet', 'main']);
    git(o.workDir, ['branch', '--quiet', '-D', branch.name]);
  }

  const { branch, from } = o.setup.checkout;
  if (from !== undefined) git(o.workDir, ['switch', '--quiet', '-c', branch, from]);
  else if (branch !== 'main') git(o.workDir, ['switch', '--quiet', branch]);
  for (const path of o.setup.dirty) {
    appendFileSync(join(o.workDir, path), '\nsandbox: an uncommitted edit\n');
  }

  const box = join(o.workDir, '.git', 'sandbox');
  mkdirSync(join(box, 'issues'), { recursive: true });
  mkdirSync(join(box, 'bin'), { recursive: true });
  // `why` and `source` say what a case expects, so they stay out of the agent's reach.
  for (const issue of o.setup.issues) {
    const fixture = JSON.parse(readFileSync(join(o.fixturesDir, issue), 'utf8')) as IssueFixture;
    const { why: _why, source: _source, ...rest } = fixture;
    writeFileSync(join(box, 'issues', basename(issue)), `${JSON.stringify(rest, null, 2)}\n`);
  }
  writeFileSync(join(box, 'prs.json'), `${JSON.stringify(o.setup.prs, null, 2)}\n`);
  writeFileSync(join(box, 'gh.log'), '');
  for (const file of ['gh.ts', 'gh-cli.ts'])
    copyFileSync(join(o.ghDir, file), join(box, 'bin', file));
  writeFileSync(join(box, 'bin', 'package.json'), '{ "type": "module" }\n');
  script(join(box, 'bin', 'gh'), 'exec node "$(dirname "$0")/gh-cli.ts" "$@"');
  script(join(box, 'bin', 'git'), `PATH="${helpers}:$PATH" exec "${o.realGit}" "$@"`);
}

function commitFiles(o: BuildOptions, commit: SyntheticCommit): void {
  for (const file of commit.files) {
    const target = join(o.workDir, file.path);
    mkdirSync(dirname(target), { recursive: true });
    const content =
      file.fixture === undefined
        ? (file.content ?? '')
        : readFileSync(join(o.fixturesDir, file.fixture), 'utf8');
    writeFileSync(target, content);
  }
  git(o.workDir, ['add', '--', ...commit.files.map((file) => file.path)]);
  git(o.workDir, ['commit', '--quiet', '-m', commit.message]);
}

/**
 * Rewrites the history of `origin` without `paths`, then drops the original objects. The rewrite
 * keeps messages, authors and dates, so a case's `git log` reads as the real one; the hashes
 * change. It starts at the earliest commit that touches a path: older commits cannot hold one,
 * keep their hashes, and cost nothing to leave alone. A ref that ends before that commit is not
 * rewritten (filter-branch reports it unchanged). It runs without DATES, which would stamp every
 * rewritten commit with them.
 */
function hideFromHistory(origin: string, paths: string[]): void {
  const touching = git(origin, [
    'rev-list',
    '--reverse',
    '--topo-order',
    '--full-history',
    '--all',
    '--',
    ...paths,
  ]);
  const first = touching.split('\n')[0];
  if (first === undefined || first === '') return;
  // `first`'s parents and everything behind them stay out of the rewrite. A root has none.
  const parents = git(origin, ['rev-list', '--parents', '-n', '1', first]).split(' ').slice(1);
  const quoted = paths.map((path) => `'${path}'`).join(' ');
  execFileSync(
    'git',
    [
      'filter-branch',
      '--force',
      '--index-filter',
      `git rm -r -q --cached --ignore-unmatch -- ${quoted}`,
      '--',
      '--all',
      ...parents.map((parent) => `^${parent}`),
    ],
    {
      cwd: origin,
      env: { ...withoutGitVars(process.env), FILTER_BRANCH_SQUELCH_WARNING: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  const backups = git(origin, ['for-each-ref', '--format=%(refname)', 'refs/original']);
  for (const ref of backups.split('\n').filter(Boolean)) git(origin, ['update-ref', '-d', ref]);
  git(origin, ['reflog', 'expire', '--expire=now', '--all']);
  git(origin, ['gc', '--quiet', '--prune=now']);
}

function script(path: string, body: string): void {
  writeFileSync(path, `#!/bin/sh\n${body}\n`);
  chmodSync(path, 0o755);
}
