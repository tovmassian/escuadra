# Path-scoped rules and release state out of the docs — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `CLAUDE.md` holds only what every session needs; each topic's detail moves to a path-scoped rule in `.claude/rules/`; release state moves out of the docs into `CHANGELOG.md`; tests keep it that way.

**Architecture:** A pure module (`scripts/claude/rules.ts`) parses and matches rules. A `PreToolUse` hook (`scripts/claude/rules-hook.ts`) uses it to give a new file its rules on Write, and a repository test (`scripts/claude/__tests__/repo.test.ts`) uses it to keep `CLAUDE.md`, the rules and the docs true to the repository. The docs move is verbatim wherever possible, from `CLAUDE.md` as it stands on `main` at `c5cb9931`.

**Tech Stack:** Node 24 (type stripping, `path.matchesGlob`), Vitest, Claude Code hooks, Markdown.

**Spec:** `docs/superpowers/specs/2026-10-21-claude-rules-design.md`

**Issue:** #165. Tick each Work and Acceptance box on the issue as its task lands (`gh issue view 165 --json body`, edit, `gh issue edit 165 --body-file`).

## Global Constraints

- Work in the worktree `.claude/worktrees/165-claude-rules`, on branch `docs/165-claude-rules`. Another session works on #136 in its own worktree; touch nothing under `.claude/skills/` or `scripts/evals/`.
- No npm script, dependency, `.gitignore` line, `app.json` or `eas.json` change. No new package import: `yaml`, `minimatch` and `picomatch` are only transitive.
- `CLAUDE.md` at most 200 lines; each rule at most 100 lines; every `paths` glob double-quoted, one per line, as `  - "<glob>"`.
- Guardrail numbers 1–7 stay. Guardrail 2 keeps crests, asset licensing and store badges in `CLAUDE.md` (the #136 skill cites "`CLAUDE.md` 2: crests, asset licences, store badges").
- "Old line N" means line N of `git show c5cb9931:CLAUDE.md`. Moved text is verbatim except for the edits each step lists.
- Rules state no status, dates, counts or history; a past incident survives only as one line of why.
- Comment density and voice follow the surrounding code: a short header comment saying what the file is for, plain English, no decorative banners.
- `npm run check` passes at the end of every task. Baseline before any change: 96 test files, 5,016 passed, 8 skipped. Fingerprints before: iOS `7fd49973dd54a35068e95e0d392e51ccb850e2b4`, Android `c814c2fcf2da87907cc0f19e840636c436561666`.

---

### Task 1: The rules module

**Files:**

- Create: `scripts/claude/rules.ts`
- Test: `scripts/claude/__tests__/rules.test.ts`

**Interfaces:**

- Produces:
  - `interface Rule { file: string; paths: string[]; body: string }`
  - `parseRule(file: string, text: string): Rule` — throws `Error` naming `file` unless the frontmatter is exactly `paths:` followed by one or more `  - "<glob>"` lines
  - `ruleMatches(rule: Rule, path: string): boolean` — `path` is relative to the repository root, `/`-separated
  - `contextForNewFile(path: string, rules: Rule[]): string | null`
  - `readRules(root: string): Rule[]` — every `.md` under `<root>/.claude/rules/`, recursively, sorted by `file`; `file` is relative to `root`; throws on the first rule that does not parse

- [ ] **Step 1: Write the failing tests**

```ts
// scripts/claude/__tests__/rules.test.ts
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
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run scripts/claude/__tests__/rules.test.ts`
Expected: FAIL, `Failed to load url ../rules.ts` (the module does not exist).

- [ ] **Step 3: Write the module**

```ts
// scripts/claude/rules.ts
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
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run scripts/claude/__tests__/rules.test.ts`
Expected: PASS, 10 tests. Also `npx tsc --noEmit` and `npx eslint scripts/claude` are clean.

- [ ] **Step 5: Commit**

```bash
git add scripts/claude/rules.ts scripts/claude/__tests__/rules.test.ts
git commit -m "test(claude): parse and match path-scoped rules strictly (#165)"
```

(Every commit message in this plan ends with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.)

---

### Task 2: The Write hook

**Files:**

- Create: `scripts/claude/rules-hook.ts`
- Modify: `.claude/settings.json`
- Test: `scripts/claude/__tests__/rules-hook.test.ts`

**Interfaces:**

- Consumes: `contextForNewFile`, `readRules` from Task 1.
- Produces: a command hook that reads Claude Code's `PreToolUse` JSON on stdin (`tool_input.file_path`, absolute) and, for a file that does not exist under `CLAUDE_PROJECT_DIR`, prints `{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"…"}}`. It prints nothing otherwise and always exits 0.

- [ ] **Step 1: Write the failing tests**

```ts
// scripts/claude/__tests__/rules-hook.test.ts
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
```

`execFileSync` throws on a non-zero exit, so every passing case also proves exit 0.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run scripts/claude/__tests__/rules-hook.test.ts`
Expected: FAIL, node cannot find `rules-hook.ts`.

- [ ] **Step 3: Write the hook**

```ts
// scripts/claude/rules-hook.ts
// PreToolUse hook on Write (.claude/settings.json). Claude Code loads a path-scoped rule
// when a matching file is Read, but not when a new one is written (measured on 2.1.278;
// docs/superpowers/specs/2026-10-21-claude-rules-design.md), so for a file that does not
// exist yet this hands Claude the matching rules. An existing file needs nothing: Write
// refuses one that was not Read. Any failure prints nothing and exits 0, so the hook can
// never block a Write.
import { existsSync, readFileSync } from 'node:fs';
import { relative, sep } from 'node:path';
import { contextForNewFile, readRules } from './rules.ts';

interface HookInput {
  cwd?: string;
  tool_input?: { file_path?: string };
}

try {
  const input = JSON.parse(readFileSync(0, 'utf8')) as HookInput;
  const target = input.tool_input?.file_path;
  const root = process.env.CLAUDE_PROJECT_DIR ?? input.cwd;
  if (target && root && !existsSync(target)) {
    const path = relative(root, target).split(sep).join('/');
    const context = path.startsWith('..') ? null : contextForNewFile(path, readRules(root));
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
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run scripts/claude/__tests__/rules-hook.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Register the hook**

`.claude/settings.json` becomes:

```json
{
  "enabledPlugins": {
    "expo@claude-plugins-official": true
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR/scripts/claude/rules-hook.ts\""
          }
        ]
      }
    ]
  }
}
```

Run: `npx prettier --check .claude/settings.json scripts/claude` — clean.

- [ ] **Step 6: Commit and tick #165's hook and module boxes**

```bash
git add scripts/claude/rules-hook.ts scripts/claude/__tests__/rules-hook.test.ts .claude/settings.json
git commit -m "feat(claude): a Write hook gives a new file its path-scoped rules (#165)"
```

---

### Task 3: Product and data rules

**Files:**

- Create: `.claude/rules/quiz.md`, `.claude/rules/stores.md`, `.claude/rules/squad-data.md`, `.claude/rules/team-identity.md`, `.claude/rules/photos.md`

Each file is the frontmatter shown, a `# Title` line, then the old lines named, verbatim, under the `##` headings given, with the edits listed. `CLAUDE.md` is not touched yet: until Task 6 the text exists twice.

- [ ] **Step 1: `quiz.md`**

```markdown
---
paths:
  - 'lib/questionEngine.ts'
  - 'lib/scoring.ts'
  - 'lib/roundView.ts'
  - 'lib/prng.ts'
  - 'app/play/**'
  - 'components/Answer*.tsx'
  - 'components/SlotChip.tsx'
  - 'components/Round*.tsx'
---

# The quiz
```

- `## Difficulty levels`: old lines 85–103.
- `## The question engine`: old lines 328–330, the leading `- ` removed.
- `## Answering is a tap (guardrail 3)`: old lines 154–165 with the leading `3. ` removed and the indentation dropped.

- [ ] **Step 2: `stores.md`**

```markdown
---
paths:
  - 'stores/**'
---

# State
```

- Old lines 331–335 and 388–389, as bullets.
- Add the bullet: ``- `stores/progress.ts` also holds the theme preference (it is not a third store) and telemetry's random `installId`, next to the About-screen opt-out.``

- [ ] **Step 3: `squad-data.md`**

```markdown
---
paths:
  - 'data/**'
  - 'tools/squadctl/**'
  - 'types/squad.ts'
  - 'lib/squads*.ts'
  - 'lib/dataIntegrity.test.ts'
  - 'scripts/gen-squads.ts'
  - 'scripts/roster-envelope.ts'
  - 'scripts/envelope-check.ts'
---

# Squad data
```

- `## The model`: old lines 215–245, then 281, 283–289. In line 260's paragraph keep only the generated-manifest sentences, starting at "`data/index.json` is generated from the squad files" (old 263–265); the colour fields go to `team-identity.md`.
- `## Verified, and how squads are made`: old lines 291–319.
- From old lines 320–324 keep only: "Designing a team's colours and `marker`, and triaging the conflicts squadctl reports, is done by hand (see `team-identity.md` for the colours)."

- [ ] **Step 4: `team-identity.md`**

```markdown
---
paths:
  - 'components/TeamMarker.tsx'
  - 'components/TeamRow.tsx'
  - 'components/Flag.tsx'
  - 'lib/flags.ts'
  - 'lib/stageView.ts'
  - 'assets/flags/**'
  - 'scripts/gen-flags.ts'
  - 'data/squads/**'
---

# Team identity
```

- `## Colours and markers`: old lines 246–262 (both colour paragraphs and the `marker` paragraph, and old 260–262's sentence that the manifest and each squad file carry `primaryColor`/`secondaryColor`/`marker`), then from guardrail 5 the sentences old 184–188 on team identity colour, starting "It does **not** apply to team identity colour".
- `## The in-round banner`: old lines 266–279.
- `## Flags (guardrail 2's carve-out)`: old lines 133–143, from "National flags are the one carve-out" to "would render "AR"."

- [ ] **Step 5: `photos.md`**

```markdown
---
paths:
  - 'lib/photos.ts'
  - 'components/Photo*.tsx'
  - 'components/SpotlightStage.tsx'
  - 'components/QuestionFooter.tsx'
  - 'components/PlayerCard.tsx'
  - 'scripts/commons.ts'
  - 'tools/squadctl/src/lib/photo-credit.ts'
  - 'tools/squadctl/src/lib/enrich*.ts'
---

# Player photos (guardrail 1)
```

- Old lines 112–128 with the leading `1. ` removed and the indentation dropped.
- Add: "Licences, the credit's parts and how the rule is enforced: `docs/license.md`, Player photos."

- [ ] **Step 6: Check them**

Run: `node -e 'import("./scripts/claude/rules.ts").then(m => console.log(m.readRules(".").map(r => r.file + " " + r.paths.length)))'`
Expected: the five files, with 8, 1, 8, 8 and 8 globs, and no error. Then `wc -l .claude/rules/*.md`: each under 100. Then `npx prettier --write .claude/rules`.

- [ ] **Step 7: Commit**

```bash
git add .claude/rules
git commit -m "docs(claude): product and data rules, scoped to their files (#165)"
```

---

### Task 4: Platform rules

**Files:**

- Create: `.claude/rules/design-tokens.md`, `.claude/rules/i18n.md`, `.claude/rules/privacy-telemetry.md`, `.claude/rules/fingerprint.md`, `.claude/rules/expo.md`, `.claude/rules/design-handoff.md`, `.claude/rules/licensing.md`
- Create: `theme/userInterfaceStyle.test.ts`

- [ ] **Step 1: Write the `userInterfaceStyle` test and see it pass, then fail**

```ts
// theme/userInterfaceStyle.test.ts
// Pinning userInterfaceStyle to "dark" or "light" locks the app to that theme and makes
// useColorScheme() return it on every device, so the system-following default never
// fires, with no error to trace it by (.claude/rules/design-tokens.md).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('app.json', () => {
  it('lets the device choose the theme', () => {
    const app = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')) as {
      expo: { userInterfaceStyle?: string };
    };
    expect(app.expo.userInterfaceStyle).toBe('automatic');
  });
});
```

Run: `npx vitest run theme/userInterfaceStyle.test.ts`. Expected: PASS. Then change `app.json`'s value to `"dark"`, run again, expect FAIL, and restore it with `git checkout app.json`. `git diff --exit-code app.json` must be clean afterwards.

- [ ] **Step 2: `design-tokens.md`**

```markdown
---
paths:
  - 'theme/**'
  - 'components/**'
  - 'app/**'
---

# Design tokens and theming
```

- `## Tokens (guardrail 5)`: old lines 179–183 and 189–194, with the leading `5. ` removed and the indentation dropped. Old 184–188 (team colour) become one sentence: "Team identity colour is content, not a token: `team-identity.md`."
- `## Theming`: old lines 336–341, the leading `- ` removed.
- `## Motion`: old lines 390–394, the leading `- ` removed, then: "The round-over celebration and the home lockup are the one carve-out: their timelines (`strikeTiming`, `resultsTimeline`, `homeCascade` in `theme/tokens.ts`) may run past 300 ms."
- `## The system theme`: old lines 420–426, the ⚠️ kept, with "This is the one theming failure that compiles, passes every test, and looks correct on a matching phone." replaced by "`theme/userInterfaceStyle.test.ts` pins it, because a pinned theme compiles and looks right on a phone set to the same theme."

- [ ] **Step 3: `i18n.md`**

```markdown
---
paths:
  - 'i18n/**'
  - 'app/**'
  - 'components/**'
  - 'lib/*View.ts'
  - 'lib/shareResult.ts'
  - 'eslint.config.js'
---

# Text and translations
```

- Old lines 342–367, the leading `- ` removed and the indentation dropped.

- [ ] **Step 4: `privacy-telemetry.md`**

```markdown
---
paths:
  - 'lib/telemetry*.ts'
  - 'lib/telemetrySdk.test.ts'
  - 'app/about.tsx'
  - 'lib/aboutView.ts'
  - 'scripts/privacy-pages.ts'
  - 'i18n/en.ts'
  - 'i18n/translationNotice.ts'
---

# Privacy, About and telemetry
```

- `## What leaves the device (guardrail 4)`: old lines 166–172. Then: "Today that is `expo-updates` checking EAS Update on launch, TelemetryDeck's opt-out usage signals, and player-photo thumbnails from Wikimedia Commons (`upload.`/`thumb.wikimedia.org`). `en.about.privacy` (`i18n/en.ts`) is the complete statement of what each service receives." (Old 173–178 without "from the next store version".)
- `## About stays true (guardrail 7)`: old lines 210–212, from "The Privacy section also reaches the privacy pages". Then: "The web policy is versioned, one folder per policy version: `docs/release.md`, Cut a release."
- `## Telemetry`: old lines 368–383, the leading `- ` removed.

- [ ] **Step 5: `fingerprint.md`**

```markdown
---
paths:
  - '.github/**'
  - 'scripts/ci/**'
  - 'app.json'
  - 'eas.json'
  - 'package.json'
  - 'package-lock.json'
  - '.gitignore'
---

# The fingerprint and the release pipeline

These files feed the native runtime's fingerprint or the release pipeline. Read
`docs/release.md` before changing one: "OTA or store build?" says which changes move the
fingerprint. On `main` that is fine; on a locked release branch it is a new version
(`CLAUDE.md`, Releases).
```

- `## The Expo SDK pin`: old lines 403–411, the ⚠️ kept.
- `## CI`: "The release logic lives in `scripts/ci/`, tested by `npm run check`. Workflows call `node scripts/ci/…` and `npx eas-cli …` directly, write temporary files to `$RUNNER_TEMP`, and name each action by its full commit SHA (`docs/release.md`, Pinned actions). `release-gate` treats a PR touching only Markdown, `docs/`, `.github/` and `scripts/ci/` as docs and CI (`scripts/ci/lib/pr.ts`)."

- [ ] **Step 6: `expo.md`**

```markdown
---
paths:
  - 'app/**'
  - 'components/**'
  - 'package.json'
  - 'metro.config.js'
---

# Expo SDK 57
```

- Old lines 398–401, the ⚠️ kept.
- Old lines 404–406's fact as: "`expo-dev-client` is installed, and EAS Build produces development, simulator, preview and production builds; an SDK upgrade is a release decision (`fingerprint.md`)."
- `## Since SDK 56`: old lines 414–418 as two bullets, without "That 54 → 57 jump also surfaced two real breakages worth knowing about if the SDK moves again:".

- [ ] **Step 7: `design-handoff.md`**

```markdown
---
paths:
  - 'design/**'
  - 'app/**'
  - 'scripts/capture-screens.mjs'
  - 'scripts/screenshot-profiles.ts'
  - 'scripts/generate-play-listing-assets.mjs'
  - 'assets/images/**'
  - 'theme/brand.ts'
---

# The design handoff and store assets
```

- Then a `bash` code fence holding old lines 441–445 (the `shots*` and `gen:play-assets` commands), then old lines 448–470.

- [ ] **Step 8: `licensing.md`**

```markdown
---
paths:
  - 'assets/**'
  - 'scripts/*licence*'
  - 'scripts/licence-texts/**'
  - 'lib/licences*.ts'
  - 'i18n/UNICODE-LICENSE.txt'
  - 'components/LicencesSheet.tsx'
---

# Licences

Asset licensing is a legal guardrail (`CLAUDE.md`, guardrail 2): never worked around.
Every shipped asset's licence, the photo licences accepted and refused, and how to
change either list: `docs/license.md`.

- A new kind of asset names its licence and source where it lives, as
  `assets/flags/README.md` does, and joins `docs/license.md`'s table.
```

- Then old lines 384–387 as a bullet. Then: "- Widening `ALLOWED_LICENCES` (`scripts/licences.ts`) is the owner's decision, never a way to make the check pass."

- [ ] **Step 9: Check them and commit**

Run the Task 3 Step 6 command (12 files now, no error), `wc -l .claude/rules/*.md` (each under 100), `npx prettier --write .claude/rules`, `npx vitest run theme`.

```bash
git add .claude/rules theme/userInterfaceStyle.test.ts
git commit -m "docs(claude): platform rules, and a test that pins the system theme (#165)"
```

Tick #165's "motion rule" and "`userInterfaceStyle`" boxes.

---

### Task 5: Testing and instructions rules

**Files:**

- Create: `.claude/rules/testing.md`, `.claude/rules/instructions.md`

These are new text, not moved text, and every claim was checked against the code on 2026-10-21. Re-check any claim a later change could have made untrue before committing.

- [ ] **Step 1: `testing.md`**

```markdown
---
paths:
  - '**/*.test.ts'
  - '**/__tests__/**'
  - 'vitest.config.ts'
---

# Testing

`npm run check` runs what CI runs: typecheck, lint, Prettier, Vitest, squadctl's registry
check and the generated-file diffs. Run it before reporting work done, and report its
actual output.

## What is tested

- **Vitest, in a node environment.** `vitest.config.ts`'s `include` names the folders
  that hold tests; a test anywhere else never runs, so a new folder joins `include` in the
  same change.
- **Screens and components are verified on a device and by `npm run shots`**, not by unit
  tests: no React Native renderer is set up, on purpose.
- **Logic is pure, so it can be tested.** `lib/questionEngine.ts` imports no React, no
  store and does no I/O. A module that wraps a native API keeps its decisions in a pure
  sibling the tests cover: `haptics.ts` and `hapticPlan.ts`, `share.ts` and
  `shareResult.ts`, `storeReview.ts` and `reviewPrompt.ts`, `telemetry.ts` and
  `telemetryEvents.ts`. A screen reads a pure `lib/*View.ts`.
- **Test first** for logic (superpowers:test-driven-development): see the test fail for
  the right reason before writing the code.
- **No network, no clock.** Tests read fixtures (squadctl's recorded Wikipedia and
  Wikidata responses) or run a fake (`scripts/evals/sandbox/gh-cli.ts`), and randomness
  comes from a seeded generator (`lib/prng.ts`).

## Layout

- Tests live in a `__tests__/` folder that mirrors the code it covers, with the fakes and
  fixtures they use, so code folders hold only code. `scripts/ci/__tests__/` is the model.
- An area that still keeps `*.test.ts` beside its code (`lib/`, `stores/`, `theme/`,
  `design/`, the top of `scripts/`, `tools/squadctl/`) keeps that layout until it moves
  over whole, in a PR of its own. A new test goes where its area's tests already are.

## Tests that guard a promise

A failure in one of these means what the app promises changed, not that the expectation
is stale. Never edit the expectation, widen an allowlist or loosen TypeScript to pass it.

- `lib/telemetrySdk.test.ts`: what the TelemetryDeck SDK sends. A failure is a disclosure
  review (`CLAUDE.md`, guardrail 4).
- `i18n/__tests__/catalogs.test.ts`: a hash of the English About. A change updates every
  catalog's `about`, each re-reviewed.
- `lib/dataIntegrity.test.ts`: every stored photo's licence and credit, and the squads'
  integrity (`docs/license.md`).
- `theme/userInterfaceStyle.test.ts`: the system-following theme.
- `scripts/claude/__tests__/repo.test.ts`: `CLAUDE.md` and these rules stay true to the
  repository.

## Generated files

`lib/squads.generated.ts`, `data/index.json`, `assets/flags/generated.ts` and
`lib/licences.generated.ts` are written by `npm run gen:squads`, `gen:flags` and
`gen:licences`. `npm run check` fails when one differs from what its generator writes:
regenerate it, never hand-edit it.
```

- [ ] **Step 2: `instructions.md`**

```markdown
---
paths:
  - 'CLAUDE.md'
  - '.claude/**'
  - 'docs/**'
  - 'README.md'
  - 'CHANGELOG.md'
---

# Writing the instructions

How `CLAUDE.md`, these rules and the docs are written, so they stay short and true.
`scripts/claude/__tests__/repo.test.ts` checks what a test can.

## Where a sentence goes

- **`CLAUDE.md`** holds only what every session needs: the game in brief, the
  guardrails, the release rules, scope, conventions, commands and an index. At most 200
  lines (tested). Keep a line only if removing it would make a session go wrong.
- **A rule in `.claude/rules/`** holds one topic's detail and loads when a session Reads
  a file its `paths` match. At most 100 lines (tested). Add a rule rather than grow
  `CLAUDE.md`, and list it in `CLAUDE.md`'s index.
- **`docs/`** holds procedures and concepts that people read too: `release.md`,
  `license.md`. A rule points at a doc rather than repeat it.
- **State lives where it changes:** what shipped in `CHANGELOG.md`, what is live in EAS
  and the store consoles, what is next in GitHub milestones and issues. A rule or
  `CLAUDE.md` never says "today", "next version", a current count or a status.
- **History** stays in git, specs and issues. A past incident survives only as the one
  line of why a rule exists.

## Writing a rule

- The frontmatter is a `paths:` list and nothing else, one double-quoted glob per line
  (tested). An unquoted glob that starts with `*` breaks the YAML, and the rule then
  loads in every session.
- Every glob matches a tracked file (tested), so a rename that strands a rule fails
  `npm run check`.
- Name the check that enforces a rule beside it, so a failing check leads back here.
- A guardrail keeps its number and its rule in `CLAUDE.md`, because code cites the
  number; its detail lives in a rule.
- Emphasis (bold, ⚠️) marks the one line sessions keep getting wrong, not many.

## How rules load

Measured on Claude Code 2.1.278
(`docs/superpowers/specs/2026-10-21-claude-rules-design.md`): a rule loads when a matching
file is Read, and in a subagent that Reads one. It does not load when a file is read
through Bash, or when a new one is written; `scripts/claude/rules-hook.ts` covers the new
file. Compaction drops a rule until a matching file is touched again. Open project files
with Read.
```

- [ ] **Step 3: Check and commit**

Run the Task 3 Step 6 command (14 files, no error), `wc -l .claude/rules/*.md`, `npx prettier --write .claude/rules`.

```bash
git add .claude/rules
git commit -m "docs(claude): testing standards and how the instructions are written (#165)"
```

Tick #165's "14 rules" and "`testing.md`" boxes.

---

### Task 6: The new `CLAUDE.md`, and pointers into it

**Files:**

- Modify: `CLAUDE.md` (replaced whole)
- Modify: `components/TeamRow.tsx:17`, `components/Flag.tsx:28-29`, `assets/flags/README.md:12`, `components/Wordmark.tsx:27`, `app/store/feature-graphic.tsx:10`, `components/TeamMarker.tsx:12`, `lib/stageView.ts:14`, `lib/questionEngine.ts:5`, `lib/squads.ts:2`, `lib/squads.test.ts:4`, `lib/dataIntegrity.test.ts:153`, `stores/session.ts:2`, `theme/tokens.ts:636`, `vitest.config.ts:4`

- [ ] **Step 1: Replace `CLAUDE.md`**

````markdown
# Escuadra

A football squad memorisation trainer for mobile. The player picks a team, a club or a
national side, and answers a round of questions about its players: given a shirt number
and a few stats, which player is this? At higher difficulties, also their position, and
their club or nationality.

The point is **recognition under time pressure, built by repetition**. It is a study
tool, not a party game: someone opens it to learn a squad before a tournament or a
season, in short repeated sessions. Every design decision follows from that: fast rounds,
instant feedback, and a results screen that shows what you got wrong, because the misses
are what the user came for.

_Escuadra_ means the squad, and _a la escuadra_ means a shot into the top corner of the
goal. A flawless round is **a la escuadra**: use that term in the UI rather than "perfect
score". Build on the existing scaffold and tokens; do not re-scaffold, and do not add a
second styling approach alongside the tokens.

## How these instructions load

This file holds what every session needs. Each topic's detail is a rule in
`.claude/rules/`, which loads when you Read a file its `paths` match; a hook gives a new
file its rules on Write. Rules do not load for files read through Bash, so open project
files with Read, not `cat`. Working on a topic before touching its files, in a plan, a
triage or an answer? Read its rule first.

| Rule                                                      | Covers                                              |
| --------------------------------------------------------- | --------------------------------------------------- |
| [`quiz`](.claude/rules/quiz.md)                           | Difficulty levels, distractors, the question engine |
| [`stores`](.claude/rules/stores.md)                       | Persisted and ephemeral state                       |
| [`squad-data`](.claude/rules/squad-data.md)               | The data model, `verified`, squadctl                |
| [`team-identity`](.claude/rules/team-identity.md)         | Team colours, markers, the in-round banner, flags   |
| [`photos`](.claude/rules/photos.md)                       | Player photos and their credits                     |
| [`design-tokens`](.claude/rules/design-tokens.md)         | Tokens, palettes, theming, motion                   |
| [`i18n`](.claude/rules/i18n.md)                           | Catalogs, translations, display names               |
| [`privacy-telemetry`](.claude/rules/privacy-telemetry.md) | What leaves the device, About, telemetry            |
| [`fingerprint`](.claude/rules/fingerprint.md)             | What moves the fingerprint, CI, the SDK pin         |
| [`expo`](.claude/rules/expo.md)                           | Expo SDK 57                                         |
| [`design-handoff`](.claude/rules/design-handoff.md)       | `design/`, screenshots, store assets                |
| [`licensing`](.claude/rules/licensing.md)                 | Licence notices and asset licences                  |
| [`testing`](.claude/rules/testing.md)                     | Testing standards                                   |
| [`instructions`](.claude/rules/instructions.md)           | How this file, the rules and the docs are written   |

## Guardrails

Two kinds. **Legal** guardrails (2, with its asset-licensing rule) are never worked
around: stop and ask. **Product and engineering** guardrails are the defaults: an issue
that explicitly changes one wins, and updates the guardrail here and its rule in the same
PR. Code cites guardrails by number, so the numbers stay.

1. **Player photos are hotlinked Wikimedia Commons thumbnails, always credited.** Nothing
   visible names the player: never the Commons file name or caption. Each load reaches
   Wikimedia, so photos ship in a store build with the privacy disclosures (guardrail 4),
   never over the air. Detail: `photos`.
2. **No club crests, badges, logos, or shield shapes. Ever.** Trademark exposure, and the
   constraint outlives every version. Clubs are identified by text and a banded colour
   marker, never an emblem. National flags are the one carve-out: committed PNGs in
   `assets/flags/`, never Unicode flag emoji (detail: `team-identity`). A crest inside a
   licensed player photo is part of that photo: never crop to it, enlarge it, isolate it
   or use it to identify a team. About says so, and says the marks belong to their owners.

   **Asset licensing (legal):** every shipped image has a licence someone can name, and
   the app does what it asks: [`docs/license.md`](docs/license.md). Store badges on the
   `gh-pages` site are licensed artwork: Apple's and Google's badges only as their
   guidelines allow, unmodified (never recoloured, greyed out or set inside a sentence),
   only for a store where the app is live, with their credit lines in the footer.

3. **No text input in the quiz. No keyboard for answering.** Every answer is a tap on an
   option card or a chip; no free-text answering, no fuzzy name matching. The one
   exception is the team picker's search field: do not add free-text input anywhere else.
4. **Offline-first, and privacy disclosures always match the binary.** Core gameplay works
   with no connection, and squad data stays bundled. Network features are allowed when an
   issue asks for them, but any change to what leaves the device (analytics, crash
   reporting, a backend call, a new SDK) ships **together** with the privacy pages, the
   About text word for word, Apple's App Privacy answers and Google Play's Data safety
   form: in a store build, never over the air. `en.about.privacy` (`i18n/en.ts`) is the
   complete statement of what leaves the device. Detail: `privacy-telemetry`.
5. **Never hardcode a colour, spacing value, or font size.** Everything comes from the
   design tokens, colour from the active palette through `useThemeColors()`; add a
   missing token rather than inline a value. A team's identity colours are real-world
   fact carried on the squad, never invented. Detail: `design-tokens`.
6. **The product is called Escuadra.** "Squad Trainer", "Squad Game", "Squad Quiz" and the
   like, as a product name, are stale wherever they survive: fix them on sight.
   Descriptive store copy may use category words such as "football squad quiz".
7. **The About screen stays true.** It states what leaves the device and what is stored
   on it; how photos are shown and credited; which assets are used, under which licence;
   and that Escuadra is unaffiliated. A change that could make any of that untrue is
   flagged in its PR and fixes the text in the same PR. When the wording needs a privacy,
   licensing or legal judgement, stop and discuss it with the owner first.

## Releases

How changes reach users, the branch model and every procedure:
[`docs/release.md`](docs/release.md). What each version shipped:
[`CHANGELOG.md`](CHANGELOG.md). The rules no session may break:

- **Nothing is published or built from `main`.** OTA updates and store builds come only
  from `release/X.Y.Z` branches.
- **Nothing that moves the fingerprint lands on a locked release branch:** npm scripts,
  dependency changes, `.gitignore` lines, `app.json`, `eas.json`, `fingerprint.config.js`.
  A change that needs one is a new version.
- **A fix for a shipped version starts on its release branch** and reaches `main` by
  `git cherry-pick -x`. Docs and CI changes go the other way.
- **`runtimeVersion` stays on the `fingerprint` policy.** `appVersion` would hand
  JavaScript to binaries that can't run it.
- **CI calls tools directly** (`node scripts/ci/…`, `npx eas-cli …`), never through new
  npm scripts, and writes temporary files to `$RUNNER_TEMP`, never new `.gitignore` lines.

## Scope

Scope lives in GitHub, in milestones and issues, not in this file. If the issue being
worked on asks for something (analytics, photos, a backend call, a new mode,
monetisation), that is the decision: build it well within the guardrails. Stop and ask
only when a request would break a legal guardrail, or when no issue covers it and it
changes the product's direction. Exam mode (a full-squad run on shirt numbers alone)
belongs as a standalone feature, not a fourth difficulty level.

## Working conventions

- **Node 24+: run `nvm use` first.** TypeScript runs through `node` directly, with no
  build step; on Node 22 every `.ts` entry point dies with `ERR_UNKNOWN_FILE_EXTENSION`.
- **Run `npm run check` and report its actual output** before claiming work is done.
- Prefer targeted edits over rewriting whole files.
- Flag design tradeoffs before building: a sentence in the plan, not a blocker, unless
  it touches a legal guardrail.
- TypeScript is strict, including `noUncheckedIndexedAccess`; never weaken it to make an
  error go away.
- User-visible text lives in `i18n/` and is read through `useT()`; `npm run lint` fails a
  hard-coded string in `app/` or `components/`.
- Every animation stays under 300 ms; the carve-outs are in `design-tokens`.
- Read the Expo docs for SDK 57 (https://docs.expo.dev/versions/v57.0.0/), never
  `latest`. An SDK upgrade is a release decision, not a dependency bump.

## Commands

```bash
nvm use               # .nvmrc pins 24; once per shell
npx expo start        # dev server; scan the QR with the iPhone Camera → Expo Go
npx expo start -c     # the same, clearing Metro's cache
npm run typecheck
npm run lint
npm test
npm run check         # everything CI runs; before reporting work done
```

## Reference

- [`docs/release.md`](docs/release.md): OTA updates, store builds, the fingerprint,
  release branches, rollback.
- [`docs/license.md`](docs/license.md): every shipped asset's licence, the photo
  licences accepted and refused, and how to change the list.
- [`CHANGELOG.md`](CHANGELOG.md): what each version shipped.
- [`tools/squadctl/README.md`](tools/squadctl/README.md): squadctl's commands, and every
  conflict it reports with the command that answers it.
- [`scripts/evals/README.md`](scripts/evals/README.md): grading an agent's issue triage
  with and without the `escuadra-issue-runner` skill.
- `docs/superpowers/specs/`: the design behind each feature; read the spec an issue names.
````

Run: `npx prettier --write CLAUDE.md`, then `wc -l CLAUDE.md`: at most 200 (157 when the plan was written). If it is over, shorten the Reference list first; never move a guardrail or a release rule out.

- [ ] **Step 2: Fix the pointers**

Each edit replaces only the quoted text:

| File                               | From                                             | To                                                                 |
| ---------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------ |
| `components/TeamRow.tsx:17`        | `CLAUDE.md hard constraint #2.`                  | `CLAUDE.md guardrail 2.`                                           |
| `components/Flag.tsx:28-29`        | `CLAUDE.md hard` / `// constraint #2 bans`       | `CLAUDE.md` / `// guardrail 2 bans`                                |
| `assets/flags/README.md:12`        | `CLAUDE.md hard constraint #2 bans`              | `CLAUDE.md guardrail 2 bans`                                       |
| `components/Wordmark.tsx:27`       | `see CLAUDE.md's "once-per-launch home lockup".` | ``see the once-per-launch home lockup in `theme/tokens.ts`.``      |
| `app/store/feature-graphic.tsx:10` | `see CLAUDE.md's Play store-listing guardrails.` | `see .claude/rules/design-handoff.md.`                             |
| `components/TeamMarker.tsx:12`     | `see CLAUDE.md's "in-round team marker" rule.`   | `see the in-round banner in .claude/rules/team-identity.md.`       |
| `lib/stageView.ts:14`              | `under the in-round banner rule (CLAUDE.md):`    | `under the in-round banner rule (.claude/rules/team-identity.md):` |
| `lib/questionEngine.ts:5`          | `iteration, per CLAUDE.md, and`                  | `iteration (.claude/rules/quiz.md), and`                           |
| `lib/squads.ts:2`                  | `held in a store, per CLAUDE.md)`                | `held in a store, per .claude/rules/squad-data.md)`                |
| `lib/squads.test.ts:4`             | `research-backed (CLAUDE.md)`                    | `research-backed (.claude/rules/squad-data.md)`                    |
| `lib/dataIntegrity.test.ts:153`    | `(CLAUDE.md — every member shares it)`           | `(.claude/rules/quiz.md — every member shares it)`                 |
| `stores/session.ts:2`              | `survive an app restart (CLAUDE.md).`            | `survive an app restart (.claude/rules/stores.md).`                |
| `theme/tokens.ts:636`              | `per CLAUDE.md's motion rule`                    | `per the motion rule (.claude/rules/design-tokens.md)`             |
| `vitest.config.ts:4`               | `(per CLAUDE.md,`                                | `(per .claude/rules/quiz.md,`                                      |

Re-wrap a comment only where the edit pushes a line past Prettier's width. Comments citing "CLAUDE.md guardrail N" (`lib/shareResult.ts`, `lib/telemetryEvents.ts`, `lib/telemetrySdk.test.ts`, `scripts/privacy-pages.ts`, `docs/license.md`, `docs/release.md`) stay: the numbers hold.

Run: `git grep -n "CLAUDE.md" -- ':!docs/superpowers' ':!.superpowers' ':!.claude/skills'` and confirm every remaining hit cites a guardrail by number, names `CLAUDE.md` as a file (the CI and evals tests), or is in `CLAUDE.md`, the rules, the docs or the README.

- [ ] **Step 3: Check and commit**

Run: `npm run check`. Expected: PASS.

```bash
git add CLAUDE.md components app assets lib stores theme vitest.config.ts
git commit -m "docs(claude): CLAUDE.md holds what every session needs, the rules the rest (#165)"
```

Tick #165's "`CLAUDE.md` at most 200 lines" and "Code comments" boxes.

---

### Task 7: The repository test

**Files:**

- Create: `scripts/claude/__tests__/repo.test.ts`

**Interfaces:**

- Consumes: `readRules`, `ruleMatches` from Task 1.

- [ ] **Step 1: Write the test**

```ts
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

  // Code and docs cite rules by file and guardrails by number; both must resolve.
  const sources = FILES.filter(
    (file) =>
      /\.(ts|tsx|js|mjs|md|json|ya?ml)$/.test(file) &&
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
```

- [ ] **Step 2: Run it**

Run: `npx vitest run scripts/claude/__tests__/repo.test.ts`
Expected: PASS. If the citations test lists real missing paths in `README.md`, `docs/release.md` or `docs/license.md`, fix the doc (a moved file, a typo); if it lists something that is not a repository path, tighten `citedPaths`'s filter rather than the doc. Note each such fix for the PR description.

- [ ] **Step 3: See each check fail**

One at a time, make the change, run the test, see the named test fail with the offender in its message, and undo the change with `git checkout -- <file>` (or delete the scratch file):

1. Append 40 blank-free lines (`printf 'x\n%.0s' {1..40} >> CLAUDE.md`): "stays within 200 lines" fails.
2. In `.claude/rules/stores.md`, change `  - "stores/**"` to `  - stores/**`: "parses strictly" fails.
3. Change it to `  - "stoores/**"`: "every glob matches" fails, naming `stoores/**`.
4. Add `` `lib/nowhere.ts` `` to `.claude/rules/quiz.md`: "every path … cites exists" fails.
5. Add `// see .claude/rules/nowhere.md` to `lib/prng.ts`: "every .claude/rules/<name>.md cited exists" fails.
6. Add `// guardrail 9` to `lib/prng.ts`: "every guardrail cited by number exists" fails.

`git status` is clean afterwards, apart from the new test.

- [ ] **Step 4: Commit**

Run: `npm run check`. Expected: PASS.

```bash
git add scripts/claude/__tests__/repo.test.ts
git commit -m "test(claude): CLAUDE.md, the rules and the docs stay true to the repository (#165)"
```

Tick #165's "A repository test" box.

---

### Task 8: Release state out of the docs

**Files:**

- Create: `CHANGELOG.md`
- Modify: `docs/release.md` (the "Start here" version table and its paragraph; "Cut a release")
- Modify: `README.md` ("App Store release", the "Pinned to SDK 57" bullet, the Scripts table's `check` row, Layout)

- [ ] **Step 1: Ask the owner for the backfill facts**

What the repository and GitHub say:

- 1.0.0: iOS live on the App Store; Android in Play's closed test (#49). The commit "docs: iOS 1.0.0 is live" (`git log --format='%ad %h' --date=short -S'iOS 1.0.0 is live' -- CLAUDE.md`) dates the App Store release.
- 1.0.1: cut from `release/1.0.0` for the Android adaptive icon (#93, #94), built on 2026-09-25 and 2026-10-11; both 1.0.0 and 1.0.1 then received the over-the-air fixes #101 (2026-10-11) and #104 (2026-10-13). `git log --oneline origin/release/1.0.0..origin/release/1.0.1` lists its commits.

Ask with AskUserQuestion: 1.0.0's release date (offer the commit's date), whether 1.0.1 is listed as released (with which date) or as built for Play's closed test, and whether the over-the-air fixes are listed under each version. Do not guess the answers.

- [ ] **Step 2: Write `CHANGELOG.md`**

```markdown
# Changelog

What each version of Escuadra shipped, newest first, in the form of
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions are `app.json`'s.

A version's section is written when its release branch is cut, from the PRs in its
milestone ([`docs/release.md`](docs/release.md#cut-a-release)). An over-the-air fix adds
its line under its version's **Fixed**, with the date it shipped, in the fix's own PR.
Work on `main` that no release branch holds yet is not listed: its milestone is.

## [1.0.1] - <owner's date>

### Fixed

- Android: the adaptive icon's mark fits inside the safe zone (#93, #94).
- Over the air, 2026-10-11: the question screen fits short screens and clears the
  system navigation bar (#101).
- Over the air, 2026-10-13: Back on the team picker always returns to Home (#104).

## [1.0.0] - <owner's date>

### Added

- 96 club and 46 national squads, and a team picker with search.
- Three difficulty levels, each a round of 10 questions.
- Results that show every miss, and Study, to look a squad over before playing it.
- Best scores kept on the device.
- Light and dark themes, following the device by default.
- About.

### Fixed

- Over the air, 2026-10-11: the question screen fits short screens and clears the
  system navigation bar (#101).
- Over the air, 2026-10-13: Back on the team picker always returns to Home (#104).

[1.0.1]: https://github.com/tovmassian/escuadra/tree/release/1.0.1
[1.0.0]: https://github.com/tovmassian/escuadra/tree/release/1.0.0
```

Add any other user-facing over-the-air publish to a version's **Fixed** (`gh run list -R tovmassian/escuadra --workflow ota-production.yml --branch release/1.0.0 --limit 30`; CI and docs publishes are not changes users see), and correct the **Added** list against `release/1.0.0`'s history if the owner's answers show 1.0.0 shipped more or less. The two `<owner's date>` slots are filled from Step 1's answers; neither survives into the commit (the repository test's placeholder filter would hide a `<…>` path, so check by eye: `grep -n '<' CHANGELOG.md` prints nothing). The headings link the release branches, not tags: 1.0.0's iOS and Android builds came from different commits.

- [ ] **Step 3: `docs/release.md`**

Replace the version table and the paragraph after it ("Keep this table current … straight to review.") with:

```markdown
**Where things stand.** What each version shipped: [`CHANGELOG.md`](../CHANGELOG.md).
Which builds are live, and on which runtime: EAS
(`npx eas-cli build:list --platform ios --build-profile production --status finished --limit 5`)
and the store consoles. A version in progress: its milestone and its release issue. None
of it is written here, because a copy goes stale.
```

In "Cut a release", after step 2 (cut the branch), insert:

```markdown
3. On `main`, write the version's section of [`CHANGELOG.md`](../CHANGELOG.md) from the
   milestone's merged PRs (`gh pr list --state merged --search "milestone:vX.Y.Z"`), and
   pick it to the branch.
```

Renumber the steps after it, and point the in-text references at their new numbers ("Play when step 5 uploads the build, Apple before step 6's Submit for Review"). In the last step, after "Close each freeze once approved", replace "and update [Start here](#start-here)." with:

```markdown
Then tag the commit the build came from (its `store-build` run names it) and publish its
notes: `git tag vX.Y.Z <commit> && git push origin vX.Y.Z`, then
`gh release create vX.Y.Z --title X.Y.Z --notes-file <the version's CHANGELOG section>`.
No workflow runs on tags. Play's 12-tester, 14-day closed test gates only a new app's
first production release; later updates go straight to review.
```

In the 1.0.1 procedure, step 2 becomes "A PR into `release/1.0.1` with the fix, `app.json` at `1.0.1` and the version's `CHANGELOG.md` section."

- [ ] **Step 4: `README.md`**

- "## App Store release" becomes "## Releases": "Escuadra is on the [**App Store**](https://apps.apple.com/us/app/escuadra/id6810705505). What each version shipped is in [`CHANGELOG.md`](CHANGELOG.md); how a change reaches users, as an over-the-air update or a store build, is [`docs/release.md`](docs/release.md). The marketing site and the privacy and support pages are published from the [`gh-pages`](https://github.com/tovmassian/escuadra/tree/gh-pages) branch."
- The "Pinned to SDK 57 on purpose" bullet becomes: "**Pinned to SDK 57 on purpose.** The binary in the stores is SDK 57, and an SDK upgrade changes the native runtime, which invalidates every over-the-air update path and forces a new build and submission. An SDK upgrade is a release decision."
- The Scripts table's `npm run check` row: "typecheck, lint, format check, tests, squadctl's registry check and the generated-file diffs: everything CI runs, and the pre-push gate". Add a row `npm test` → "Vitest, once".
- Layout: `lib/` → "logic: pure modules are unit-tested; the few that wrap a native API keep their decisions in a pure sibling"; add `i18n/` ("the catalogs and translations"), `scripts/` ("generators, CI logic and evals"), `tools/` ("squadctl"). The sentence under the block becomes: "`lib/questionEngine.ts` stays pure, so the question engine is unit-testable without a renderer."

- [ ] **Step 5: Check and commit**

Run: `npm run check`. Expected: PASS (the repository test now also checks `CHANGELOG.md`'s citations).

```bash
git add CHANGELOG.md docs/release.md README.md
git commit -m "docs: release state lives in CHANGELOG.md, EAS and GitHub, not in the docs (#165)"
```

Tick #165's `CHANGELOG.md`, `docs/release.md` and `README.md` boxes.

---

### Task 9: Verify, #116, and the PR

- [ ] **Step 1: The fingerprint**

Run: `for p in ios android; do npx expo-updates fingerprint:generate --platform $p | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(process.argv[1], JSON.parse(d).hash))' $p; done`
Expected: iOS `7fd49973dd54a35068e95e0d392e51ccb850e2b4`, Android `c814c2fcf2da87907cc0f19e840636c436561666`. If either differs, stop: something that feeds the runtime changed, and the cause is found before anything else.

- [ ] **Step 2: Nothing lost**

Dispatch a fresh reviewer (Agent, general-purpose) with: `git show c5cb9931:CLAUDE.md`, the new `CLAUDE.md`, every `.claude/rules/*.md`, `docs/release.md`, `docs/license.md`, `CHANGELOG.md`, issue #116's body, and the spec's "Where each part of `CLAUDE.md` goes" table. It lists every rule, fact or instruction in the old file that has no home in the new files and is not a deliberate deletion in that table. Fix each real gap; record any it raised that you decline, with the reason, for the PR.

- [ ] **Step 3: The hook in a real session**

From the worktree root, three headless sessions on Haiku (state the count to the owner first; about $0.03 each at API rates):

```bash
claude -p "Use the Write tool to create lib/__tests__/scratch.test.ts containing exactly: export {}; Read nothing first. Then quote, word for word, the first heading of any project rule you were given for that file, or say 'none'." --model haiku --permission-mode acceptEdits --allowedTools Write --output-format json
claude -p "Use the Write tool to create lib/scratchView.ts containing exactly: export {}; Read nothing first. Then quote, word for word, the first heading of any project rule you were given for that file, or say 'none'." --model haiku --permission-mode acceptEdits --allowedTools Write --output-format json
claude -p "Use the Write tool to create scripts/scratch.ts containing exactly: export {}; Read nothing first. Then quote, word for word, the first heading of any project rule you were given for that file, or say 'none'." --model haiku --permission-mode acceptEdits --allowedTools Write --output-format json
```

Expected: `# Testing`; `# Text and translations`; `none`. Delete the three scratch files (`git status` clean).

- [ ] **Step 4: #116 and the spec**

- Ask the owner (AskUserQuestion) to approve editing #116: drop "`CLAUDE.md`: 'Current state' describes 2.0" and "and remove CLAUDE.md's ⚠️ release note" (both obsolete after this change); add, under "At submission", "Write the 2.0.0 section of `CHANGELOG.md` when `release/2.0.0` is cut" and, under "After the build is out", "Tag the built commit `v2.0.0` and publish its GitHub Release (`docs/release.md`, Cut a release)". Edit only on a yes.
- In the spec's "Owner inputs", replace "An issue for this work, for the branch and PR names." with "The issue: #165."

```bash
git add docs/superpowers/specs/2026-10-21-claude-rules-design.md
git commit -m "docs(spec): the issue for path-scoped rules is #165"
```

- [ ] **Step 5: Final check, issue and PR**

Run: `npm run check`, keeping its summary lines for the PR. Tick the remaining Acceptance boxes on #165 that the evidence supports, and say which, if any, are not met.

Push and open the PR (base `main`, title `docs: path-scoped rules for CLAUDE.md, and release state out of the docs (#165)`). The body: what changed, the spike table, the check output, the fingerprints before and after, the reviewer's findings, the #136 note (no shared files; when its `PINS` move past this merge, the dry-run prompt adds `.claude/rules/`), and `Closes #165`. End it with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
