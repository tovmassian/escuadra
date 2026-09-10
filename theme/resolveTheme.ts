import type { ThemeName, ThemePreference } from './tokens';

/** Structurally react-native's `ColorSchemeName`, restated rather than
 *  imported so this module stays loadable under Vitest's node environment.
 *  `'unspecified'` and `null` both mean the device did not answer. */
export type SystemScheme = ThemeName | 'unspecified' | null | undefined;

// Deliberately free of React and react-native so it stays unit-testable —
// Vitest runs in a node environment and cannot load react-native. The hooks
// that wrap this live in ./useTheme.ts.
export function resolveThemeName(
  preference: ThemePreference,
  systemScheme: SystemScheme,
): ThemeName {
  if (preference !== 'system') return preference;
  if (systemScheme === 'light' || systemScheme === 'dark') return systemScheme;
  return 'dark';
}
