// Every skill's suite: its generated files match its cases.ts, and every case has what it
// loads. Each suite's own checks sit beside it, in its evals/__tests__/.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadSuite, renderSuite, SKILLS_DIR, staleCaseDirs, suiteNames } from '../lib/suite.ts';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SUITES = suiteNames(ROOT);

it('finds at least one suite', () => {
  expect(SUITES.length).toBeGreaterThan(0);
});

describe.each(SUITES)('%s suite', (skill) => {
  const EVALS = join(ROOT, SKILLS_DIR, skill, 'evals');

  it('matches cases.ts (regenerate with node scripts/evals/gen-cases.ts)', async () => {
    const files = await renderSuite(EVALS);
    for (const file of files) {
      expect(readFileSync(join(EVALS, file.path), 'utf8'), file.path).toBe(file.content);
    }
    expect(staleCaseDirs(EVALS, files)).toEqual([]);
  });

  it('has a fixture for every issue a case loads', async () => {
    const SUITE = await loadSuite(EVALS);
    for (const item of SUITE.cases) {
      for (const number of item.issues) {
        const fixture = join(EVALS, '_fixtures', 'issues', `${number}.json`);
        expect(existsSync(fixture), `${item.name}: #${number}`).toBe(true);
      }
    }
  });

  it('names every case uniquely, in kebab case', async () => {
    const SUITE = await loadSuite(EVALS);
    const names = SUITE.cases.map((item) => item.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it('declares the PR every commit on main was merged through', async () => {
    const SUITE = await loadSuite(EVALS);
    for (const item of SUITE.cases) {
      const prs = (item.prs ?? []).map((pr) => pr.number);
      for (const { message } of item.commits ?? []) {
        // A squash merge ends the subject with its PR: `… (#9007, part 1) (#9100)`.
        const merged = /\(#(\d+)\)$/.exec(message)?.[1];
        if (merged === undefined || item.issues.includes(Number(merged))) continue;
        expect(prs, `${item.name}: ${message}`).toContain(Number(merged));
      }
    }
  });

  it('commits every fixture a case writes', async () => {
    const SUITE = await loadSuite(EVALS);
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
