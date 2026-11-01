// node scripts/claude/issue-runner/tick-dod.ts <issue> "<item text>" ["<item text>" …]
// Ticks those checkboxes in the issue body and prints the ones left open, each with
// room for the PR body to say why (dod.ts).
import { parseArgs } from 'node:util';
import { createRunner } from '../../ci/flows/runner.ts';
import { tickIssue, untickedReasons } from './dod.ts';

const { positionals } = parseArgs({ allowPositionals: true });
const [issue, ...items] = positionals;

try {
  if (!issue || !/^\d+$/.test(issue) || items.length === 0) {
    throw new Error('Usage: tick-dod.ts <issue> "<item text>" ["<item text>" …]');
  }
  process.stdout.write(untickedReasons(await tickIssue(createRunner(), Number(issue), items)));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
