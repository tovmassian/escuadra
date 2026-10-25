import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  buildSandbox,
  realGitBinary,
  withoutGitVars,
  type SandboxSetup,
} from '../../lib/sandbox.ts';

const GH_DIR = fileURLToPath(new URL('../../sandbox/', import.meta.url));

function git(cwd: string, ...args: string[]): string {
  return gitWithInput(cwd, undefined, ...args);
}

// Every git call strips GIT_*: a hook exports GIT_DIR, and git would then act on the hook's repo.
function gitWithInput(cwd: string, input: string | undefined, ...args: string[]): string {
  const identity = ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid'];
  return execFileSync('git', [...identity, '-c', 'commit.gpgsign=false', ...args], {
    cwd,
    encoding: 'utf8',
    env: withoutGitVars(process.env),
    input,
  }).trim();
}

const temp = (prefix: string) => mkdtempSync(join(tmpdir(), prefix));

// A throwaway source repo: CI checks out one commit, so the real pins are not there.
function sourceRepo() {
  const dir = temp('sandbox-source-');
  git(dir, 'init', '--quiet', '--initial-branch', 'main');
  writeFileSync(join(dir, 'README.md'), '# Source\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '--quiet', '-m', 'first');
  const first = git(dir, 'rev-parse', 'HEAD');
  git(dir, 'branch', 'release/1.0.0');
  git(dir, 'branch', 'feat/unpinned');
  mkdirSync(join(dir, 'lib'));
  writeFileSync(join(dir, 'lib', 'x.ts'), 'export const x = 1;\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '--quiet', '-m', 'second');
  return { dir, first, second: git(dir, 'rev-parse', 'HEAD') };
}

function fixtures(): string {
  const dir = temp('sandbox-fixtures-');
  mkdirSync(join(dir, 'issues'));
  mkdirSync(join(dir, 'docs'));
  const issue = {
    number: 9001,
    title: 'fix: a synthetic bug',
    state: 'OPEN',
    body: 'Body.',
    comments: [],
    labels: ['bug'],
    milestone: null,
    size: 'XS',
    source: 'synthetic',
    why: 'test',
  };
  writeFileSync(join(dir, 'issues', '9001.json'), JSON.stringify(issue));
  writeFileSync(join(dir, 'docs', 'spec.md'), '# A synthetic spec\n');
  return dir;
}

describe('buildSandbox', () => {
  const source = sourceRepo();
  const work = temp('sandbox-work-');
  const box = join(work, '.git', 'sandbox');
  let origin = '';

  beforeAll(() => {
    const tmp = temp('sandbox-tmp-');
    origin = join(tmp, 'origin.git');
    const setup: SandboxSetup = {
      pins: { main: source.second, 'release/1.0.0': source.first },
      issues: ['issues/9001.json'],
      prs: [
        {
          number: 9101,
          title: 'fix: x (#9008)',
          state: 'OPEN',
          headRefName: 'fix/9008-x',
          baseRefName: 'main',
          body: 'Closes #9008',
        },
      ],
      commits: [
        {
          message: 'docs(spec): a synthetic spec (#9007)',
          files: [{ path: 'docs/spec.md', fixture: 'docs/spec.md' }],
        },
      ],
      branches: [
        {
          name: 'fix/9008-x',
          from: 'main',
          commits: [
            {
              message: 'fix: x (#9008)',
              files: [{ path: 'lib/x.ts', content: 'export const x = 2;\n' }],
            },
          ],
        },
      ],
      checkout: { branch: 'feat/9050-other', from: 'main' },
      dirty: ['README.md'],
      hidden: [],
    };
    buildSandbox({
      sourceRepo: source.dir,
      workDir: work,
      tmpDir: tmp,
      fixturesDir: fixtures(),
      ghDir: GH_DIR,
      realGit: realGitBinary(),
      setup,
    });
  });

  it('keeps only the pinned branches, and the pushed ones, on origin', () => {
    const heads = git(origin, 'for-each-ref', '--format=%(refname:short)', 'refs/heads');
    expect(heads.split('\n').sort()).toEqual(['fix/9008-x', 'main', 'release/1.0.0']);
    expect(git(origin, 'rev-parse', 'release/1.0.0')).toBe(source.first);
  });

  it('commits the synthetic history on main and pushes it', () => {
    expect(git(work, 'log', 'origin/main', '--format=%s').split('\n')).toEqual([
      'docs(spec): a synthetic spec (#9007)',
      'second',
      'first',
    ]);
  });

  it('leaves the requested branch checked out and the tree dirty', () => {
    expect(git(work, 'branch', '--show-current')).toBe('feat/9050-other');
    expect(git(work, 'status', '--porcelain')).toBe('M README.md');
  });

  it('puts the fixtures and an empty gh.log in .git/sandbox', () => {
    expect(existsSync(join(box, 'issues', '9001.json'))).toBe(true);
    expect(readFileSync(join(box, 'gh.log'), 'utf8')).toBe('');
    expect(JSON.parse(readFileSync(join(box, 'prs.json'), 'utf8'))).toHaveLength(1);
  });

  it('leaves the answer key, why and source, out of the copied fixtures', () => {
    const copied = JSON.parse(readFileSync(join(box, 'issues', '9001.json'), 'utf8')) as Record<
      string,
      unknown
    >;
    expect(copied).not.toHaveProperty('why');
    expect(copied).not.toHaveProperty('source');
    expect(copied.title).toBe('fix: a synthetic bug');
  });

  it('installs a gh wrapper that answers from those fixtures', () => {
    const title = execFileSync(
      join(box, 'bin', 'gh'),
      ['issue', 'view', '9001', '--json', 'title', '--jq', '.title'],
      { cwd: work, encoding: 'utf8', env: withoutGitVars(process.env) },
    );
    expect(title).toBe('fix: a synthetic bug\n');
    expect(readFileSync(join(box, 'gh.log'), 'utf8')).toContain('READ gh issue view 9001');
  });

  it('installs a git wrapper that reaches origin through the real helpers', () => {
    const wrapper = join(box, 'bin', 'git');
    const heads = execFileSync(wrapper, ['ls-remote', '--heads', 'origin'], {
      cwd: work,
      encoding: 'utf8',
      env: withoutGitVars(process.env),
    });
    expect(heads).toContain('refs/heads/fix/9008-x');
  });
});

describe('buildSandbox under an inherited GIT_DIR', () => {
  it('builds in the directories it is given and leaves the repo GIT_DIR names untouched', () => {
    // A hook exports GIT_DIR. The decoy stands in for the real repository; it is a temp repo.
    const decoy = temp('sandbox-decoy-');
    git(decoy, 'init', '--quiet', '--initial-branch', 'main');
    const source = sourceRepo();
    const work = temp('sandbox-work-');
    const setup: SandboxSetup = {
      pins: { main: source.second },
      issues: [],
      prs: [],
      commits: [
        { message: 'docs: a synthetic commit', files: [{ path: 'docs/a.md', content: 'a\n' }] },
      ],
      branches: [],
      checkout: { branch: 'main' },
      dirty: [],
      // The source's second commit adds lib/x.ts, so the rewrite, the destructive step, runs.
      hidden: ['lib'],
    };
    const saved = process.env.GIT_DIR;
    process.env.GIT_DIR = join(decoy, '.git');
    try {
      buildSandbox({
        sourceRepo: source.dir,
        workDir: work,
        tmpDir: temp('sandbox-tmp-'),
        fixturesDir: fixtures(),
        ghDir: GH_DIR,
        realGit: realGitBinary(),
        setup,
      });
    } finally {
      if (saved === undefined) delete process.env.GIT_DIR;
      else process.env.GIT_DIR = saved;
    }
    expect(git(work, 'log', '-1', '--format=%s')).toBe('docs: a synthetic commit');
    expect(git(decoy, 'config', '--get', 'core.bare')).toBe('false');
    expect(() =>
      execFileSync('git', ['rev-parse', '--verify', 'HEAD'], {
        cwd: decoy,
        env: withoutGitVars(process.env),
        stdio: 'pipe',
      }),
    ).toThrow();
    // The rewrite ran: main holds no lib/ and its tip is not the source's.
    expect(git(work, 'ls-tree', '-r', '--name-only', 'origin/main')).not.toContain('lib/');
  });
});

// A source repo where a secret path sits in two commits, and an unpinned branch holds its own blob.
function secretSource() {
  const dir = temp('sandbox-secret-');
  git(dir, 'init', '--quiet', '--initial-branch', 'main');
  mkdirSync(join(dir, 'secret'));
  writeFileSync(join(dir, 'secret', 'answers.md'), 'answer one\n');
  writeFileSync(join(dir, 'keep.md'), '# Keep\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '--quiet', '-m', 'first');
  const first = git(dir, 'rev-parse', 'HEAD');
  const firstBlob = git(dir, 'rev-parse', 'HEAD:secret/answers.md');
  writeFileSync(join(dir, 'secret', 'answers.md'), 'answer two\n');
  writeFileSync(join(dir, 'keep.md'), '# Keep\n\nMore.\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '--quiet', '-m', 'second');
  const second = git(dir, 'rev-parse', 'HEAD');
  const secondBlob = git(dir, 'rev-parse', 'HEAD:secret/answers.md');
  git(dir, 'switch', '--quiet', '-c', 'feat/unpinned');
  writeFileSync(join(dir, 'unpinned.md'), 'only on an unpinned branch\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '--quiet', '-m', 'unpinned');
  const unpinnedBlob = git(dir, 'rev-parse', 'HEAD:unpinned.md');
  git(dir, 'switch', '--quiet', 'main');
  return { dir, first, second, firstBlob, secondBlob, unpinnedBlob };
}

describe('buildSandbox with hidden paths', () => {
  const source = secretSource();
  const work = temp('sandbox-work-');
  let origin = '';

  const hasObject = (cwd: string, sha: string): boolean => {
    try {
      git(cwd, 'cat-file', '-e', sha);
      return true;
    } catch {
      return false;
    }
  };

  beforeAll(() => {
    const tmp = temp('sandbox-tmp-');
    origin = join(tmp, 'origin.git');
    buildSandbox({
      sourceRepo: source.dir,
      workDir: work,
      tmpDir: tmp,
      fixturesDir: fixtures(),
      ghDir: GH_DIR,
      realGit: realGitBinary(),
      setup: {
        pins: { main: source.second },
        issues: [],
        prs: [],
        commits: [],
        branches: [],
        checkout: { branch: 'main' },
        dirty: [],
        hidden: ['secret'],
      },
    });
  });

  it('leaves the hidden path out of the working directory and out of every commit', () => {
    expect(existsSync(join(work, 'secret'))).toBe(false);
    expect(git(origin, 'log', '--all', '--format=%H', '--', 'secret')).toBe('');
    expect(git(origin, 'rev-list', '--objects', '--all')).not.toContain('secret');
  });

  it('removes the hidden blobs from the object database, not just from reach', () => {
    for (const blob of [source.firstBlob, source.secondBlob]) {
      expect(hasObject(origin, blob), `origin has ${blob}`).toBe(false);
      expect(hasObject(work, blob), `clone has ${blob}`).toBe(false);
    }
  });

  it('carries no object from a branch that is not pinned', () => {
    expect(hasObject(origin, source.unpinnedBlob)).toBe(false);
  });

  it('keeps the rest of the history: subjects, authors and dates', () => {
    expect(git(work, 'log', 'origin/main', '--format=%s')).toBe('second\nfirst');
    expect(git(work, 'show', 'origin/main:keep.md')).toContain('More.');
    const dates = (cwd: string, ref: string) => git(cwd, 'log', ref, '--format=%aI %an');
    expect(dates(work, 'origin/main')).toBe(dates(source.dir, 'main'));
  });

  it('leaves no rewrite backup refs behind', () => {
    expect(git(origin, 'for-each-ref', '--format=%(refname)', 'refs/original')).toBe('');
  });
});

// A source repo where the hidden path first appears after the root, and a second pinned branch
// ends before that: a rewrite from the first touching commit leaves the older history alone.
function lateSecretSource() {
  const dir = temp('sandbox-late-');
  git(dir, 'init', '--quiet', '--initial-branch', 'main');
  writeFileSync(join(dir, 'keep.md'), '# Keep\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '--quiet', '-m', 'root');
  writeFileSync(join(dir, 'keep.md'), '# Keep\n\nOlder.\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '--quiet', '-m', 'older');
  // A header git's own commit-tree drops: a rewrite of this commit would change its hash, so an
  // unchanged hash shows the commit was never rewritten.
  const plain = git(dir, 'cat-file', 'commit', 'HEAD');
  const marked = plain.replace('\n\n', '\nx-untouched yes\n\n');
  const older = gitWithInput(dir, marked, 'hash-object', '-t', 'commit', '-w', '--stdin');
  git(dir, 'reset', '--quiet', '--hard', older);
  git(dir, 'branch', 'release/old');
  // A side branch that diverges before the first touching commit and carries its own commits, one
  // with the header a rewrite drops. It is not an ancestor of that commit, yet it holds no
  // hidden path, so its hashes must survive.
  git(dir, 'switch', '--quiet', '-c', 'release/side');
  writeFileSync(join(dir, 'side.md'), 'side one\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '--quiet', '-m', 'side one');
  const sidePlain = git(dir, 'cat-file', 'commit', 'HEAD');
  const sideMarked = sidePlain.replace('\n\n', '\nx-untouched yes\n\n');
  const sideMid = gitWithInput(dir, sideMarked, 'hash-object', '-t', 'commit', '-w', '--stdin');
  git(dir, 'reset', '--quiet', '--hard', sideMid);
  writeFileSync(join(dir, 'side.md'), 'side two\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '--quiet', '-m', 'side two');
  git(dir, 'switch', '--quiet', 'main');
  mkdirSync(join(dir, 'secret'));
  writeFileSync(join(dir, 'secret', 'answers.md'), 'answer one\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '--quiet', '-m', 'adds the secret');
  const firstBlob = git(dir, 'rev-parse', 'HEAD:secret/answers.md');
  writeFileSync(join(dir, 'secret', 'answers.md'), 'answer two\n');
  writeFileSync(join(dir, 'keep.md'), '# Keep\n\nNewer.\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '--quiet', '-m', 'changes the secret');
  const tip = git(dir, 'rev-parse', 'HEAD');
  const secondBlob = git(dir, 'rev-parse', 'HEAD:secret/answers.md');
  return { dir, older, tip, firstBlob, secondBlob, sideMid };
}

describe('buildSandbox with hidden paths that first appear late', () => {
  const source = lateSecretSource();
  const work = temp('sandbox-work-');
  let origin = '';

  const hasObject = (cwd: string, sha: string): boolean => {
    try {
      git(cwd, 'cat-file', '-e', sha);
      return true;
    } catch {
      return false;
    }
  };

  beforeAll(() => {
    const tmp = temp('sandbox-tmp-');
    origin = join(tmp, 'origin.git');
    buildSandbox({
      sourceRepo: source.dir,
      workDir: work,
      tmpDir: tmp,
      fixturesDir: fixtures(),
      ghDir: GH_DIR,
      realGit: realGitBinary(),
      setup: {
        pins: { main: source.tip, 'release/old': source.older, 'release/side': source.sideMid },
        issues: [],
        prs: [],
        commits: [],
        branches: [],
        checkout: { branch: 'main' },
        dirty: [],
        hidden: ['secret'],
      },
    });
  });

  it('keeps the hashes of the commits older than the first one that touches the path', () => {
    expect(git(origin, 'rev-parse', 'release/old')).toBe(source.older);
    expect(git(origin, 'rev-parse', 'main~2')).toBe(source.older);
    expect(git(origin, 'rev-parse', 'main~3')).toBe(git(source.dir, 'rev-parse', 'main~3'));
  });

  it('keeps the hashes of a pinned side branch that diverges before it, pinned below its tip', () => {
    expect(git(origin, 'rev-parse', 'release/side')).toBe(source.sideMid);
    expect(git(origin, 'cat-file', 'commit', 'release/side')).toContain('x-untouched yes');
  });

  it('leaves no FETCH_HEAD naming the source repository', () => {
    expect(existsSync(join(origin, 'FETCH_HEAD'))).toBe(false);
  });

  it('rewrites main without the path, and removes the blobs everywhere', () => {
    expect(git(origin, 'rev-parse', 'main')).not.toBe(source.tip);
    expect(existsSync(join(work, 'secret'))).toBe(false);
    expect(git(origin, 'log', '--all', '--format=%H', '--', 'secret')).toBe('');
    for (const blob of [source.firstBlob, source.secondBlob]) {
      expect(hasObject(origin, blob), `origin has ${blob}`).toBe(false);
      expect(hasObject(work, blob), `clone has ${blob}`).toBe(false);
    }
  });

  it('keeps the subjects, authors and dates', () => {
    const log = (cwd: string, ref: string) => git(cwd, 'log', ref, '--format=%s|%aI|%an');
    expect(log(work, 'origin/main')).toBe(log(source.dir, 'main'));
    expect(git(work, 'show', 'origin/main:keep.md')).toContain('Newer.');
  });

  it('leaves no rewrite backup refs behind', () => {
    expect(git(origin, 'for-each-ref', '--format=%(refname)', 'refs/original')).toBe('');
  });
});

describe('buildSandbox with a hidden path no pinned commit touches', () => {
  it('builds, and leaves the history as it was', () => {
    const source = lateSecretSource();
    const work = temp('sandbox-work-');
    const tmp = temp('sandbox-tmp-');
    buildSandbox({
      sourceRepo: source.dir,
      workDir: work,
      tmpDir: tmp,
      fixturesDir: fixtures(),
      ghDir: GH_DIR,
      realGit: realGitBinary(),
      setup: {
        pins: { main: source.older },
        issues: [],
        prs: [],
        commits: [],
        branches: [],
        checkout: { branch: 'main' },
        dirty: [],
        hidden: ['secret'],
      },
    });
    expect(git(join(tmp, 'origin.git'), 'rev-parse', 'main')).toBe(source.older);
    expect(git(work, 'log', 'origin/main', '--format=%s')).toBe('older\nroot');
  });
});
