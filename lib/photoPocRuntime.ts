// Reads the build environment into lib/photoPoc.ts's pure gate. Kept apart so
// Vitest never evaluates `__DEV__`. `process.env.EXPO_PUBLIC_PHOTO_POC` must
// stay written out in full: Expo inlines EXPO_PUBLIC_ variables by name at
// bundle time.
import { photoPocGate } from '@/lib/photoPoc';

export const PHOTO_POC_ENABLED = photoPocGate({
  isDev: __DEV__,
  flag: process.env.EXPO_PUBLIC_PHOTO_POC,
});
