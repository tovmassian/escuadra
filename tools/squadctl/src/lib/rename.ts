// The human's half of a conflict. `possible-rename` and `name-variant` both
// mean "the source now spells this player differently" — squadctl refuses to
// guess which spelling wins, and this is how the answer comes back in.
//
// Renaming the stored record rather than accepting the new one is deliberate:
// the existing id is referenced by every squad file that carries this player,
// and §9 never rewrites an id.
import type { Player } from '../../../../types/squad.ts';

export interface RenameResult {
  players: Player[];
  before: string;
  after: string;
  /** True when `fullName` tracked `name` exactly and moved with it. A
   *  divergent fullName is real data and is left alone. */
  fullNameFollowed: boolean;
}

export function renamePlayer(
  players: readonly Player[],
  id: string,
  name: string,
): RenameResult | null {
  const target = players.find((p) => p.id === id);
  if (target === undefined) return null;

  const fullNameFollowed = target.fullName === target.name;
  const renamed: Player = {
    ...target,
    name,
    fullName: fullNameFollowed ? name : target.fullName,
  };

  return {
    players: players.map((p) => (p.id === id ? renamed : p)),
    before: target.name,
    after: name,
    fullNameFollowed,
  };
}
