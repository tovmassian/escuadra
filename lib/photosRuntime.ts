// Reads the build environment into lib/photos.ts's pure gate. Kept apart so
// Vitest never evaluates `__DEV__`. `process.env.EXPO_PUBLIC_PHOTOS` must
// stay written out in full: Expo inlines EXPO_PUBLIC_ variables by name at
// bundle time.
import { photosGate } from '@/lib/photos';

export const PHOTOS_ENABLED = photosGate({
  isDev: __DEV__,
  flag: process.env.EXPO_PUBLIC_PHOTOS,
});
