// The `gh` command inside an eval sandbox (spec §5.1): loads the case's fixtures
// from <git common dir>/sandbox (or $FAKE_GH_DIR), answers through gh.ts, and
// appends the call to gh.log. Node built-ins only: it is copied into the sandbox.
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { handle, type IssueFixture, type PrFixture } from './gh.ts';

function git(args: string[]): string | null {
  try {
    const out = execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.trim();
  } catch {
    return null;
  }
}

function jq(input: string, expression: string): string {
  const result = spawnSync('jq', ['-r', expression], { input, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr.trim() || `jq failed on ${expression}`);
  return result.stdout;
}

const dir =
  process.env.FAKE_GH_DIR ?? join(git(['rev-parse', '--git-common-dir']) ?? '.git', 'sandbox');
const issues = readdirSync(join(dir, 'issues'))
  .filter((file) => file.endsWith('.json'))
  .map((file) => JSON.parse(readFileSync(join(dir, 'issues', file), 'utf8')) as IssueFixture);
const prs = JSON.parse(readFileSync(join(dir, 'prs.json'), 'utf8')) as PrFixture[];

const result = handle(
  process.argv.slice(2),
  { issues, prs, currentBranch: git(['branch', '--show-current']) },
  jq,
);
appendFileSync(join(dir, 'gh.log'), `${result.log}\n`);
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
process.exitCode = result.code;
