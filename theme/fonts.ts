// Maps the family names used in `theme/tokens.ts` onto the actual font assets.
// Loaded at runtime via `useFonts` because Expo Go cannot use the expo-font
// config plugin (that path requires a prebuild).
//
// Import from the per-weight subpath, never the package root. The root barrel
// `require()`s every weight and italic, and Metro cannot tree-shake those away
// — it costs ~6 MB of unused fonts in the bundle.
import { IBMPlexMono_600SemiBold } from '@expo-google-fonts/ibm-plex-mono/600SemiBold';
import { IBMPlexMono_700Bold } from '@expo-google-fonts/ibm-plex-mono/700Bold';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';

export const fontAssets = {
  'Inter-Medium': Inter_500Medium,
  'Inter-SemiBold': Inter_600SemiBold,
  'Inter-Bold': Inter_700Bold,
  'IBMPlexMono-SemiBold': IBMPlexMono_600SemiBold,
  'IBMPlexMono-Bold': IBMPlexMono_700Bold,
} as const;

export type FontFamily = keyof typeof fontAssets;
