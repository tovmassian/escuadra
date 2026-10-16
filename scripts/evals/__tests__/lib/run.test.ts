import { describe, expect, it } from 'vitest';
import { evalArgs, evalEnv, parseNumber, type RunOptions } from '../../lib/run.ts';

const BASE: RunOptions = {
  target: '.claude/skills/escuadra-issue-runner',
  outDir: '/tmp/out',
  tags: ['core'],
  model: 'sonnet',
  judgeModel: 'opus',
  maxCostUsd: 15,
  threshold: 0.8,
  keep: false,
  full: false,
};

describe('evalArgs', () => {
  it('runs the scaffold, keeps the report local, and writes results outside the repo', () => {
    expect(evalArgs(BASE)).toEqual([
      'plugin',
      'eval',
      '.claude/skills/escuadra-issue-runner',
      '--scaffold',
      '--trust-plugin',
      '--allow-tools',
      'Bash',
      '--no-publish',
      '--model',
      'sonnet',
      '--judge-model',
      'opus',
      '--threshold',
      '0.8',
      '--max-cost-usd',
      '15',
      '--output-dir',
      '/tmp/out',
      '--report',
      '/tmp/out/report.html',
      '--json',
      '/tmp/out/result.json',
      '--tag',
      'core',
    ]);
  });

  it('passes the optional knobs through', () => {
    const args = evalArgs({
      ...BASE,
      tags: [],
      caseGlob: '129-*',
      runs: 1,
      ablation: 'none',
      concurrency: 2,
      keep: true,
    });
    expect(args.slice(-9)).toEqual([
      '--case',
      '129-*',
      '--runs',
      '1',
      '--ablation',
      'none',
      '--concurrency',
      '2',
      '--keep-temp',
    ]);
  });

  it('refuses to run the whole suite unless asked to', () => {
    expect(() => evalArgs({ ...BASE, tags: [] })).toThrow(/--full/);
    expect(evalArgs({ ...BASE, tags: [], full: true })).not.toContain('--tag');
  });
});

describe('parseNumber', () => {
  it('reads a whole number', () => {
    expect(parseNumber('runs', '3', true)).toBe(3);
  });

  it.each(['abc', '0', '-1', 'Infinity'])('refuses %s', (value) => {
    expect(() => parseNumber('runs', value)).toThrow(/--runs/);
  });

  it('refuses a fraction where a whole number is needed', () => {
    expect(() => parseNumber('runs', '1.5', true)).toThrow(/whole number/);
  });

  it('names the flag in the message', () => {
    expect(() => parseNumber('max-cost-usd', 'abc')).toThrow(/--max-cost-usd/);
  });
});

describe('evalEnv', () => {
  it('puts the sandbox bin first on PATH, as a relative entry', () => {
    expect(evalEnv({ PATH: '/usr/bin' }).PATH).toBe('.git/sandbox/bin:/usr/bin');
  });

  it('leaves no empty entry when PATH is unset', () => {
    expect(evalEnv({}).PATH).toBe('.git/sandbox/bin');
  });
});
