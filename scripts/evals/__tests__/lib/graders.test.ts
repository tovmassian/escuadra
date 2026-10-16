import { describe, expect, it } from 'vitest';
import { gradersFor, type Triage } from '../../lib/graders.ts';
import { fieldPattern, TRIAGE_TEMPLATE } from '../../lib/triage.ts';
import type { YamlMap } from '../../lib/yaml.ts';

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

describe('gradersFor a triage', () => {
  it('passes a block that meets every expectation', () => {
    for (const grader of regexes(gradersFor(proceed))) {
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
    for (const grader of regexes(gradersFor(other))) {
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
    for (const grader of regexes(gradersFor(exact))) expect(passes(grader, block)).toBe(true);
  });

  it('weighs the decision and writing above the slug', () => {
    const graders = gradersFor(proceed);
    const weight = (name: string) => graders.find((g) => g.name === name)?.weight;
    expect(weight('decision')).toBe(3);
    expect(weight('no-writes')).toBe(3);
    expect(weight('branch')).toBe(1);
  });

  it('checks gh.log for writes, and judges questions with an LLM', () => {
    const graders = gradersFor({ kind: 'triage', decision: 'ask', questions: 'it asks X.' });
    expect(graders.find((g) => g.name === 'no-writes')).toMatchObject({
      target: { source: 'file', path: '.git/sandbox/gh.log' },
      match: 'not_contains',
    });
    expect(graders.find((g) => g.name === 'questions')).toMatchObject({ type: 'llm', weight: 2 });
  });
});

describe('gradersFor a negative case', () => {
  it('expects no triage block and an answer', () => {
    const names = gradersFor({ kind: 'no-triage', answered: 'It answers.' }).map((g) => g.name);
    expect(names).toEqual(['no-triage', 'answered', 'no-writes']);
  });
});

describe('fieldPattern', () => {
  it('does not take a longer value for the one expected', () => {
    expect(new RegExp(fieldPattern('base', 'main'), 'm').test('base: main-next')).toBe(false);
    expect(new RegExp(fieldPattern('base', 'release/1.0'), 'm').test('base: release/1.0.0')).toBe(
      false,
    );
  });

  it('matches the template it is written against', () => {
    expect(TRIAGE_TEMPLATE).toMatch(/^```triage\n/);
    expect(TRIAGE_TEMPLATE).toMatch(/\n```$/);
  });
});
