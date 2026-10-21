// Path-scoped rules in .claude/rules/: the strict frontmatter parser and the glob matcher
// that the Write hook and the repository test share. Claude Code reads only `paths` from
// a rule's frontmatter, and an unquoted glob starting with `*` breaks the YAML, after which
// the rule loads in every session; so the parser accepts double-quoted globs and nothing
// else (docs/superpowers/specs/2026-10-21-claude-rules-design.md).
import { readdirSync, readFileSync } from 'node:fs';
import { join, matchesGlob } from 'node:path';

export interface Rule {
  /** The rule's file, relative to the repository root. */
  file: string;
  paths: string[];
  /** The text after the frontmatter. */
  body: string;
}

const FRONTMATTER = /^---\n([\s\S]*?)\n?---\n/;
const GLOB_LINE = /^ {2}- "([^"\\]+)"$/;

export function parseRule(file: string, text: string): Rule {
  const match = FRONTMATTER.exec(text);
  if (!match) throw new Error(`${file}: no frontmatter`);
  const [first, ...rest] = (match[1] ?? '').split('\n');
  if (first !== 'paths:') throw new Error(`${file}: frontmatter must start with "paths:"`);
  const paths = rest
    .filter((line) => line !== '')
    .map((line, i) => {
      const glob = GLOB_LINE.exec(line)?.[1];
      if (glob === undefined) {
        throw new Error(`${file}: frontmatter line ${i + 2} is not a double-quoted glob: ${line}`);
      }
      return glob;
    });
  if (paths.length === 0) throw new Error(`${file}: paths is empty`);
  return { file, paths, body: text.slice(match[0].length).trim() };
}

export function ruleMatches(rule: Rule, path: string): boolean {
  return rule.paths.some((glob) => matchesGlob(path, glob));
}

/** What the Write hook tells Claude about a file that does not exist yet. */
export function contextForNewFile(path: string, rules: Rule[]): string | null {
  const matching = rules.filter((rule) => ruleMatches(rule, path));
  if (matching.length === 0) return null;
  return [
    `${path} is a new file, and Claude Code loads path-scoped rules on Read, not on Write. The rules for it:`,
    ...matching.map((rule) => `<rule file="${rule.file}">\n${rule.body}\n</rule>`),
  ].join('\n\n');
}

export function readRules(root: string): Rule[] {
  const dir = join(root, '.claude/rules');
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((name) => name.endsWith('.md'))
    .map((name) => `.claude/rules/${name.split('\\').join('/')}`)
    .sort()
    .map((file) => parseRule(file, readFileSync(join(root, file), 'utf8')));
}
