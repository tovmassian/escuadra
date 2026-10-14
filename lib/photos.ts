// Player photos: Wikimedia Commons thumbnails, hotlinked, credited from
// `player.photo` (written by `squadctl enrich`). Each photo load sends the
// user's IP to Wikimedia, which is why the privacy disclosures name it
// (guardrail 4). Spec: docs/superpowers/specs/2026-10-13-wikimedia-photo-poc-design.md.
import type { QuestionResult } from '@/stores/session';
import type { PhotoCredit, Player } from '@/types/squad';

export function photoFor(player: Player | undefined): PhotoCredit | null {
  return player?.photo ?? null;
}

export interface PhotoCreditRow {
  playerId: string;
  memberNo: number;
  playerName: string;
  credit: PhotoCredit;
}

/** One row per question in the round that showed a photo, in round order —
 *  the results screen's credit list. */
export function photoCreditRows(
  results: readonly QuestionResult[],
  lookup: (playerId: string) => PhotoCredit | null,
): PhotoCreditRow[] {
  return results.flatMap(({ question }) => {
    const credit = lookup(question.playerId);
    return credit === null
      ? []
      : [
          {
            playerId: question.playerId,
            memberNo: question.memberNo,
            playerName: question.playerName,
            credit,
          },
        ];
  });
}
