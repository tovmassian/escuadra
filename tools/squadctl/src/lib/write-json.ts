// The single writer used by everything that puts a generated or synced file
// into the repo — scripts/gen-squads.ts and every squadctl command. Shared
// rather than duplicated so `npm run check`'s `prettier --check` and
// `git diff --exit-code` stay green no matter which path produced the file:
// two writers with drifting options is exactly how a no-op sweep starts
// churning the git diff.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { format, resolveConfig } from 'prettier';

// Formats `content` with prettier's programmatic API and writes the result
// to `filePath`. This avoids shelling out to the `npx`/`prettier` CLI
// entirely — no subprocess, no OS-specific spawn/quoting semantics, and no
// assumption about node_modules layout (flat/hoisted vs. nested). Passing
// `filepath` lets prettier infer the right parser per-file (TypeScript for
// lib/squads.generated.ts, JSON for data/index.json) instead of hardcoding
// one; `resolveConfig` picks up this repo's .prettierrc automatically so
// the style options aren't hand-duplicated here.
export async function formatAndWrite(filePath: string, content: string): Promise<void> {
  const config = await resolveConfig(filePath);
  const formatted = await format(content, { ...config, filepath: filePath });
  // The first club in a league writes into a folder that does not exist yet —
  // `data/squads/club/bundesliga/` is created by the team that needs it, not
  // checked in empty. Without this the first Bundesliga or UCL team fails with
  // ENOENT after a perfectly good fetch.
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, formatted);
}
