// The GitHub Actions side of the entry points: event payload, environment, step outputs
// and the job summary. Kept out of the flows so the flows stay testable.
import { appendFileSync, readFileSync } from 'node:fs';
import type { Outcome } from '../lib/outcome.ts';

// Read by name through an alias: expo/no-dynamic-env-var guards Metro's build-time
// inlining of process.env in app code, and nothing here is bundled.
const vars: Record<string, string | undefined> = process.env;

export function optionalEnv(name: string): string {
  return vars[name] ?? '';
}

export function env(name: string): string {
  const value = optionalEnv(name);
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export function readEvent<T>(): T {
  return JSON.parse(readFileSync(env('GITHUB_EVENT_PATH'), 'utf8')) as T;
}

/** Single-line values only: JSON, numbers, PR titles. */
export function setOutput(name: string, value: string): void {
  const file = process.env.GITHUB_OUTPUT;
  if (file) appendFileSync(file, `${name}=${value}\n`);
}

export function writeSummary(markdown: string): void {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (file) appendFileSync(file, `${markdown}\n`);
  process.stdout.write(`${markdown}\n`);
}

export function appJsonVersion(): string {
  return (JSON.parse(readFileSync('app.json', 'utf8')) as { expo: { version: string } }).expo
    .version;
}

export function runUrl(): string {
  return `${env('GITHUB_SERVER_URL')}/${env('GITHUB_REPOSITORY')}/actions/runs/${env('GITHUB_RUN_ID')}`;
}

/** Reports an outcome; only `failed` fails the job. */
export function finish(outcome: Outcome): void {
  writeSummary(outcome.summary);
  if (outcome.status === 'failed') process.exitCode = 1;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
