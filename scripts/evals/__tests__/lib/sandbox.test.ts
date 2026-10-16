import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildSandbox, realGitBinary, type SandboxSetup } from '../../lib/sandbox.ts';

const GH_DIR = fileURLToPath(new URL('../../sandbox/', import.meta.url));

function git(cwd: string, ...args: string[]): string {
  const identity = ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid'];
  return execFileSync('git', [...identity, '-c', 'commit.gpgsign=false', ...args], {
    cwd,
    encoding: 'utf8',
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
      { cwd: work, encoding: 'utf8' },
    );
    expect(title).toBe('fix: a synthetic bug\n');
    expect(readFileSync(join(box, 'gh.log'), 'utf8')).toContain('READ gh issue view 9001');
  });

  it('installs a git wrapper that reaches origin through the real helpers', () => {
    const wrapper = join(box, 'bin', 'git');
    const heads = execFileSync(wrapper, ['ls-remote', '--heads', 'origin'], {
      cwd: work,
      encoding: 'utf8',
    });
    expect(heads).toContain('refs/heads/fix/9008-x');
  });
});
