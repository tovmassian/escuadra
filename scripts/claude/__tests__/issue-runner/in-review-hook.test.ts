import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HOOK = fileURLToPath(new URL('../../issue-runner/in-review-hook.ts', import.meta.url));

// A `gh` on PATH that answers the board's reads, accepts the item edit and logs every call.
const FAKE_GH = `#!/usr/bin/env node
const { appendFileSync } = require('node:fs');
const args = process.argv.slice(2);
appendFileSync(process.env.GH_LOG, args.join(' ') + '\\n');
const [group, sub] = args;
const out = (value) => process.stdout.write(JSON.stringify(value));
if (group === 'pr' && sub === 'view') out({ closingIssuesReferences: [{ number: 207 }] });
else if (sub === 'field-list') out({ fields: [{ id: 'status', name: 'Status', options: [{ id: 'review', name: 'In review' }] }] });
else if (sub === 'view') out({ id: 'PVT_board' });
else if (sub === 'item-add') out({ id: 'PVTI_207' });
else if (sub === 'item-edit') process.stdout.write('');
else process.exit(1);
`;

function run(stdin: string): { stdout: string; log: string } {
  const bin = mkdtempSync(join(tmpdir(), 'in-review-hook-'));
  const log = join(bin, 'gh.log');
  writeFileSync(log, '');
  writeFileSync(join(bin, 'gh'), FAKE_GH);
  chmodSync(join(bin, 'gh'), 0o755);
  const env = { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH}`, GH_LOG: log };
  const stdout = execFileSync('node', [HOOK], { input: stdin, env, encoding: 'utf8' });
  return { stdout, log: readFileSync(log, 'utf8') };
}

const bash = (command: string, stdout: string) =>
  JSON.stringify({
    hook_event_name: 'PostToolUse',
    tool_name: 'Bash',
    tool_input: { command },
    tool_response: { stdout, stderr: '', interrupted: false },
  });

describe('in-review-hook', () => {
  it('moves the closed issue to In review and tells the session', () => {
    const { stdout, log } = run(
      bash('gh pr create --fill', 'https://github.com/tovmassian/escuadra/pull/271\n'),
    );
    expect(JSON.parse(stdout).hookSpecificOutput).toEqual({
      hookEventName: 'PostToolUse',
      additionalContext: 'Board: #207 moved to In review, for PR #271.',
    });
    expect(log).toContain(
      'project item-edit --id PVTI_207 --project-id PVT_board --field-id status --single-select-option-id review',
    );
  });

  it('stays silent, and calls no gh, for any other Bash call', () => {
    expect(run(bash('npm run check', 'ok'))).toEqual({ stdout: '', log: '' });
  });

  it('never fails the call: bad input exits 0 and prints nothing', () => {
    expect(run('not json')).toEqual({ stdout: '', log: '' });
  });
});
