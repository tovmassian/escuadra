import { execFileSync } from 'node:child_process';
import { appendFileSync, cpSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { withoutGitVars } from '../../../evals/lib/sandbox.ts';
import { pushShots, shotsBranch } from '../../issue-runner/shots.ts';

// Every git call strips GIT_*: the pre-push hook exports GIT_DIR, and git would then act on
// the hook's repository.
const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', env: withoutGitVars(process.env) }).trim();

let template = '';

// Built once, in as few git spawns as it takes, and copied per test: git spawns crawl on a
// loaded Mac, and a fixture per test outran the 5 s timeout. The relative origin URL keeps
// each copy pointing at its own origin.
beforeAll(() => {
  template = mkdtempSync(join(tmpdir(), 'review-shots-template-'));
  const work = join(template, 'work');
  git(template, 'init', '--quiet', '--bare', 'origin.git');
  git(template, 'init', '--quiet', '--initial-branch=feat/207-shots', 'work');
  appendFileSync(
    join(work, '.git/config'),
    '[user]\n\tname = Test\n\temail = test@example.com\n[remote "origin"]\n\turl = ../origin.git\n',
  );
  writeFileSync(join(work, 'README.md'), 'escuadra\n');
  git(work, 'add', '.');
  git(work, 'commit', '--quiet', '-m', 'init');
});

/** A clone on a feature branch whose origin is a local bare repository. */
function clone(): { origin: string; work: string } {
  const root = mkdtempSync(join(tmpdir(), 'review-shots-'));
  cpSync(template, root, { recursive: true });
  return { origin: join(root, 'origin.git'), work: join(root, 'work') };
}

function shot(work: string, name: string, bytes: string): string {
  const path = join(work, name);
  writeFileSync(path, bytes);
  return path;
}

describe('shotsBranch', () => {
  it('names the companion branch after the PR branch', () => {
    expect(shotsBranch('feat/207-shots')).toBe('review-shots/feat/207-shots');
  });

  it('refuses main, release branches and a detached HEAD', () => {
    expect(() => shotsBranch('main')).toThrow(/PR branch/);
    expect(() => shotsBranch('release/2.0.0')).toThrow(/PR branch/);
    expect(() => shotsBranch('')).toThrow(/PR branch/);
  });
});

describe('pushShots', () => {
  it('commits the images to review-shots/<branch> on origin and returns raw links', () => {
    const { origin, work } = clone();
    const links = pushShots(work, [
      shot(work, 'home.png', 'png-1'),
      shot(work, 'results.png', 'png-2'),
    ]);
    expect(links).toEqual([
      '![home.png](https://github.com/tovmassian/escuadra/blob/review-shots/feat/207-shots/home.png?raw=true)',
      '![results.png](https://github.com/tovmassian/escuadra/blob/review-shots/feat/207-shots/results.png?raw=true)',
    ]);
    expect(git(origin, 'ls-tree', '--name-only', 'review-shots/feat/207-shots')).toBe(
      'home.png\nresults.png',
    );
    expect(git(origin, 'show', 'review-shots/feat/207-shots:home.png')).toBe('png-1');
  });

  it('leaves the PR branch, the index and the working tree as they were', () => {
    const { origin, work } = clone();
    const head = git(work, 'rev-parse', 'HEAD');
    pushShots(work, [shot(work, 'home.png', 'png-1')]);
    expect(git(work, 'rev-parse', 'HEAD')).toBe(head);
    expect(git(work, 'branch', '--show-current')).toBe('feat/207-shots');
    expect(git(work, 'status', '--porcelain')).toBe('?? home.png');
    expect(git(origin, 'branch', '--list', 'feat/*')).toBe('');
  });

  it('adds to the shots already pushed, replacing a file of the same name', () => {
    const { origin, work } = clone();
    pushShots(work, [shot(work, 'home.png', 'old'), shot(work, 'study.png', 'study')]);
    pushShots(work, [shot(work, 'home.png', 'new')]);
    const ref = 'review-shots/feat/207-shots';
    expect(git(origin, 'ls-tree', '--name-only', ref)).toBe('home.png\nstudy.png');
    expect(git(origin, 'show', `${ref}:home.png`)).toBe('new');
    expect(git(origin, 'rev-list', '--count', ref)).toBe('2');
  });

  it('shares no history with the PR branch, so nothing of it reaches main', () => {
    const { origin, work } = clone();
    pushShots(work, [shot(work, 'home.png', 'png-1')]);
    expect(git(origin, 'rev-list', '--count', 'review-shots/feat/207-shots')).toBe('1');
    expect(git(origin, 'ls-tree', '--name-only', 'review-shots/feat/207-shots')).not.toContain(
      'README.md',
    );
  });

  it('refuses no files, a non-image and two files with one name, before any push', () => {
    const { origin, work } = clone();
    expect(() => pushShots(work, [])).toThrow(/image/);
    expect(() => pushShots(work, [shot(work, 'notes.txt', 'x')])).toThrow(/notes\.txt/);
    const a = shot(work, 'home.png', 'a');
    expect(() => pushShots(work, [a, a])).toThrow(/home\.png/);
    expect(git(origin, 'branch', '--list', 'review-shots/*')).toBe('');
  });

  it('acts on the repository it runs in, not one an inherited GIT_DIR names', () => {
    const { origin, work } = clone();
    const decoy = clone();
    git(decoy.work, 'branch', '--quiet', '-m', 'feat/1-decoy');
    const before = git(decoy.work, 'for-each-ref');
    process.env.GIT_DIR = join(decoy.work, '.git');
    try {
      pushShots(work, [shot(work, 'home.png', 'png-1')]);
    } finally {
      delete process.env.GIT_DIR;
    }
    expect(git(origin, 'ls-tree', '--name-only', 'review-shots/feat/207-shots')).toBe('home.png');
    expect(git(decoy.work, 'for-each-ref')).toBe(before);
    expect(git(decoy.origin, 'for-each-ref')).toBe('');
  });

  it('encodes a file name for its link', () => {
    const { work } = clone();
    const [link] = pushShots(work, [shot(work, 'round over.png', 'x')]);
    expect(link).toContain('/round%20over.png?raw=true');
  });
});
