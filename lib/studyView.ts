// Pure Study-screen filtering. Kept out of the screen so it is unit-testable.
import type { Position, RosterEntry } from '@/types/squad';

/**
 * The `?players=` route param as a list of ids, or null when absent.
 *
 * An empty or whitespace-only param yields null rather than an empty list:
 * a malformed link should show the full squad, not an empty screen.
 */
export function parsePlayerIds(param: string | undefined): string[] | null {
  if (param === undefined) return null;
  const ids = param
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
  return ids.length > 0 ? ids : null;
}

/** Rows to show, always in shirt-number order. */
export function studyRows(
  roster: RosterEntry[],
  positionFilter: 'ALL' | Position,
  playerIds: string[] | null,
): RosterEntry[] {
  const wanted = playerIds === null ? null : new Set(playerIds);
  return roster
    .filter((r) => (wanted === null ? true : wanted.has(r.player.id)))
    .filter((r) => positionFilter === 'ALL' || r.player.position === positionFilter)
    .sort((a, b) => a.member.no - b.member.no);
}
