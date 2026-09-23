// Test fixtures are real EAS output captured on 2026-09-23 and trimmed to the fields the
// pipeline reads — no artifact URLs in a public repo.
import { readFileSync } from 'node:fs';

export function fixture<T>(name: string): T {
  return JSON.parse(readFileSync(new URL(`./${name}`, import.meta.url), 'utf8')) as T;
}
