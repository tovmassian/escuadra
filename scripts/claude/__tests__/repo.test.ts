// scripts/claude/__tests__/repo.test.ts
// CLAUDE.md, the path-scoped rules and the docs stay true to the repository: within their
// size limits, with strict frontmatter, live globs and live citations
// (.claude/rules/instructions.md).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readRules, ruleMatches } from '../rules.ts';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const git = (...args: string[]) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);

// Tracked files, and new ones not yet added, so the test runs before a commit too.
const FILES = git('ls-files', '--cached', '--others', '--exclude-standard');
const FILE_SET = new Set(FILES);
const TOP_DIRS = new Set(FILES.filter((f) => f.includes('/')).map((f) => f.split('/')[0]));
const read = (file: string) => readFileSync(join(ROOT, file), 'utf8');
const rules = () => readRules(ROOT);

const DOCS = ['CLAUDE.md', 'README.md', 'CHANGELOG.md', 'docs/release.md', 'docs/license.md'];

/** Repository paths a document cites: relative links, and backticked paths under a
 *  top-level folder with no placeholder in them. */
function citedPaths(doc: string): string[] {
  const text = read(doc);
  const links = [...text.matchAll(/\]\(([^)\s]+)\)/g)]
    .map((m) => (m[1] ?? '').split('#')[0] ?? '')
    .filter((link) => link !== '' && !/^[a-z]+:/.test(link))
    .map((link) => normalize(join(dirname(doc), link)));
  const ticks = [...text.matchAll(/`([^`\s]+)`/g)]
    .map((m) => m[1] ?? '')
    .filter((path) => TOP_DIRS.has(path.split('/')[0]) && path.includes('/'))
    .filter((path) => !/[<>*{}$…]|X\.Y\.Z/.test(path));
  return [...links, ...ticks];
}

function exists(path: string): boolean {
  const dir = path.endsWith('/') ? path : `${path}/`;
  return FILE_SET.has(path) || FILES.some((file) => file.startsWith(dir));
}

function ignored(paths: string[]): Set<string> {
  if (paths.length === 0) return new Set();
  try {
    return new Set(
      execFileSync('git', ['check-ignore', '--stdin'], {
        cwd: ROOT,
        input: paths.join('\n'),
        encoding: 'utf8',
      })
        .split('\n')
        .filter(Boolean),
    );
  } catch {
    return new Set(); // check-ignore exits 1 when nothing is ignored
  }
}

describe('CLAUDE.md', () => {
  it('stays within 200 lines', () => {
    expect(read('CLAUDE.md').trimEnd().split('\n').length).toBeLessThanOrEqual(200);
  });
});

describe('.claude/rules', () => {
  it('every rule parses strictly', () => {
    expect(() => rules()).not.toThrow();
  });

  it('every rule stays within 100 lines', () => {
    const long = rules()
      .map((rule) => [rule.file, read(rule.file).trimEnd().split('\n').length] as const)
      .filter(([, lines]) => lines > 100);
    expect(long).toEqual([]);
  });

  it('every glob matches a file in the repository', () => {
    const dead = rules().flatMap((rule) =>
      rule.paths
        .filter((glob) => !FILES.some((file) => ruleMatches({ ...rule, paths: [glob] }, file)))
        .map((glob) => `${rule.file}: ${glob}`),
    );
    expect(dead).toEqual([]);
  });
});

describe('citations', () => {
  it('every path CLAUDE.md, a rule or a doc cites exists', () => {
    const docs = [...DOCS.filter((doc) => FILE_SET.has(doc)), ...rules().map((rule) => rule.file)];
    const cited = docs.flatMap((doc) => citedPaths(doc).map((path) => ({ doc, path })));
    const missing = cited.filter(({ path }) => !exists(path));
    const skip = ignored(missing.map(({ path }) => path));
    expect(
      missing.filter(({ path }) => !skip.has(path)).map(({ doc, path }) => `${doc}: ${path}`),
    ).toEqual([]);
  });

  // Code and docs cite rules by file and guardrails by number; both must resolve. The
  // rule loader's own tests are skipped: their fixtures name rules that never existed.
  const sources = FILES.filter(
    (file) =>
      /\.(ts|tsx|js|mjs|md|json|ya?ml)$/.test(file) &&
      !file.startsWith('scripts/claude/__tests__/') &&
      !file.startsWith('docs/superpowers/') &&
      !file.startsWith('.superpowers/') &&
      !file.startsWith('data/') &&
      !file.includes('.generated.'),
  );

  it('every .claude/rules/<name>.md cited exists', () => {
    const missing = sources.flatMap((file) =>
      [...read(file).matchAll(/\.claude\/rules\/([\w-]+)\.md/g)]
        .map((m) => `.claude/rules/${m[1]}.md`)
        .filter((rule) => !FILE_SET.has(rule))
        .map((rule) => `${file}: ${rule}`),
    );
    expect(missing).toEqual([]);
  });

  it('every guardrail cited by number exists', () => {
    const guardrails = read('CLAUDE.md').split('## Guardrails')[1]?.split('\n## ')[0] ?? '';
    const numbers = new Set([...guardrails.matchAll(/^(\d+)\. \*\*/gm)].map((m) => m[1]));
    const missing = sources.flatMap((file) =>
      [...read(file).matchAll(/[Gg]uardrails? (\d+)/g)]
        .map((m) => m[1] ?? '')
        .filter((n) => !numbers.has(n))
        .map((n) => `${file}: guardrail ${n}`),
    );
    expect(missing).toEqual([]);
  });
});
