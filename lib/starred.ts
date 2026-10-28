// Your squads (#179): the teams a player stars on Difficulty, kept in the
// progress store newest first. Pure, so the store and the picker share it.
import type { SquadManifestEntry } from '@/types/squad';

/** Stars `squadId` at the front, or unstars it if it is already starred. */
export function toggleStarred(starred: readonly string[], squadId: string): string[] {
  return starred.includes(squadId) ? starred.filter((id) => id !== squadId) : [squadId, ...starred];
}

/** One tab's starred teams, newest first. A starred id that has left the data
 *  is dropped without a word. */
export function starredOfKind(
  starred: readonly string[],
  squads: readonly SquadManifestEntry[],
  kind: 'club' | 'nation',
): SquadManifestEntry[] {
  const byId = new Map(squads.map((s) => [s.id, s]));
  return starred.flatMap((id) => {
    const squad = byId.get(id);
    return squad !== undefined && squad.kind === kind ? [squad] : [];
  });
}

/** The picker's first tab: the newest starred team's, so Your squads shows and
 *  How to play's second tip rings a team of the player's own (#187); Clubs with
 *  none. */
export function openingTab(
  starred: readonly string[],
  squads: readonly SquadManifestEntry[],
): 'club' | 'nation' {
  return starredTeams(starred, squads)[0]?.kind ?? 'club';
}

/** Every starred team, both kinds, newest first: Home's row of round buttons
 *  (#181). A starred id that has left the data is dropped, as above. */
export function starredTeams(
  starred: readonly string[],
  squads: readonly SquadManifestEntry[],
): SquadManifestEntry[] {
  const byId = new Map(squads.map((s) => [s.id, s]));
  return starred.flatMap((id) => {
    const squad = byId.get(id);
    return squad === undefined ? [] : [squad];
  });
}
