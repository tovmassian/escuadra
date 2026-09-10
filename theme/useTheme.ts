import { useColorScheme } from 'react-native';
import { useProgress } from '@/stores/progress';
import { resolveThemeName } from './resolveTheme';
import { palettes, type Palette, type ThemeName } from './tokens';

/** The resolved theme. Needed directly only where the *name* matters — the
 *  navigation theme, the status bar, the toggle's glyph. */
export function useThemeName(): ThemeName {
  const preference = useProgress((s) => s.themePreference);
  const systemScheme = useColorScheme();
  return resolveThemeName(preference, systemScheme);
}

/** The active palette. The hook every styled component uses. */
export function useThemeColors(): Palette {
  return palettes[useThemeName()];
}
