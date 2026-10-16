// Runs the eval suite (spec §9): `node scripts/evals/run.ts --tag core`,
// `--case '129-*'`, or `--full`. Every run draws on the owner's usage limits.
// Results and the HTML report go to a temporary directory, never the repo.
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { evalArgs, evalEnv } from './lib/run.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const { values } = parseArgs({
  options: {
    suite: { type: 'string', default: '.claude/skills/escuadra-issue-runner' },
    tag: { type: 'string', multiple: true, default: [] },
    case: { type: 'string' },
    full: { type: 'boolean', default: false },
    runs: { type: 'string' },
    model: { type: 'string', default: 'sonnet' },
    'judge-model': { type: 'string', default: 'opus' },
    ablation: { type: 'string' },
    'max-cost-usd': { type: 'string', default: '15' },
    concurrency: { type: 'string' },
    threshold: { type: 'string', default: '0.8' },
    keep: { type: 'boolean', default: false },
  },
});

const ablation = values.ablation;
if (ablation !== undefined && ablation !== 'with-without' && ablation !== 'none') {
  throw new Error(`--ablation must be with-without or none, not ${ablation}`);
}
const outDir = mkdtempSync(join(tmpdir(), 'escuadra-evals-'));
const args = evalArgs({
  target: values.suite,
  outDir,
  tags: values.tag,
  caseGlob: values.case,
  full: values.full,
  runs: values.runs === undefined ? undefined : Number(values.runs),
  model: values.model,
  judgeModel: values['judge-model'],
  ablation,
  maxCostUsd: Number(values['max-cost-usd']),
  concurrency: values.concurrency === undefined ? undefined : Number(values.concurrency),
  threshold: Number(values.threshold),
  keep: values.keep,
});
process.stdout.write(`Results and report: ${outDir}\n`);
const result = spawnSync('claude', args, {
  cwd: root,
  stdio: 'inherit',
  env: evalEnv(process.env),
});
process.exitCode = result.status ?? 1;
