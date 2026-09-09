// GENERATED FILE producer — run via `npm run gen:flags`. Regenerates
// assets/flags/generated.ts from every PNG in assets/flags/.
//
// Metro cannot resolve require() with a computed path, so each flag needs a
// literal require. See docs/superpowers/specs/2026-09-09-png-flags-design.md.
import { readdirSync } from 'node:fs';
import path from 'node:path';
// Shared with gen-squads and squadctl so every generated file is written
// through identical prettier options — see that module's header for why
// `npm run check` depends on it.
import { formatAndWrite } from '../tools/squadctl/src/lib/write-json.ts';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const FLAGS_DIR = path.join(REPO_ROOT, 'assets', 'flags');
const GENERATED_TS_PATH = path.join(FLAGS_DIR, 'generated.ts');

const CODE_PATTERN = /^[A-Z]{3}$/;

function discoverFlagCodes(): string[] {
  const codes = readdirSync(FLAGS_DIR)
    .filter((f) => f.endsWith('.png'))
    .map((f) => f.replace(/\.png$/, ''));

  for (const code of codes) {
    if (!CODE_PATTERN.test(code)) {
      throw new Error(
        `gen-flags: "assets/flags/${code}.png" is not named by a three-letter uppercase ` +
          `FIFA code. Rename it, or remove it if it is not a flag.`,
      );
    }
  }
  if (codes.length === 0) throw new Error('gen-flags: no PNGs found in assets/flags/.');

  codes.sort();
  return codes;
}

function buildGeneratedTs(codes: string[]): string {
  return [
    '// GENERATED FILE — run `npm run gen:flags` to regenerate. Do not hand-edit.',
    "import type { ImageSourcePropType } from 'react-native';",
    '',
    '/** Every flag image committed to assets/flags/, by FIFA three-letter code. */',
    `export type FlagCode =`,
    ...codes.map((c, i) => `  | '${c}'${i === codes.length - 1 ? ';' : ''}`),
    '',
    'export const FLAG_SOURCES: Record<FlagCode, ImageSourcePropType> = {',
    ...codes.map((c) => `  ${c}: require('./${c}.png') as ImageSourcePropType,`),
    '};',
    '',
  ].join('\n');
}

async function main(): Promise<void> {
  const codes = discoverFlagCodes();
  await formatAndWrite(GENERATED_TS_PATH, buildGeneratedTs(codes));
  console.log(`gen-flags: wrote ${codes.length} flags to assets/flags/generated.ts`);
}

await main();
