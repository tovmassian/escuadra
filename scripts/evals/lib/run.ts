// The arguments and environment for `claude plugin eval` (spec §9). The
// defaults that matter are pinned by a test: the scaffold runs, the report
// stays local, results land outside the repo, and the fake gh comes first on
// PATH through relative entries that resolve inside each run's sandbox.
import { join } from 'node:path';
import { GRADED_TAG } from './cases.ts';

export interface RunOptions {
  /** The skill folder under test, relative to the repo root. */
  target: string;
  outDir: string;
  tags: string[];
  caseGlob?: string;
  /** No tag or case filter: every case. */
  full: boolean;
  runs?: number;
  model: string;
  judgeModel: string;
  ablation?: 'with-without' | 'none';
  maxCostUsd: number;
  concurrency?: number;
  threshold: number;
  /** Keep each run's directory, and so its trace. */
  keep: boolean;
}

/**
 * The sandbox's bin, relative to the agent's directory and to the two above it, so the fake gh
 * and the git wrapper stay first on PATH after a `cd docs` or `cd docs/superpowers`.
 */
export const SANDBOX_BIN_ENTRIES = [
  '.git/sandbox/bin',
  '../.git/sandbox/bin',
  '../../.git/sandbox/bin',
];

export function evalArgs(o: RunOptions): string[] {
  if (!o.full && o.tags.length === 0 && o.caseGlob === undefined) {
    throw new Error(
      'Pick a slice with --tag <tag> or --case <glob>, or pass --full for every case.',
    );
  }
  const args = [
    'plugin',
    'eval',
    o.target,
    '--scaffold',
    '--trust-plugin',
    '--allow-tools',
    'Bash',
    '--no-publish',
    '--model',
    o.model,
    '--judge-model',
    o.judgeModel,
    '--threshold',
    String(o.threshold),
    '--max-cost-usd',
    String(o.maxCostUsd),
    '--output-dir',
    o.outDir,
    '--report',
    join(o.outDir, 'report.html'),
    '--json',
    join(o.outDir, 'result.json'),
  ];
  for (const tag of o.full ? [...o.tags, GRADED_TAG] : o.tags) args.push('--tag', tag);
  if (o.caseGlob !== undefined) args.push('--case', o.caseGlob);
  if (o.runs !== undefined) args.push('--runs', String(o.runs));
  if (o.ablation !== undefined) args.push('--ablation', o.ablation);
  if (o.concurrency !== undefined) args.push('--concurrency', String(o.concurrency));
  if (o.keep) args.push('--keep-temp');
  return args;
}

/**
 * A flag's number, or an error naming the flag: finite, above zero and at most `max`, and whole
 * when `integer`.
 */
export function parseNumber(flag: string, value: string, integer = false, max = Infinity): number {
  const number = Number(value);
  if (
    !Number.isFinite(number) ||
    number <= 0 ||
    number > max ||
    (integer && !Number.isInteger(number))
  ) {
    const bound = Number.isFinite(max) ? ` and at most ${max}` : '';
    throw new Error(
      `--${flag} must be a ${integer ? 'whole ' : ''}number above 0${bound}, not "${value}"`,
    );
  }
  return number;
}

export function evalEnv<E extends Readonly<Record<string, string | undefined>>>(
  env: E,
): E & { PATH: string } {
  const bins = SANDBOX_BIN_ENTRIES.join(':');
  return { ...env, PATH: env.PATH ? `${bins}:${env.PATH}` : bins };
}
