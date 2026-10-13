// Photo POC: dev-only Wikimedia photos in the question hero. Pure — the gate
// takes its inputs rather than reading `__DEV__`, which does not exist in
// Vitest's Node environment; lib/photoPocRuntime.ts supplies them, as
// lib/telemetry.ts does for lib/telemetryEvents.ts. Spec:
// docs/superpowers/specs/2026-10-13-wikimedia-photo-poc-design.md.
import photosData from '@/data/poc/photos.esp.json';
import type { QuestionResult } from '@/stores/session';
import type { PhotoCredit, PhotoFile } from '@/types/photo';

const photos = photosData as PhotoFile;

/** On only in a development build started with EXPO_PUBLIC_PHOTO_POC=1, so a
 *  production binary or OTA update can never show a photo. */
export function photoPocGate(env: { isDev: boolean; flag: string | undefined }): boolean {
  return env.isDev && env.flag === '1';
}

export function getPhoto(playerId: string, enabled: boolean): PhotoCredit | null {
  if (!enabled) return null;
  return photos[playerId] ?? null;
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
