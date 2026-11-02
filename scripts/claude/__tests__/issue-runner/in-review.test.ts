import { describe, expect, it } from 'vitest';
import { fail, fakeRunner, json, ok, type Call } from '../../../ci/__tests__/fake-runner.ts';
import { createdPr, moveToReview } from '../../issue-runner/in-review.ts';

const created = (command: string, stdout: string) => ({
  hook_event_name: 'PostToolUse',
  tool_name: 'Bash',
  tool_input: { command },
  tool_response: { stdout, stderr: '', interrupted: false },
});

const PR_URL = 'https://github.com/tovmassian/escuadra/pull/271\n';

function github(closes: number[], editFails = false) {
  return fakeRunner((call: Call) => {
    const [group, sub] = call.args;
    if (group === 'pr' && sub === 'view') {
      return json({ closingIssuesReferences: closes.map((number) => ({ number })) });
    }
    if (group !== 'project') return undefined;
    if (sub === 'field-list') {
      return json({
        fields: [{ id: 'status', name: 'Status', options: [{ id: 'review', name: 'In review' }] }],
      });
    }
    if (sub === 'view') return json({ id: 'PVT_board' });
    if (sub === 'item-add') return json({ id: `PVTI_${call.args.at(-3)?.split('/').pop()}` });
    if (sub === 'item-edit') return editFails ? fail(1, 'insufficient scopes') : ok();
    return undefined;
  });
}

describe('createdPr', () => {
  it('finds the PR a successful gh pr create printed', () => {
    expect(createdPr(created('gh pr create --title x --body-file b', PR_URL))).toBe(271);
    expect(createdPr(created('git push -u origin HEAD && gh pr create --fill', PR_URL))).toBe(271);
  });

  it('ignores other commands, a failed create, and another repository', () => {
    expect(createdPr(created('gh pr view 271', PR_URL))).toBeNull();
    expect(createdPr(created('gh pr create --fill', 'pull request create failed'))).toBeNull();
    expect(createdPr(created('gh pr create', 'https://github.com/other/repo/pull/3'))).toBeNull();
    expect(createdPr({ tool_name: 'Write', tool_input: {} })).toBeNull();
    expect(createdPr(null)).toBeNull();
  });
});

describe('moveToReview', () => {
  it('moves every issue the PR closes to In review', async () => {
    const runner = github([207, 219]);
    const message = await moveToReview(runner, created('gh pr create --fill', PR_URL));
    const edits = runner.calls.filter((call) => call.args[1] === 'item-edit');
    expect(edits.map((call) => call.args[3])).toEqual(['PVTI_207', 'PVTI_219']);
    expect(edits.every((call) => call.args.at(-1) === 'review')).toBe(true);
    expect(runner.calls[0]?.args).toEqual([
      'pr',
      'view',
      '271',
      '--repo',
      'tovmassian/escuadra',
      '--json',
      'closingIssuesReferences',
    ]);
    expect(message).toBe('Board: #207 and #219 moved to In review, for PR #271.');
  });

  it('does nothing for a command that created no PR', async () => {
    const runner = github([207]);
    expect(await moveToReview(runner, created('gh issue list', ''))).toBeNull();
    expect(runner.calls).toEqual([]);
  });

  it('says so when the PR closes no issue', async () => {
    const message = await moveToReview(github([]), created('gh pr create', PR_URL));
    expect(message).toMatch(/closes no issue/);
  });

  it('reports a failed move with the command to retry, without throwing', async () => {
    const message = await moveToReview(github([207], true), created('gh pr create', PR_URL));
    expect(message).toContain('insufficient scopes');
    expect(message).toContain('node scripts/claude/issue-runner/board-status.ts 207 "In review"');
  });
});
