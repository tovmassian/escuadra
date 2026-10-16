// A case's scaffold (spec §5). Each generated <case>/scaffold.sh runs
// `node scripts/evals/scaffold.ts <case dir>` in the run's working directory,
// and this builds the sandbox there from the case's setup.json. Errors go to
// stderr, which the eval runner shows as "scaffold failed".
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSandbox, realGitBinary, type SandboxSetup } from './lib/sandbox.ts';

const here = dirname(fileURLToPath(import.meta.url));
const caseDir = process.argv[2];
const tmpDir = process.env.TMPDIR;
if (caseDir === undefined) throw new Error('usage: node scripts/evals/scaffold.ts <case dir>');
if (tmpDir === undefined) throw new Error('scaffold: TMPDIR is not set');

buildSandbox({
  sourceRepo: resolve(here, '../..'),
  workDir: process.cwd(),
  tmpDir,
  fixturesDir: join(caseDir, '..', '_fixtures'),
  ghDir: join(here, 'sandbox'),
  realGit: realGitBinary(),
  setup: JSON.parse(readFileSync(join(caseDir, 'setup.json'), 'utf8')) as SandboxSetup,
});
