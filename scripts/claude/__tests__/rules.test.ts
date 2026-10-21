import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contextForNewFile, parseRule, readRules, ruleMatches, type Rule } from '../rules.ts';

const RULE = '---\npaths:\n  - "app/**"\n  - "lib/*View.ts"\n---\n\n# Screens\n\nRead the view.\n';

describe('parseRule', () => {
  it('reads double-quoted globs and the body after the frontmatter', () => {
    expect(parseRule('.claude/rules/screens.md', RULE)).toEqual({
      file: '.claude/rules/screens.md',
      paths: ['app/**', 'lib/*View.ts'],
      body: '# Screens\n\nRead the view.',
    });
  });

  it('refuses a rule with no frontmatter', () => {
    expect(() => parseRule('x.md', '# Screens\n')).toThrow(/x\.md: no frontmatter/);
  });

  it('refuses an unquoted glob, which YAML would read as an alias', () => {
    expect(() => parseRule('x.md', '---\npaths:\n  - **/*.json\n---\nBody\n')).toThrow(
      /x\.md: frontmatter line 2/,
    );
  });

  it('refuses any field but paths', () => {
    expect(() => parseRule('x.md', '---\ndescription: Screens\n---\nBody\n')).toThrow(
      /must start with "paths:"/,
    );
  });

  it('refuses an empty paths list', () => {
    expect(() => parseRule('x.md', '---\npaths:\n---\nBody\n')).toThrow(/paths is empty/);
  });
});

describe('ruleMatches', () => {
  const rule = parseRule('r.md', '---\npaths:\n  - "app/**"\n  - "data/*.{csv,txt}"\n---\nBody\n');

  it('matches nested paths, bracketed route names and brace globs', () => {
    expect(ruleMatches(rule, 'app/play/[squadId]/[level]/index.tsx')).toBe(true);
    expect(ruleMatches(rule, 'data/teams.txt')).toBe(true);
  });

  it('does not match outside its globs', () => {
    expect(ruleMatches(rule, 'lib/app.ts')).toBe(false);
    expect(ruleMatches(rule, 'data/teams.json')).toBe(false);
  });
});

describe('contextForNewFile', () => {
  const rules: Rule[] = [
    { file: '.claude/rules/a.md', paths: ['lib/**'], body: '# A\n\nRule A.' },
    { file: '.claude/rules/b.md', paths: ['app/**'], body: '# B\n\nRule B.' },
  ];

  it('gives every matching rule, named by its file', () => {
    const context = contextForNewFile('lib/fooView.ts', rules);
    expect(context).toContain('lib/fooView.ts');
    expect(context).toContain('<rule file=".claude/rules/a.md">\n# A\n\nRule A.\n</rule>');
    expect(context).not.toContain('Rule B.');
  });

  it('is null when no rule matches', () => {
    expect(contextForNewFile('scripts/scratch.ts', rules)).toBeNull();
  });
});

describe('readRules', () => {
  it('reads every rule under .claude/rules, nested ones included, in file order', () => {
    const root = mkdtempSync(join(tmpdir(), 'claude-rules-'));
    mkdirSync(join(root, '.claude/rules/ui'), { recursive: true });
    writeFileSync(join(root, '.claude/rules/b.md'), '---\npaths:\n  - "b/**"\n---\nB\n');
    writeFileSync(join(root, '.claude/rules/ui/a.md'), '---\npaths:\n  - "a/**"\n---\nA\n');
    writeFileSync(join(root, '.claude/rules/notes.txt'), 'not a rule');
    expect(readRules(root).map((rule) => rule.file)).toEqual([
      '.claude/rules/b.md',
      '.claude/rules/ui/a.md',
    ]);
  });
});
