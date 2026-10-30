// The share hand-off (spec §4): captures the share card as a picture, or
// passes the text, to the phone's own share menu. The only module that imports
// `react-native-view-shot` and `expo-sharing`. Callers catch: a share menu
// that fails to open is not worth interrupting the results for.

import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import { Platform, Share, type ViewInstance } from 'react-native';
import { captureRef, releaseCapture } from 'react-native-view-shot';

// The last picture written to the cache. It is not deleted when the share menu
// resolves, because an Android target can still be reading it once the chooser
// returns; it goes when the next one is captured or the sheet closes.
let lastCapture: string | null = null;

/**
 * Captures `card` and opens the share menu with it. The caller lays the card
 * out at `shareCapture` pixels and it is captured at its native size, so both
 * platforms produce exactly 1,080 × 1,920 with no rescale (view-shot reads a
 * `width` option as points on iOS and as pixels on Android, so none is passed).
 * True once the menu has closed: Expo cannot tell whether the picture was
 * sent, so that is what `result.shared` counts for an image (spec §10.3).
 * `dialogTitle` is Android's share-dialog title, in the app's language.
 * False on web, where the button does nothing (spec §4.2), when the device
 * cannot share a file, or when `stillWanted` says the sheet closed during the
 * capture: the picture is then released and no menu opens.
 */
export async function shareImage(
  card: RefObject<ViewInstance | null>,
  dialogTitle: string,
  stillWanted: () => boolean,
): Promise<boolean> {
  if (Platform.OS === 'web' || !(await Sharing.isAvailableAsync())) return false;
  releaseShareImage();
  lastCapture = await captureRef(card, {
    format: 'png',
    quality: 1,
    result: 'tmpfile',
  });
  if (!stillWanted()) {
    releaseShareImage();
    return false;
  }
  await Sharing.shareAsync(lastCapture, {
    mimeType: 'image/png',
    UTI: 'public.png',
    dialogTitle,
  });
  return true;
}

/** Deletes the picture `shareImage` last captured: About says Escuadra keeps nothing you share. */
export function releaseShareImage(): void {
  if (Platform.OS === 'web' || lastCapture === null) return;
  releaseCapture(lastCapture);
  lastCapture = null;
}

/**
 * Opens the share menu with `message`. True only when the OS reports it was
 * sent, which is iOS only: on Android the chooser always resolves as shared.
 */
export async function shareText(message: string): Promise<boolean> {
  const outcome = await Share.share({ message });
  return outcome.action === Share.sharedAction;
}
