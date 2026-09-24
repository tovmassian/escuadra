// What a PR asks for and what it touches: platforms from `ota:*` labels (or a manual
// run's input), whether it changes anything the app bundles, and the guardrail-4 hints
// the gate prints. Pure; the flows fetch labels, files and package.json.
import { PLATFORMS, type Platform } from './release.ts';

export const OTA_LABELS: Record<Platform, string> = { ios: 'ota:ios', android: 'ota:android' };

/** The platforms a PR's labels ask to publish to, in PLATFORMS order. */
export function platformsFromLabels(labels: string[]): Platform[] {
  return PLATFORMS.filter((platform) => labels.includes(OTA_LABELS[platform]));
}

export function parsePlatform(value: string): Platform {
  if (value === 'ios' || value === 'android') return value;
  throw new Error(`platform must be ios or android, got "${value}"`);
}

/** The `platforms` input of a manual run: `ios`, `android` or `both`. */
export function platformsFromInput(value: string): Platform[] {
  return value === 'both' ? [...PLATFORMS] : [parsePlatform(value)];
}

// Files that never reach the app bundle. A PR touching only docs and CI has nothing to
// preview; the network hints skip every unbundled file.
const DOCS_OR_CI = [/^docs\//, /\.md$/, /^\.github\//, /^scripts\/ci\//];
const NOT_BUNDLED = [/^docs\//, /\.md$/, /^\.github\//, /^scripts\//, /^tools\//, /\.test\.tsx?$/];

export function isDocsOrCiOnly(files: string[]): boolean {
  return files.every((file) => DOCS_OR_CI.some((pattern) => pattern.test(file)));
}

export function isBundled(file: string): boolean {
  return !NOT_BUNDLED.some((pattern) => pattern.test(file));
}

export interface ChangedFile {
  filename: string;
  patch?: string | null;
}

export interface Finding {
  file: string;
  line: string;
}

const NETWORK_HINTS = [/\bfetch\(/, /XMLHttpRequest/, /\bWebSocket\b/, /sendBeacon/, /https?:\/\//];

/** Added lines in bundled files that look like they send something somewhere. */
export function networkFindings(files: ChangedFile[]): Finding[] {
  const findings: Finding[] = [];
  for (const file of files) {
    if (!file.patch || !isBundled(file.filename)) continue;
    for (const raw of file.patch.split('\n')) {
      if (!raw.startsWith('+') || raw.startsWith('+++')) continue;
      const line = raw.slice(1).trim();
      if (NETWORK_HINTS.some((hint) => hint.test(line)))
        findings.push({ file: file.filename, line });
    }
  }
  return findings;
}

type Dependencies = Record<string, string>;

function dependenciesOf(packageJson: string): Dependencies {
  return (JSON.parse(packageJson) as { dependencies?: Dependencies }).dependencies ?? {};
}

/** How `dependencies` changed between two package.json texts, one line per package. */
export function dependencyChanges(before: string, after: string): string[] {
  const was = dependenciesOf(before);
  const now = dependenciesOf(after);
  const names = [...new Set([...Object.keys(was), ...Object.keys(now)])].sort();
  const changes: string[] = [];
  for (const name of names) {
    const from = was[name];
    const to = now[name];
    if (from === to) continue;
    if (from === undefined) changes.push(`added ${name}@${to}`);
    else if (to === undefined) changes.push(`removed ${name}@${from}`);
    else changes.push(`${name} ${from} → ${to}`);
  }
  return changes;
}
