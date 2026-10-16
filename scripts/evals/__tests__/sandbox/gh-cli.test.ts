import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const CLI = fileURLToPath(new URL('../../sandbox/gh-cli.ts', import.meta.url));

function fixtureDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'fake-gh-'));
  mkdirSync(join(dir, 'issues'));
  const issue = {
    number: 9000,
    title: 'chore: sandbox smoke issue',
    state: 'OPEN',
    body: '',
    comments: [],
    labels: [],
    milestone: null,
    size: 'XS',
    source: 'synthetic',
    why: 'test',
  };
  writeFileSync(join(dir, 'issues', '9000.json'), JSON.stringify(issue));
  writeFileSync(join(dir, 'prs.json'), '[]');
  writeFileSync(join(dir, 'gh.log'), '');
  return dir;
}

const run = (dir: string, ...args: string[]) =>
  execFileSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8',
    env: { ...process.env, FAKE_GH_DIR: dir },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

describe('gh-cli', () => {
  it('answers from the fixtures, runs jq, and appends to gh.log', () => {
    const dir = fixtureDir();
    expect(run(dir, 'issue', 'view', '9000', '--json', 'title', '--jq', '.title')).toBe(
      'chore: sandbox smoke issue\n',
    );
    expect(readFileSync(join(dir, 'gh.log'), 'utf8')).toBe(
      'READ gh issue view 9000 --json title --jq .title\n',
    );
  });

  it('exits 1 on a write, and logs it', () => {
    const dir = fixtureDir();
    expect(() => run(dir, 'pr', 'create', '--title', 'x')).toThrow();
    expect(readFileSync(join(dir, 'gh.log'), 'utf8')).toBe('WRITE gh pr create --title x\n');
  });
});
