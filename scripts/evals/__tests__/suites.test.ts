// The escuadra-issue-runner suite: its generated files match cases.ts, and every
// case has what it loads. Importing cases.ts here also brings it under tsc.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SUITE } from '../../../.claude/skills/escuadra-issue-runner/evals/cases.ts';
import { STAYED_DRY_PATTERN } from '../lib/graders.ts';
import { renderSuite, staleCaseDirs } from '../lib/suite.ts';

const EVALS = fileURLToPath(
  new URL('../../../.claude/skills/escuadra-issue-runner/evals/', import.meta.url),
);

describe('escuadra-issue-runner suite', () => {
  it('matches cases.ts (regenerate with node scripts/evals/gen-cases.ts)', async () => {
    const files = await renderSuite(EVALS);
    for (const file of files) {
      expect(readFileSync(join(EVALS, file.path), 'utf8'), file.path).toBe(file.content);
    }
    expect(staleCaseDirs(EVALS, files)).toEqual([]);
  });

  it('has a fixture for every issue a case loads', () => {
    for (const item of SUITE.cases) {
      for (const number of item.issues) {
        const fixture = join(EVALS, '_fixtures', 'issues', `${number}.json`);
        expect(existsSync(fixture), `${item.name}: #${number}`).toBe(true);
      }
    }
  });

  it('names every case uniquely, in kebab case', () => {
    const names = SUITE.cases.map((item) => item.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it('covers the matrix in spec §7, plus the smoke case', () => {
    expect(SUITE.cases.map((item) => item.name).sort()).toEqual(
      [
        '115-closed',
        '116-release',
        '117-owner-decision',
        '126-small-bug',
        '129-large-spec',
        '129-large-spec-subagent',
        '55-tbc',
        '59-gh-pages',
        'dirty-tree',
        'fingerprint-on-release',
        'm-boundary',
        'neg-create-issue',
        'neg-question',
        'no-size',
        'on-feature-branch',
        'on-release-branch',
        'open-pr',
        'plan-half-done',
        'sandbox-smoke',
        'shipped-fix-from-main',
      ].sort(),
    );
  });

  it('proves on the smoke case that stayed-dry matches a real commit in the trace', () => {
    const smoke = SUITE.cases.find((item) => item.name === 'sandbox-smoke');
    if (smoke?.expect.kind !== 'smoke') throw new Error('no smoke case');
    expect(smoke.expect.graders).toContainEqual({
      type: 'regex',
      name: 'stayed-dry-fires',
      target: 'trace',
      pattern: STAYED_DRY_PATTERN,
      weight: 1,
    });
  });

  it('keeps a case the skill must not fire on', () => {
    expect(SUITE.cases.some((item) => item.expect.kind === 'no-triage')).toBe(true);
  });

  it('commits every fixture a case writes', () => {
    for (const item of SUITE.cases) {
      const commits = [...(item.commits ?? []), ...(item.branches ?? []).flatMap((b) => b.commits)];
      for (const file of commits.flatMap((commit) => commit.files)) {
        if (file.fixture === undefined) continue;
        expect(
          existsSync(join(EVALS, '_fixtures', file.fixture)),
          `${item.name}: ${file.fixture}`,
        ).toBe(true);
      }
    }
  });
});
