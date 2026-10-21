import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HOOK = fileURLToPath(new URL('../rules-hook.ts', import.meta.url));

function project(): string {
  const root = mkdtempSync(join(tmpdir(), 'rules-hook-'));
  mkdirSync(join(root, '.claude/rules'), { recursive: true });
  mkdirSync(join(root, 'lib'));
  writeFileSync(
    join(root, '.claude/rules/views.md'),
    '---\npaths:\n  - "lib/*View.ts"\n---\n\n# Views\n\nViews are pure.\n',
  );
  writeFileSync(join(root, 'lib/oldView.ts'), 'export {};\n');
  return root;
}

function run(root: string, stdin: string): string {
  return execFileSync('node', [HOOK], {
    input: stdin,
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
    encoding: 'utf8',
  });
}

const write = (filePath: string) =>
  JSON.stringify({
    hook_event_name: 'PreToolUse',
    tool_name: 'Write',
    tool_input: { file_path: filePath, content: '' },
  });

describe('rules-hook', () => {
  it('gives a new file the rules matching its path', () => {
    const root = project();
    const out = JSON.parse(run(root, write(join(root, 'lib/newView.ts'))));
    expect(out.hookSpecificOutput.hookEventName).toBe('PreToolUse');
    expect(out.hookSpecificOutput.additionalContext).toContain('Views are pure.');
  });

  it('says nothing for a file that exists: Write needs a Read first, which loaded its rules', () => {
    const root = project();
    expect(run(root, write(join(root, 'lib/oldView.ts')))).toBe('');
  });

  it('says nothing when no rule matches', () => {
    const root = project();
    expect(run(root, write(join(root, 'scripts/scratch.ts')))).toBe('');
  });

  it('never blocks a Write: bad input exits 0 and prints nothing', () => {
    const root = project();
    writeFileSync(join(root, '.claude/rules/broken.md'), '---\npaths:\n  - **/*.json\n---\n');
    expect(run(root, 'not json')).toBe('');
    expect(run(root, write(join(root, 'lib/newView.ts')))).toBe('');
  });
});
