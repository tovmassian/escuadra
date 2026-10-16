// Writes each case's case.yaml, scaffold.sh and setup.json from a suite's
// cases.ts (spec §9): `node scripts/evals/gen-cases.ts [evals dir]`. Never edit
// the generated files; the suite test fails when they drift from cases.ts.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderSuite, staleCaseDirs } from './lib/suite.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const evalsDir = resolve(root, process.argv[2] ?? '.claude/skills/escuadra-issue-runner/evals');

const files = await renderSuite(evalsDir);
for (const name of staleCaseDirs(evalsDir, files)) {
  rmSync(join(evalsDir, name), { recursive: true });
}
for (const file of files) {
  const target = join(evalsDir, file.path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, file.content);
}
const cases = new Set(files.map((file) => file.path.split('/')[0])).size;
process.stdout.write(`gen-cases: wrote ${cases} cases to ${relative(root, evalsDir)}\n`);
