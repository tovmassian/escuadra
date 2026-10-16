// The share hand-off (spec §4): captures the share card as a picture, or
// passes the text, to the phone's own share menu. The only module that imports
// `react-native-view-shot` and `expo-sharing`. Callers catch: a share menu
// that fails to open is not worth interrupting the results for.

import { shareCapture } from '@/theme/tokens';
import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import { PixelRatio, Platform, Share, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

/**
 * Captures `card` at `shareCapture` pixels and opens the share menu with it.
 * True once the menu has closed: Expo cannot tell whether the picture was
 * sent, so that is what `result.shared` counts for an image (spec §10.3).
 * False on web, where the button does nothing (spec §4.2), or when the device
 * cannot share a file.
 */
export async function shareImage(card: RefObject<View | null>): Promise<boolean> {
  if (Platform.OS === 'web' || !(await Sharing.isAvailableAsync())) return false;
  const uri = await captureRef(card, {
    format: 'png',
    quality: 1,
    result: 'tmpfile',
    width: shareCapture.width / PixelRatio.get(),
    height: shareCapture.height / PixelRatio.get(),
  });
  await Sharing.shareAsync(uri, {
    mimeType: 'image/png',
    UTI: 'public.png',
    dialogTitle: 'Share your round',
  });
  return true;
}

/** Opens the share menu with `message`. True only when the OS reports it was sent. */
export async function shareText(message: string): Promise<boolean> {
  const outcome = await Share.share({ message });
  return outcome.action === Share.sharedAction;
}
