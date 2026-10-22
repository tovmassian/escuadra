// Static-data accessor + join layer. Squad JSON is imported directly (never
// held in a store, per .claude/rules/squad-data.md) and joined against
// players.json here.
//
// SQUAD_FILES comes from lib/squads.generated.ts, produced by
// `npm run gen:squads` from every file under data/squads/. Never hand-edit
// that file or data/index.json — see scripts/gen-squads.ts.
import indexData from '@/data/index.json';
import playersData from '@/data/players.json';
import { SQUAD_FILES } from './squads.generated';
import type { League, Player, RosterEntry, Squad, SquadManifestEntry } from '@/types/squad';

export { getAge } from './age';

const players = new Map<string, Player>((playersData as Player[]).map((p) => [p.id, p]));

export function listSquads(): SquadManifestEntry[] {
  return indexData as SquadManifestEntry[];
}

/** A club's league, from the picker's manifest; undefined for a nation. */
export function squadLeague(id: string): League | undefined {
  return listSquads().find((s) => s.id === id)?.league;
}

export function getSquad(id: string): Squad | undefined {
  return SQUAD_FILES[id];
}

export function getPlayer(id: string): Player | undefined {
  return players.get(id);
}

/** Joins a squad's members to their player records. Silently drops any
 *  member whose playerId doesn't resolve — a data-authoring bug caught by
 *  the Vitest data-integrity suite, not something a screen should crash on. */
export function getRoster(squadId: string): RosterEntry[] {
  const squad = getSquad(squadId);
  if (!squad) return [];
  const entries: RosterEntry[] = [];
  for (const member of squad.members) {
    const player = players.get(member.playerId);
    if (player) entries.push({ member, player });
  }
  return entries;
}
