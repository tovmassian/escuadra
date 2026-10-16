// The escuadra-issue-runner suite: its generated files match cases.ts, and every
// case has what it loads. Importing cases.ts here also brings it under tsc.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SUITE } from '../../../.claude/skills/escuadra-issue-runner/evals/cases.ts';
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
});
