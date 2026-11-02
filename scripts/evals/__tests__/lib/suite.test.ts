import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { suiteNames, suitePath } from '../../lib/suite.ts';

describe('suiteNames', () => {
  let root = '';
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('lists the skills with an evals/cases.ts, sorted, and no others', () => {
    root = mkdtempSync(join(tmpdir(), 'suites-'));
    for (const skill of ['b-skill', 'a-skill']) {
      mkdirSync(join(root, '.claude/skills', skill, 'evals'), { recursive: true });
      writeFileSync(join(root, '.claude/skills', skill, 'evals', 'cases.ts'), '');
    }
    mkdirSync(join(root, '.claude/skills', 'no-evals'), { recursive: true });
    expect(suiteNames(root)).toEqual(['a-skill', 'b-skill']);
  });

  it('finds none when there is no skills folder', () => {
    root = mkdtempSync(join(tmpdir(), 'suites-'));
    expect(suiteNames(root)).toEqual([]);
  });
});

describe('suitePath', () => {
  it("gives the skill's folder", () => {
    expect(suitePath('a-skill', ['a-skill'])).toBe('.claude/skills/a-skill');
  });

  it('asks for a suite, naming the ones there are, when none or an unknown one is given', () => {
    expect(() => suitePath(undefined, ['a-skill', 'b-skill'])).toThrow(
      'Pick a suite with --suite <skill>: a-skill, b-skill',
    );
    expect(() => suitePath('c-skill', ['a-skill'])).toThrow(
      'No eval suite for c-skill. Pick a suite with --suite <skill>: a-skill',
    );
  });
});
