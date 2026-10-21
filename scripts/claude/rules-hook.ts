// PreToolUse hook on Write (.claude/settings.json). Claude Code loads a path-scoped rule
// when a matching file is Read, but not when a new one is written (measured on 2.1.278;
// docs/superpowers/specs/2026-10-21-claude-rules-design.md), so for a file that does not
// exist yet this hands Claude the matching rules. An existing file needs nothing: Write
// refuses one that was not Read. Any failure prints nothing and exits 0, so the hook can
// never block a Write.
import { existsSync, readFileSync } from 'node:fs';
import { relative, sep } from 'node:path';
import { contextForNewFile, findRepoRoot, readRules } from './rules.ts';

interface HookInput {
  cwd?: string;
  tool_input?: { file_path?: string };
}

try {
  const input = JSON.parse(readFileSync(0, 'utf8')) as HookInput;
  const target = input.tool_input?.file_path;
  const root = (target && findRepoRoot(target)) ?? process.env.CLAUDE_PROJECT_DIR ?? input.cwd;
  if (target && root && !existsSync(target)) {
    const path = relative(root, target).split(sep).join('/');
    const context =
      path === '..' || path.startsWith('../') ? null : contextForNewFile(path, readRules(root));
    if (context) {
      process.stdout.write(
        JSON.stringify({
          hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: context },
        }),
      );
    }
  }
} catch {
  // Fail open: a missing rules folder or a malformed rule must not stop a Write.
}
