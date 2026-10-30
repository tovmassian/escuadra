// Pure Study-screen model (spec §5.1): which players show and in what order,
// the filter pills' counts, the header's count, each player's affiliation
// line, what a screen reader hears, and the photo credits. Kept out of the
// screen so it is unit-testable.

import { nationalityName } from '@/i18n/displayNames';
import type { Messages } from '@/i18n/en';
import type { SupportedLanguage } from '@/i18n/resolveLanguage';
import { photoFor, type PhotoCreditRow } from '@/lib/photos';
import { positionLabel } from '@/lib/roundView';
import type { Player, Position, RosterEntry, Squad } from '@/types/squad';

export type StudyFilter = 'ALL' | Position;
export const STUDY_FILTERS: readonly StudyFilter[] = ['ALL', 'GK', 'DF', 'MF', 'FW'];

/** Cards in two columns, or a compact list. Persisted in `stores/progress.ts`. */
export type StudyView = 'grid' | 'list';

/** Rows to show, always in shirt-number order. */
export function studyRows(roster: RosterEntry[], filter: StudyFilter): RosterEntry[] {
  return roster
    .filter((r) => filter === 'ALL' || r.player.position === filter)
    .sort((a, b) => (a.member.no ?? Infinity) - (b.member.no ?? Infinity));
}

/** Each pill's count, over the whole squad. */
export function filterCounts(roster: RosterEntry[]): Record<StudyFilter, number> {
  const counts: Record<StudyFilter, number> = { ALL: roster.length, GK: 0, DF: 0, MF: 0, FW: 0 };
  for (const r of roster) counts[r.player.position] += 1;
  return counts;
}

/** The header's count: "26 players" unfiltered, "9 of 26" filtered. */
export function studyCount(
  shown: number,
  total: number,
  filter: StudyFilter,
  messages: Messages,
): string {
  if (filter !== 'ALL') return messages.study.shownOf(shown, total);
  return messages.study.players(total);
}

/** The line under a name: a club squad's players show their nationality
 *  (with its flag), a nation squad's their club. */
export function studyAffiliation(
  player: Player,
  kind: Squad['kind'],
  language: SupportedLanguage,
): string {
  return kind === 'club' ? nationalityName(player.nationality, language) : (player.club ?? '—');
}

/** What a screen reader hears for a player. With Hide names on, the name is
 *  never spoken; the rest is no spoiler. A member Wikipedia lists with no
 *  shirt number yet (`no` null) reads "no number". */
export function studyLabel(
  no: number | null,
  player: Player,
  affiliation: string,
  hidden: boolean,
  messages: Messages,
): string {
  const name = hidden ? messages.study.nameHidden : player.name;
  const position = positionLabel(player.position, messages);
  return `${no ?? messages.study.noNumber}, ${name}, ${position}, ${affiliation}`;
}

/** The credits for the photos in the list, in list order. While Hide names
 *  is on, Study shows them by shirt number only, so they never spoil it. */
export function studyCreditRows(rows: RosterEntry[]): PhotoCreditRow[] {
  return rows.flatMap((r) => {
    const credit = photoFor(r.player);
    return credit
      ? [{ playerId: r.player.id, memberNo: r.member.no, playerName: r.player.name, credit }]
      : [];
  });
}
