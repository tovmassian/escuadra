// Player photos: Wikimedia Commons thumbnails, hotlinked, credited from
// `player.photo` (written by `squadctl enrich`). Pure — the gate takes its
// inputs rather than reading `__DEV__`, which does not exist in Vitest's Node
// environment; lib/photosRuntime.ts supplies them, as lib/telemetry.ts does
// for lib/telemetryEvents.ts. Spec:
// docs/superpowers/specs/2026-10-13-wikimedia-photo-poc-design.md.
import type { QuestionResult } from '@/stores/session';
import type { PhotoCredit, Player } from '@/types/squad';

/** On only in a development build started with EXPO_PUBLIC_PHOTOS=1, so a
 *  production binary or OTA update never loads a photo. Each photo load
 *  sends the user's IP to Wikimedia: turning this on for users ships with
 *  the privacy disclosures, in a store build (spec §8.5, guardrail 4). */
export function photosGate(env: { isDev: boolean; flag: string | undefined }): boolean {
  return env.isDev && env.flag === '1';
}

export function photoFor(player: Player | undefined, enabled: boolean): PhotoCredit | null {
  if (!enabled) return null;
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
