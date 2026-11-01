// PostToolUse hook on Bash (.claude/settings.json): after `gh pr create` succeeds, the
// issues the new PR closes move to In review on the board (in-review.ts), and the session
// is told what moved or what to retry. Any failure prints nothing and exits 0, so the hook
// never fails a Bash call.
import { readFileSync } from 'node:fs';
import { createRunner } from '../../ci/flows/runner.ts';
import { moveToReview, type HookInput } from './in-review.ts';

try {
  const input = JSON.parse(readFileSync(0, 'utf8')) as HookInput;
  const message = await moveToReview(createRunner(), input);
  if (message) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: message },
      }),
    );
  }
} catch {
  // Fail open: malformed input must not fail the Bash call it follows.
}
