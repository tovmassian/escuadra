// The squad files on disk, and what they say about players. `squadFiles` is
// the one walk of data/squads/ — apply, enrich and registry derive all use
// it — so a new league folder or a layout change is one edit.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { LEAGUES } from '../../../../scripts/roster-envelope.ts';
import type { League, Player, Squad } from '../../../../types/squad.ts';

export type SquadFile =
  { path: string; kind: 'nation' } | { path: string; kind: 'club'; league: League };

function jsonFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => path.join(dir, f));
}

/** Every squad file under `squadsDir`: `nation/*.json` first, then each
 *  `LEAGUES` folder under `club/` in that order, sorted within each. */
export function squadFiles(squadsDir: string): SquadFile[] {
  return [
    ...jsonFiles(path.join(squadsDir, 'nation')).map((file) => ({
      path: file,
      kind: 'nation' as const,
    })),
    ...LEAGUES.flatMap((league) =>
      jsonFiles(path.join(squadsDir, 'club', league)).map((file) => ({
        path: file,
        kind: 'club' as const,
        league,
      })),
    ),
  ];
}

export function readSquad(file: string): Squad {
  return JSON.parse(readFileSync(file, 'utf8')) as Squad;
}

/** The players a `--only` run looks up: every member of the named teams. */
export function playersInTeams(
  players: readonly Player[],
  squads: readonly Squad[],
  teamIds: readonly string[],
): Player[] {
  const wanted = new Set(
    squads.filter((s) => teamIds.includes(s.id)).flatMap((s) => s.members.map((m) => m.playerId)),
  );
  return players.filter((p) => wanted.has(p.id));
}

/** Each squad member's latest season, by its first year: a club's "2026/27"
 *  and a nation's "2026" are both 2026. */
export function seasonYears(squads: readonly Squad[]): Map<string, number> {
  const years = new Map<string, number>();
  for (const squad of squads) {
    const year = Number.parseInt(squad.season.slice(0, 4), 10);
    if (Number.isNaN(year)) continue;
    for (const { playerId } of squad.members) {
      years.set(playerId, Math.max(year, years.get(playerId) ?? year));
    }
  }
  return years;
}
