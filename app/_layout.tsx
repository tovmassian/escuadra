import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Crypto from 'expo-crypto';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { introWillShow, LaunchIntro } from '@/components/LaunchIntro';
import { LaunchRevealProvider, useLaunchRevealState } from '@/components/LaunchReveal';
import { launchLanguage } from '@/i18n/useT';
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
  const [introDone, setIntroDone] = useState(false);
  // The intro's hand-off to Home (#182): Home rests at once when the intro
  // will not show this launch, and waits for its dock when it will.
  const [revealed] = useState(() => !introWillShow());
  const launchReveal = useLaunchRevealState(revealed);
  // However the intro ends (its dock, a fade, or at once for a screen reader),
  // Home is at rest once it has gone.
  const endIntro = () => {
    launchReveal.reveal.set(1);
    setIntroDone(true);
  };

  // Hold the splash until the type is ready, otherwise the first frame renders
  // in the system font and visibly reflows — and until the persisted
  // preference is back, otherwise someone pinned to light gets a dark frame
  // that flips on every launch. The launch intro (#182) mounts with the stack,
  // when the splash hides, so it never starts before the theme and fonts are known.
  const ready = (fontsLoaded || fontError) && hydrated;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  // The install ID can only be created once persisted state is back — before
  // that, a stored ID is indistinguishable from none. `setInstallId` is a
  // no-op when one already exists. Then one launch signal per JS launch, with
  // the language as resolved now that the preference is back.
  useEffect(() => {
    if (!hydrated) return;
    useProgress.getState().setInstallId(Crypto.randomUUID());
    track('app.launched', launchLanguage());
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
        <LaunchRevealProvider value={launchReveal}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
            }}
          />
          {!introDone && <LaunchIntro onDone={endIntro} />}
        </LaunchRevealProvider>
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
