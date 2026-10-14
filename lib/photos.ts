// Player photos: Wikimedia Commons thumbnails, hotlinked, credited from
// `player.photo` (written by `squadctl enrich`). Each photo load sends the
// user's IP to Wikimedia, which is why the privacy disclosures name it
// (guardrail 4). Spec: docs/superpowers/specs/2026-10-13-wikimedia-photo-poc-design.md.
import { commonsFileUrl } from '@/scripts/commons';
import type { QuestionResult } from '@/stores/session';
import type { PhotoCredit, Player } from '@/types/squad';

export function photoFor(player: Player | undefined): PhotoCredit | null {
  return player?.photo ?? null;
}

export interface CreditLink {
  text: string;
  url: string;
}

/** What a photo's credit says, on every screen that shows one — the
 *  licence's obligation, so it is defined once: who took it (linking the
 *  Commons page, which names them in full, or "Wikimedia Commons" when no
 *  name could be read), the licence (linking its deed, else that page), and
 *  the change made to the photo (every screen crops it). */
export function creditParts(credit: PhotoCredit): {
  author: CreditLink;
  licence: CreditLink;
  change: string;
} {
  const page = commonsFileUrl(credit.file);
  return {
    author: { text: credit.author ?? 'Wikimedia Commons', url: page },
    licence: { text: credit.licence, url: credit.licenceUrl ?? page },
    change: 'cropped',
  };
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
