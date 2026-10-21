// Captures a real issue as a fixture for the suite:
//   node scripts/evals/capture-issue.ts 126 --why "S bug, in place"
// It uses the real gh, so run it in an ordinary shell. A snapshot records the
// issue as it stands at the main pin (spec §6), so compare the issue's last
// edit and close times with the pin's commit date, and undo body edits and
// state changes made after it by hand, saying so in `source`.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { SIZE_QUERY, sizeFrom, toFixture, type GhIssue, type SizeResponse } from './lib/capture.ts';
import { formatFor } from './lib/format.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    why: { type: 'string' },
    date: { type: 'string' },
    suite: { type: 'string', default: '.claude/skills/escuadra-issue-runner' },
  },
});
const number = Number(positionals[0]);
if (!Number.isInteger(number) || values.why === undefined) {
  throw new Error('usage: node scripts/evals/capture-issue.ts <number> --why "<what it tests>"');
}

const gh = (args: string[]) => execFileSync('gh', args, { encoding: 'utf8' });
const fields = 'number,title,state,body,comments,labels,milestone';
const issue = JSON.parse(
  gh(['issue', 'view', String(number), '-R', 'tovmassian/escuadra', '--json', fields]),
) as GhIssue;
const size = sizeFrom(
  JSON.parse(
    gh(['api', 'graphql', '-f', `query=${SIZE_QUERY}`, '-F', `n=${number}`]),
  ) as SizeResponse,
);
const date = values.date ?? new Date().toISOString().slice(0, 10);

const file = join(root, values.suite, 'evals', '_fixtures', 'issues', `${number}.json`);
mkdirSync(dirname(file), { recursive: true });
const json = `${JSON.stringify(toFixture(issue, size, values.why, date), null, 2)}\n`;
writeFileSync(file, await formatFor(file, json));
process.stdout.write(`Wrote ${file}\n`);
