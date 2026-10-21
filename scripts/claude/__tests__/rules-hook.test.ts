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

function run(root: string | undefined, stdin: string): string {
  const env = { ...process.env };
  delete env.CLAUDE_PROJECT_DIR;
  if (root) env.CLAUDE_PROJECT_DIR = root;
  return execFileSync('node', [HOOK], { input: stdin, env, encoding: 'utf8' });
}

const VIEWS = (rule: string) => `---\npaths:\n  - "lib/*View.ts"\n---\n\n# Views\n\n${rule}\n`;

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

  // The fixtures above have no .git, so they exercise the CLAUDE_PROJECT_DIR fallback;
  // the tests below give the roots a .git entry, as a real checkout has.
  it('takes the root from the target when a session writes inside a nested worktree', () => {
    const outer = mkdtempSync(join(tmpdir(), 'rules-hook-outer-'));
    mkdirSync(join(outer, '.git'));
    mkdirSync(join(outer, '.claude/rules'), { recursive: true });
    writeFileSync(join(outer, '.claude/rules/views.md'), VIEWS('Outer views.'));
    writeFileSync(
      join(outer, '.claude/rules/instructions.md'),
      '---\npaths:\n  - ".claude/**"\n---\n\n# Instructions\n\nInstructions rule.\n',
    );
    const tree = join(outer, '.claude/worktrees/x');
    mkdirSync(join(tree, '.claude/rules'), { recursive: true });
    mkdirSync(join(tree, 'lib'));
    writeFileSync(join(tree, '.git'), 'gitdir: ../../../.git/worktrees/x\n');
    writeFileSync(join(tree, '.claude/rules/views.md'), VIEWS('Worktree views.'));
    const context = JSON.parse(run(outer, write(join(tree, 'lib/newView.ts')))).hookSpecificOutput
      .additionalContext;
    expect(context).toContain('Worktree views.');
    expect(context).not.toContain('Outer views.');
    expect(context).not.toContain('Instructions rule.');
  });

  it('says nothing for a target outside the root', () => {
    const root = project();
    mkdirSync(join(root, '.git'));
    const other = mkdtempSync(join(tmpdir(), 'rules-hook-other-'));
    expect(run(root, write(join(other, 'lib/newView.ts')))).toBe('');
  });

  it('falls back to input.cwd when CLAUDE_PROJECT_DIR is unset and no .git is found', () => {
    const root = project();
    const stdin = JSON.stringify({
      cwd: root,
      tool_name: 'Write',
      tool_input: { file_path: join(root, 'lib/newView.ts'), content: '' },
    });
    const out = JSON.parse(run(undefined, stdin));
    expect(out.hookSpecificOutput.additionalContext).toContain('Views are pure.');
  });
});
