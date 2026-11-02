// What the PostToolUse hook (in-review-hook.ts) decides: once a Bash call's `gh pr create`
// has printed the new PR's URL, every issue the PR closes moves to In review on the board.
// It reports instead of throwing, so the hook never fails a call.
import { runJson, type Runner } from '../../ci/flows/runner.ts';
import { REPO, setStatus } from './board.ts';

export interface HookInput {
  tool_name?: string;
  tool_input?: { command?: string };
  tool_response?: unknown;
}

const CREATE = /\bgh\s+pr\s+create\b/;
const PR_URL = new RegExp(`https://github\\.com/${REPO}/pull/(\\d+)`);

export function createdPr(input: HookInput | null): number | null {
  const command = input?.tool_input?.command;
  if (input?.tool_name !== 'Bash' || !command || !CREATE.test(command)) return null;
  const response = input.tool_response;
  const stdout =
    typeof response === 'object' && response !== null && 'stdout' in response
      ? String(response.stdout)
      : String(response ?? '');
  const match = PR_URL.exec(stdout);
  return match ? Number(match[1]) : null;
}

const list = (issues: number[]) => {
  const refs = issues.map((issue) => `#${issue}`);
  return refs.length > 1 ? `${refs.slice(0, -1).join(', ')} and ${refs.at(-1)}` : (refs[0] ?? '');
};

export async function moveToReview(
  runner: Runner,
  input: HookInput | null,
): Promise<string | null> {
  const pr = createdPr(input);
  if (pr === null) return null;
  try {
    const { closingIssuesReferences } = await runJson<{
      closingIssuesReferences: { number: number }[];
    }>(runner, 'gh', [
      'pr',
      'view',
      String(pr),
      '--repo',
      REPO,
      '--json',
      'closingIssuesReferences',
    ]);
    const issues = closingIssuesReferences.map((issue) => issue.number);
    if (issues.length === 0) return `Board: PR #${pr} closes no issue, so no Status moved.`;
    const moved: number[] = [];
    const failures: string[] = [];
    for (const issue of issues) {
      try {
        await setStatus(runner, issue, 'In review');
        moved.push(issue);
      } catch (error) {
        failures.push(
          `#${issue} did not move (${error instanceof Error ? error.message : String(error)}); ` +
            `retry with: node scripts/claude/issue-runner/board-status.ts ${issue} "In review"`,
        );
      }
    }
    const done =
      moved.length > 0 ? [`Board: ${list(moved)} moved to In review, for PR #${pr}.`] : [];
    return [...done, ...failures.map((failure) => `Board: ${failure}`)].join('\n');
  } catch (error) {
    return `Board: could not read PR #${pr}'s issues (${error instanceof Error ? error.message : String(error)}).`;
  }
}
