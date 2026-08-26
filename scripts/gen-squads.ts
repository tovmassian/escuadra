// GENERATED FILE producer — run via `npm run gen:squads`. Regenerates
// lib/squads.generated.ts and data/index.json from every file under
// data/squads/. See docs/superpowers/specs/2026-08-26-data-layer-scaling-design.md.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { format, resolveConfig } from 'prettier';
import type { League, Squad, SquadManifestEntry } from '../types/squad';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const SQUADS_DIR = path.join(REPO_ROOT, 'data', 'squads');
const GENERATED_TS_PATH = path.join(REPO_ROOT, 'lib', 'squads.generated.ts');
const INDEX_JSON_PATH = path.join(REPO_ROOT, 'data', 'index.json');

const LEAGUES: League[] = ['la-liga', 'serie-a', 'bundesliga', 'ligue-1', 'premier-league', 'ucl'];

function isLeague(value: string): value is League {
  return (LEAGUES as string[]).includes(value);
}

interface Discovered {
  id: string;
  kind: 'club' | 'nation';
  league?: League;
  relPath: string; // posix-style, relative to data/squads, e.g. "nation/esp.json"
  squad: Squad;
}

function discoverSquadFiles(): Discovered[] {
  const relFiles = (readdirSync(SQUADS_DIR, { recursive: true }) as string[])
    .map((f) => f.split(path.sep).join('/'))
    .filter((f) => f.endsWith('.json'));

  const discovered: Discovered[] = [];
  for (const relPath of relFiles) {
    const parts = relPath.split('/');
    let kind: 'club' | 'nation';
    let league: League | undefined;
    let fileName: string;

    if (parts.length === 2 && parts[0] === 'nation') {
      kind = 'nation';
      fileName = parts[1]!;
    } else if (parts.length === 3 && parts[0] === 'club' && isLeague(parts[1]!)) {
      kind = 'club';
      league = parts[1] as League;
      fileName = parts[2]!;
    } else {
      throw new Error(
        `gen-squads: unrecognized squad file path "data/squads/${relPath}". ` +
          `Expected "nation/<id>.json" or "club/<league>/<id>.json" with <league> one of: ${LEAGUES.join(', ')}.`,
      );
    }

    const id = fileName.replace(/\.json$/, '');
    const squad = JSON.parse(readFileSync(path.join(SQUADS_DIR, relPath), 'utf-8')) as Squad;

    if (squad.id !== id) {
      throw new Error(
        `gen-squads: data/squads/${relPath} has id "${squad.id}", but its filename implies "${id}".`,
      );
    }
    if (squad.kind !== kind) {
      throw new Error(
        `gen-squads: data/squads/${relPath} has kind "${squad.kind}", but its folder implies "${kind}".`,
      );
    }

    discovered.push({ id, kind, league, relPath, squad });
  }

  const seenIds = new Set<string>();
  for (const d of discovered) {
    if (seenIds.has(d.id)) {
      throw new Error(`gen-squads: duplicate squad id "${d.id}" across multiple files.`);
    }
    seenIds.add(d.id);
  }

  discovered.sort((a, b) => a.id.localeCompare(b.id));
  return discovered;
}

function toImportIdent(id: string): string {
  const camel = id.replace(/[-_]+(.)/g, (_match, ch: string) => ch.toUpperCase());
  return `squad${camel.charAt(0).toUpperCase()}${camel.slice(1)}`;
}

function buildGeneratedTs(discovered: Discovered[]): string {
  const seenIdents = new Set<string>();
  const importLines: string[] = [];
  const mapLines: string[] = [];

  for (const d of discovered) {
    const ident = toImportIdent(d.id);
    if (seenIdents.has(ident)) {
      throw new Error(
        `gen-squads: import identifier "${ident}" (derived from id "${d.id}") collides with another squad.`,
      );
    }
    seenIdents.add(ident);
    importLines.push(`import ${ident} from '@/data/squads/${d.relPath}';`);
    mapLines.push(`  ${d.id}: ${ident} as Squad,`);
  }

  return [
    '// GENERATED FILE — run `npm run gen:squads` to regenerate. Do not hand-edit.',
    "import type { Squad } from '@/types/squad';",
    ...importLines,
    '',
    'export const SQUAD_FILES: Record<string, Squad> = {',
    ...mapLines,
    '};',
    '',
  ].join('\n');
}

function buildIndexJson(discovered: Discovered[]): string {
  const entries: SquadManifestEntry[] = discovered.map((d) => {
    const entry: SquadManifestEntry = {
      id: d.squad.id,
      kind: d.squad.kind,
      name: d.squad.name,
      season: d.squad.season,
      primaryColor: d.squad.primaryColor,
      secondaryColor: d.squad.secondaryColor,
      verified: d.squad.verified,
      marker: d.squad.marker,
    };
    if (d.kind === 'club' && d.league) entry.league = d.league;
    return entry;
  });
  return JSON.stringify(entries, null, 2) + '\n';
}

// Formats `content` with prettier's programmatic API and writes the result
// to `filePath`. This avoids shelling out to the `npx`/`prettier` CLI
// entirely — no subprocess, no OS-specific spawn/quoting semantics, and no
// assumption about node_modules layout (flat/hoisted vs. nested). Passing
// `filepath` lets prettier infer the right parser per-file (TypeScript for
// lib/squads.generated.ts, JSON for data/index.json) instead of hardcoding
// one; `resolveConfig` picks up this repo's .prettierrc automatically so
// the style options aren't hand-duplicated here.
async function formatAndWrite(filePath: string, content: string): Promise<void> {
  const config = await resolveConfig(filePath);
  const formatted = await format(content, { ...config, filepath: filePath });
  writeFileSync(filePath, formatted);
}

async function main(): Promise<void> {
  const discovered = discoverSquadFiles();
  await formatAndWrite(GENERATED_TS_PATH, buildGeneratedTs(discovered));
  await formatAndWrite(INDEX_JSON_PATH, buildIndexJson(discovered));
  console.log(
    `gen-squads: wrote ${discovered.length} squads to lib/squads.generated.ts and data/index.json`,
  );
}

await main();
