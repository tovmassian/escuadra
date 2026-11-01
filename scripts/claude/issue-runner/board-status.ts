// node scripts/claude/issue-runner/board-status.ts <issue> "In progress"
// Moves the issue to that Status on the Escuadra board (board.ts). Done is the merge's.
import { parseArgs } from 'node:util';
import { createRunner } from '../../ci/flows/runner.ts';
import { setStatus } from './board.ts';

const { positionals } = parseArgs({ allowPositionals: true });
const [issue, status] = positionals;

try {
  if (!issue || !/^\d+$/.test(issue) || !status) {
    throw new Error('Usage: board-status.ts <issue> "<Status>"');
  }
  await setStatus(createRunner(), Number(issue), status);
  process.stdout.write(`#${issue} is ${status} on the board.\n`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
