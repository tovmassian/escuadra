// Pure decision logic lifted out of `apply`'s run() — see
// tools/squadctl/src/commands/apply.ts for the I/O that drives these.
import path from 'node:path';
import type { RosterEnvelope } from '../../../../scripts/roster-envelope.ts';
import type { Player, Squad } from '../../../../types/squad.ts';
import type { Conflict } from './assertions.ts';

/** Merges reconciliation output into the stored players array: `updated`
 *  replaces a stored record by id, and `added` is applied last so it wins
 *  over an `updated` record sharing the same id. Neither input array is
 *  mutated. */
export function mergePlayers(
  players: readonly Player[],
  added: readonly Player[],
  updated: readonly Player[],
): Player[] {
  const byId = new Map(players.map((p) => [p.id, p]));
  for (const player of updated) byId.set(player.id, player);
  for (const player of added) byId.set(player.id, player);
  return [...byId.values()];
}

/** lastUpdated moves only when the rest of the file did, so a no-op sweep
 *  produces an empty git diff.
 *  Keyed on THIS file's content alone. Folding players.json edits in here
 *  meant one player's position correction rewrote the lastUpdated of every
 *  unrelated squad that happened to contain them.
 *
 *  The lastUpdated substitution is defensive rather than load-bearing at the
 *  one call site today: reconcileTeam already carries `stored.lastUpdated`
 *  onto `plan.squad`, so the two dates match before this is ever called.
 *  Kept because that is reconcile's invariant to break, not this function's
 *  to assume — and apply-plan.test.ts exercises the substitution directly. */
export function isFileUnchanged(candidate: Squad, stored: Squad | null): boolean {
  return (
    stored !== null &&
    JSON.stringify({ ...candidate, lastUpdated: stored.lastUpdated }) === JSON.stringify(stored)
  );
}

/** Whether the roster a player learns is the same: who is in it, with which
 *  number, and who captains. lastUpdated greys a best score as outdated
 *  (lib/bestScore.ts), so it moves only when this is false; `verified`, the
 *  colours and the member order teach nothing.
 *
 *  A member whose id changed is the same person when the number, full name
 *  and birth date all match. Inter's #31 in the first weekly sweep: Bisseck
 *  had a record per title his article had, and Inter's link moved to the
 *  other one. Both records stay; only the id in the squad changed. */
export function isRosterUnchanged(
  candidate: Squad,
  stored: Squad | null,
  playerOf: (id: string) => Player | undefined,
): boolean {
  if (stored === null || candidate.members.length !== stored.members.length) return false;
  const slot = (m: Squad['members'][number]) => `${m.no}|${m.captain === true}`;
  const samePerson = (a: string, b: string) => {
    const x = playerOf(a);
    const y = playerOf(b);
    return (
      x !== undefined &&
      y !== undefined &&
      x.birth !== null &&
      x.birth === y.birth &&
      x.fullName === y.fullName
    );
  };
  const left = [...stored.members];
  const unmatched = candidate.members.filter((member) => {
    const i = left.findIndex((s) => s.playerId === member.playerId && slot(s) === slot(member));
    if (i === -1) return true;
    left.splice(i, 1);
    return false;
  });
  return unmatched.every((member) => {
    const i = left.findIndex(
      (s) => slot(s) === slot(member) && samePerson(s.playerId, member.playerId),
    );
    if (i === -1) return false;
    left.splice(i, 1);
    return true;
  });
}

/** Conflicts outrank quietness: a team with an open question is never filed
 *  as `unchanged`, or the run exits 4 while the report says nothing is
 *  pending.
 *  `written` describes THIS squad file. Folding players.json edits in here
 *  reported teams as written whose file would not change at all. */
export function teamStatus({
  conflicts,
  fileUnchanged,
}: {
  conflicts: readonly Conflict[];
  fileUnchanged: boolean;
}): 'written' | 'unchanged' | 'conflicted' {
  return conflicts.length > 0 ? 'conflicted' : fileUnchanged ? 'unchanged' : 'written';
}

/** The nation/club path a squad file lives at under `data/squads/`. */
export function squadPath(dataDir: string, team: RosterEnvelope['team']): string {
  const base = path.join(dataDir, 'squads');
  return team.kind === 'nation'
    ? path.join(base, 'nation', `${team.id}.json`)
    : path.join(base, 'club', team.league ?? '', `${team.id}.json`);
}

/** The process exit code is the highest severity seen anywhere in the run:
 *  escalates, never de-escalates. */
export function worstExit(current: number, candidate: number): number {
  return Math.max(current, candidate);
}

/** Whether this team's reconciliation changed any player record — a new
 *  signing or a correction to an existing one. Feeds the `playersDirty` flag
 *  that `hasWritableChanges` checks: a team can dirty `players.json` while
 *  leaving its own squad file untouched. */
export function hasPlayerChanges(
  newPlayers: readonly Player[],
  updatedPlayers: readonly Player[],
): boolean {
  return newPlayers.length > 0 || updatedPlayers.length > 0;
}

/** Tracked separately from squad writes. Keying the whole write step on
 *  `squadWrites.length` meant a run that only corrected player fields —
 *  now the common case, since squad files hold nothing but memberships —
 *  silently discarded every change. */
export function hasWritableChanges(squadWriteCount: number, playersDirty: boolean): boolean {
  return squadWriteCount > 0 || playersDirty;
}
