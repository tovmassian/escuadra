import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Crypto from 'expo-crypto';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { track } from '@/lib/telemetry';
import { useProgress, useProgressHydrated } from '@/stores/progress';
import { fontAssets } from '@/theme/fonts';
import { useThemeColors, useThemeName } from '@/theme/useTheme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const hydrated = useProgressHydrated();
  const themeName = useThemeName();
  const colors = useThemeColors();

  // Hold the splash until the type is ready, otherwise the first frame renders
  // in the system font and visibly reflows — and until the persisted
  // preference is back, otherwise someone pinned to light gets a dark frame
  // that flips on every launch.
  const ready = (fontsLoaded || fontError) && hydrated;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  // The install ID can only be created once persisted state is back — before
  // that, a stored ID is indistinguishable from none. `setInstallId` is a
  // no-op when one already exists. Then one launch signal per JS launch.
  useEffect(() => {
    if (!hydrated) return;
    useProgress.getState().setInstallId(Crypto.randomUUID());
    track('app.launched');
  }, [hydrated]);

  if (!ready) return null;

  const isDark = themeName === 'dark';
  const base = isDark ? DarkTheme : DefaultTheme;
  const navTheme: Theme = {
    ...base,
    dark: isDark,
    colors: {
      ...base.colors,
      primary: colors.accent,
      background: colors.background,
      card: colors.surface,
      text: colors.textPrimary,
      border: colors.border,
      notification: colors.error,
    },
  };

  return (
    <SafeAreaProvider>
      <ThemeProvider value={navTheme}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        />
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
