// Loads a suite's cases.ts and dry-run.md and renders its generated files,
// formatted. Shared by gen-cases.ts and the suite-in-sync test.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { caseFiles, type GeneratedFile, type Suite } from './cases.ts';
import { formatFor } from './format.ts';

const SCAFFOLD = fileURLToPath(new URL('../scaffold.ts', import.meta.url));

export async function renderSuite(evalsDir: string): Promise<GeneratedFile[]> {
  const { SUITE } = (await import(pathToFileURL(join(evalsDir, 'cases.ts')).href)) as {
    SUITE: Suite;
  };
  const dryRun = readFileSync(join(evalsDir, 'dry-run.md'), 'utf8');
  const files = SUITE.cases.flatMap((item) =>
    caseFiles(SUITE, item, dryRun, relative(join(evalsDir, item.name), SCAFFOLD)),
  );
  return Promise.all(
    files.map(async (file) => ({
      path: file.path,
      content: await formatFor(join(evalsDir, file.path), file.content),
    })),
  );
}

/** Case folders on disk that the suite no longer generates. */
export function staleCaseDirs(evalsDir: string, files: GeneratedFile[]): string[] {
  const live = new Set(files.map((file) => file.path.split('/')[0]));
  return readdirSync(evalsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
    .filter((entry) => !live.has(entry.name))
    .filter((entry) => existsSync(join(evalsDir, entry.name, 'case.yaml')))
    .map((entry) => entry.name);
}
