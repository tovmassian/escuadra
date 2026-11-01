// Writes each case's case.yaml, scaffold.sh and setup.json from a suite's cases.ts (spec §9):
// `node scripts/evals/gen-cases.ts` for every suite, or `… gen-cases.ts --suite <skill>` for one. Never
// edit the generated files; the suite-in-sync test fails when they drift from cases.ts.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { renderSuite, staleCaseDirs, suiteNames, suitePath } from './lib/suite.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const names = suiteNames(root);
const { values } = parseArgs({ options: { suite: { type: 'string' } } });
const skills = values.suite === undefined ? names : [values.suite];

for (const skill of skills) {
  const evalsDir = join(root, suitePath(skill, names), 'evals');
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
}
