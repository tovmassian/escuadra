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

export interface RetitleResult {
  players: Player[];
  /** Null when the record carried no title yet. */
  before: string | null;
  after: string;
}

/** Points a record at a different Wikipedia article title. One of the three
 *  answers to a `title-mismatch`: the person is the same and their article
 *  moved. Never touches `name` — that is `rename` — and never touches the id,
 *  which every squad file referencing this player depends on. */
export function retitlePlayer(
  players: readonly Player[],
  id: string,
  title: string,
): RetitleResult | null {
  const target = players.find((p) => p.id === id);
  if (target === undefined) return null;
  return {
    players: players.map((p) => (p.id === id ? { ...p, wikiTitle: title } : p)),
    before: target.wikiTitle,
    after: title,
  };
}
