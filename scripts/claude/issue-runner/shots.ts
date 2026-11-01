// Commits review screenshots for a PR to its companion branch, review-shots/<PR branch>,
// and returns Markdown image links by raw branch URL. The companion branch shares no
// history with the PR, so a squash merge carries none of the images to main;
// .github/workflows/review-shots.yml deletes it when the PR closes, and the images go
// with it. Git plumbing, with a temporary index, so the PR branch, its index and the
// working tree are never touched.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { withoutGitVars } from '../../evals/lib/sandbox.ts';
import { REPO } from './board.ts';

const IMAGE = /\.(png|jpe?g|gif|webp)$/i;

export function shotsBranch(prBranch: string): string {
  if (!prBranch || prBranch === 'main' || prBranch.startsWith('release/')) {
    throw new Error(`Review shots belong to a PR branch, not "${prBranch || 'a detached HEAD'}"`);
  }
  return `review-shots/${prBranch}`;
}

export function pushShots(cwd: string, files: string[]): string[] {
  if (files.length === 0) throw new Error('Name at least one image');
  const names = files.map((file) => basename(file));
  for (const [index, file] of files.entries()) {
    const name = names[index] ?? file;
    if (!IMAGE.test(name)) throw new Error(`${name} is not a PNG, JPEG, GIF or WebP image`);
    if (!existsSync(file)) throw new Error(`${file} does not exist`);
    if (names.indexOf(name) !== index) throw new Error(`Two files are named ${name}`);
  }

  // Without GIT_*: a hook exports GIT_DIR, and git would then act on another repository.
  const git = (args: string[], env: Record<string, string> = {}) =>
    execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      env: { ...withoutGitVars(process.env), ...env },
    }).trim();
  const branch = shotsBranch(git(['branch', '--show-current']));
  const ref = `refs/heads/${branch}`;
  const remote = git(['ls-remote', 'origin', ref]).split(/\s/)[0] ?? '';

  const scratch = mkdtempSync(join(tmpdir(), 'review-shots-'));
  try {
    const index = { GIT_INDEX_FILE: join(scratch, 'index') };
    if (remote) {
      git(['fetch', '--quiet', 'origin', ref]);
      git(['read-tree', remote], index);
    }
    for (const [i, file] of files.entries()) {
      const blob = git(['hash-object', '-w', file]);
      git(['update-index', '--add', '--cacheinfo', `100644,${blob},${names[i]}`], index);
    }
    const tree = git(['write-tree'], index);
    const parent = remote ? ['-p', remote] : [];
    const commit = git(['commit-tree', tree, ...parent, '-m', `Review shots for ${branch}`]);
    git(['push', '--quiet', 'origin', `${commit}:${ref}`]);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }

  return names.map(
    (name) =>
      `![${name}](https://github.com/${REPO}/blob/${branch}/${encodeURIComponent(name)}?raw=true)`,
  );
}
