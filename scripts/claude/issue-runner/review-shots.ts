// node scripts/claude/issue-runner/review-shots.ts <image> [<image> …]
// From the PR's branch: pushes the images to review-shots/<branch> and prints Markdown
// links for the PR body (shots.ts). Where `npm run shots` covers the screen, capture
// with it and pass the files from design/screens/.
import { parseArgs } from 'node:util';
import { pushShots } from './shots.ts';

const { positionals } = parseArgs({ allowPositionals: true });

try {
  process.stdout.write(`${pushShots(process.cwd(), positionals).join('\n')}\n`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
