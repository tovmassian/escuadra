// Static-data accessor + join layer. Squad JSON is imported directly (never
// held in a store, per CLAUDE.md) and joined against players.json here.
//
// Metro requires string-literal imports — no `require(`./squads/${id}.json`)`.
// Adding a squad means one import line + one SQUAD_FILES entry below. Fine at
// this scale (a handful of squads); a codegen step would be worth it well
// beyond that.
import indexData from '@/data/index.json';
import playersData from '@/data/players.json';
import squadArg from '@/data/squads/arg.json';
import squadArm from '@/data/squads/arm.json';
import squadArs from '@/data/squads/ars.json';
import squadBar from '@/data/squads/bar.json';
import squadBra from '@/data/squads/bra.json';
import squadEsp from '@/data/squads/esp.json';
import squadFra from '@/data/squads/fra.json';
import squadInt from '@/data/squads/int.json';
import squadJpn from '@/data/squads/jpn.json';
import squadPsg from '@/data/squads/psg.json';
import squadRma from '@/data/squads/rma.json';
import type { Player, RosterEntry, Squad, SquadManifestEntry } from '@/types/squad';

export { getAge } from './age';

const SQUAD_FILES: Record<string, Squad> = {
  ars: squadArs as Squad,
  arm: squadArm as Squad,
  rma: squadRma as Squad,
  bar: squadBar as Squad,
  int: squadInt as Squad,
  psg: squadPsg as Squad,
  bra: squadBra as Squad,
  arg: squadArg as Squad,
  esp: squadEsp as Squad,
  fra: squadFra as Squad,
  jpn: squadJpn as Squad,
};

const players = new Map<string, Player>((playersData as Player[]).map((p) => [p.id, p]));

export function listSquads(): SquadManifestEntry[] {
  return indexData as SquadManifestEntry[];
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
