import { describe, expect, it } from 'vitest';
import type { YamlMap } from '../../../../../scripts/evals/lib/yaml.ts';
import { gradeIssueRunner, type Triage } from '../graders.ts';
import { fieldPattern, TRIAGE_TEMPLATE } from '../triage.ts';

const BLOCK = [
  'I read the issue and the handoff.',
  '```triage',
  'issue: 126',
  'size: S (board; body says M)',
  'docs: docs/superpowers/handoff/2026-10-16-2-0-redesign-handoff.md',
  'existing: none',
  'decision: proceed',
  'questions: none',
  'execution: n/a',
  'workspace: in-place',
  'base: main',
  'branch: fix/126-photo-credits-sheet',
  'first-step: superpowers:systematic-debugging',
  '```',
].join('\n');

const regexes = (graders: YamlMap[]) =>
  graders.filter((g) => g.type === 'regex' && g.target === undefined);
const passes = (grader: YamlMap, text: string) =>
  new RegExp(String(grader.pattern), String(grader.flags ?? '')).test(text);

const proceed: Triage = {
  kind: 'triage',
  decision: 'proceed',
  workspace: 'in-place',
  base: 'main',
  branch: { prefix: 'fix/126-' },
  firstStep: 'systematic-debugging',
  execution: 'n/a',
  docs: ['docs/superpowers/handoff/2026-10-16-2-0-redesign-handoff.md'],
};

describe('gradeIssueRunner for a triage', () => {
  it('passes a block that meets every expectation', () => {
    for (const grader of regexes(gradeIssueRunner(proceed))) {
      expect(passes(grader, BLOCK), String(grader.name)).toBe(true);
    }
  });

  it('fails each field that decided differently', () => {
    const other: Triage = {
      kind: 'triage',
      decision: 'ask',
      workspace: 'worktree',
      base: 'release/1.0.0',
      branch: { prefix: 'feat/126-' },
      firstStep: 'brainstorming',
      execution: 'ask',
      docs: ['docs/superpowers/plans/2026-10-16-2-0-study.md'],
    };
    for (const grader of regexes(gradeIssueRunner(other))) {
      expect(passes(grader, BLOCK), String(grader.name)).toBe(false);
    }
  });

  it('accepts an exact branch name and a skill named without its prefix', () => {
    const exact: Triage = {
      kind: 'triage',
      decision: 'proceed',
      branch: { exact: 'fix/126-photo-credits-sheet' },
      firstStep: 'systematic-debugging',
    };
    const block = BLOCK.replace('superpowers:systematic-debugging', 'systematic-debugging');
    for (const grader of regexes(gradeIssueRunner(exact))) expect(passes(grader, block)).toBe(true);
  });

  it('weighs the decision above the slug', () => {
    const graders = gradeIssueRunner(proceed);
    const weight = (name: string) => graders.find((g) => g.name === name)?.weight;
    expect(weight('decision')).toBe(3);
    expect(weight('branch')).toBe(1);
  });

  it('lists the fields in the order case.yaml has them', () => {
    const all: Triage = {
      ...proceed,
      sizeEstimated: true,
      existing: ['#1'],
      questions: 'it asks X.',
    };
    expect(gradeIssueRunner(all).map((g) => g.name)).toEqual([
      'decision',
      'workspace',
      'base',
      'branch',
      'first-step',
      'execution',
      'size',
      'docs',
      'existing',
      'questions',
    ]);
  });

  it('judges questions with an LLM', () => {
    const graders = gradeIssueRunner({ kind: 'triage', decision: 'ask', questions: 'it asks X.' });
    expect(graders.find((g) => g.name === 'questions')).toMatchObject({ type: 'llm', weight: 2 });
  });
});

describe('gradeIssueRunner for a negative case', () => {
  it('expects no triage block and an answer', () => {
    const names = gradeIssueRunner({ kind: 'no-triage', answered: 'It answers.' }).map(
      (g) => g.name,
    );
    expect(names).toEqual(['no-triage', 'answered']);
  });
});

describe('fieldPattern', () => {
  it('does not take a longer value for the one expected', () => {
    expect(new RegExp(fieldPattern('base', 'main'), 'm').test('base: main-next')).toBe(false);
    expect(new RegExp(fieldPattern('base', 'release/1.0'), 'm').test('base: release/1.0.0')).toBe(
      false,
    );
  });

  it('lets a value end a sentence', () => {
    expect(new RegExp(fieldPattern('decision', 'ask'), 'm').test('decision: ask.')).toBe(true);
  });

  it('matches the template it is written against', () => {
    expect(TRIAGE_TEMPLATE).toMatch(/^```triage\n/);
    expect(TRIAGE_TEMPLATE).toMatch(/\n```$/);
  });
});

describe('anchoring and boundaries', () => {
  const named = (graders: YamlMap[], name: string): YamlMap => {
    const grader = graders.find((g) => g.name === name);
    if (!grader) throw new Error(`no grader named ${name}`);
    return grader;
  };
  const DOC = 'docs/superpowers/handoff/2026-10-16-2-0-redesign-handoff.md';

  it('docs passes only on the docs line, not a narrative mention or a longer name', () => {
    const docs = named(
      gradeIssueRunner({ kind: 'triage', decision: 'proceed', docs: [DOC] }),
      'docs',
    );
    expect(passes(docs, BLOCK)).toBe(true);

    const narrative = BLOCK.replace(`docs: ${DOC}`, 'docs: none').replace(
      'I read the issue and the handoff.',
      `I read ${DOC}.`,
    );
    expect(passes(docs, narrative)).toBe(false);

    const longer = BLOCK.replace(
      `docs: ${DOC}`,
      'docs: docs/superpowers/handoff/x-2026-10-16-2-0-redesign-handoff.md',
    );
    expect(passes(docs, longer)).toBe(false);
  });

  it('existing passes on the number and not a longer one', () => {
    const existing = named(
      gradeIssueRunner({ kind: 'triage', decision: 'proceed', existing: ['#9101'] }),
      'existing',
    );
    const withExisting = (line: string) => BLOCK.replace('existing: none', line);
    expect(
      passes(existing, withExisting('existing: open PR #9101 (fix/9008-progress-bar-last-step)')),
    ).toBe(true);
    expect(passes(existing, withExisting('existing: PR #91010'))).toBe(false);
    expect(passes(existing, withExisting('existing: open PR #9101.'))).toBe(true);
  });

  it('branch rejects a slash after the slug', () => {
    const branch = named(gradeIssueRunner(proceed), 'branch');
    const slashed = BLOCK.replace('branch: fix/126-photo-credits-sheet', 'branch: fix/126-foo/bar');
    expect(passes(branch, slashed)).toBe(false);
  });

  it('a field pattern does not match across a line break', () => {
    expect(new RegExp(fieldPattern('base', 'main'), 'm').test('base:\nmain')).toBe(false);
  });
});
