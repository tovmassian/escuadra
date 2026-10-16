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
  /** Null for a Study row whose member Wikipedia lists without a shirt number. */
  memberNo: number | null;
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

/**
 * Every photo a round will show, once each, in question order. The screen
 * prefetches them all when the round starts (spec §9), so a question never
 * waits on its photo. A player with no photo, or not found, is skipped.
 */
export function roundPhotoUrls(
  questions: readonly { playerId: string }[],
  playerById: (id: string) => Player | undefined,
): string[] {
  const urls: string[] = [];
  for (const { playerId } of questions) {
    const url = photoFor(playerById(playerId))?.url;
    if (url !== undefined && !urls.includes(url)) urls.push(url);
  }
  return urls;
}
