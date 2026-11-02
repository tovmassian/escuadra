// The escuadra-issue-runner suite's own checks; scripts/evals/__tests__/suites.test.ts checks
// what every suite must. Importing cases.ts here keeps its types checked against the graders.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { STAYED_DRY_PATTERN } from '../../../../../scripts/evals/lib/graders.ts';
import { SUITE } from '../cases.ts';
import { TRIAGE_TEMPLATE } from '../triage.ts';

const EVALS = fileURLToPath(new URL('../', import.meta.url));

describe("escuadra-issue-runner suite's own checks", () => {
  const skill = readFileSync(join(EVALS, '..', 'SKILL.md'), 'utf8');

  it('hides the skill from the sandbox clone (#171)', () => {
    expect(SUITE.hidden ?? []).toContain('.claude/skills/escuadra-issue-runner');
  });

  it('covers the matrix in spec §7, plus the smoke case', () => {
    expect(SUITE.cases.map((item) => item.name).sort()).toEqual(
      [
        '115-closed',
        '116-release',
        '160-route-choice',
        '55-store-console',
        '59-gh-pages',
        'dirty-tree',
        'fingerprint-on-release',
        'large-spec',
        'large-spec-subagent',
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
        'small-bug',
        'tbc-title',
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

  it('grades only first steps the triage template lists', () => {
    const line = TRIAGE_TEMPLATE.split('\n').find((text) => text.startsWith('first-step:')) ?? '';
    for (const item of SUITE.cases) {
      if (item.expect.kind !== 'triage' || item.expect.firstStep === undefined) continue;
      expect(line, item.name).toMatch(new RegExp(`[:|]${item.expect.firstStep}[|,]`));
    }
  });

  it('gives the skill the triage template the graders read', () => {
    expect(skill).toContain(TRIAGE_TEMPLATE);
  });

  it("keeps the skill's whole description, which an unquoted ` #` would cut short", () => {
    const description = /^description: (.*)$/m.exec(skill)?.[1] ?? '';
    // In a plain YAML scalar ` #` starts a comment, and everything after it is dropped.
    if (!/^['"]/.test(description)) expect(description).not.toMatch(/\s#/);
  });

  it('keeps a case the skill must not fire on', () => {
    expect(SUITE.cases.some((item) => item.expect.kind === 'no-triage')).toBe(true);
  });
});
