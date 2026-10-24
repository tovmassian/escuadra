import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Crypto from 'expo-crypto';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { introWillShow, LaunchIntro } from '@/components/LaunchIntro';
import { LaunchRevealProvider, useLaunchRevealState } from '@/components/LaunchReveal';
import { launchLanguage } from '@/i18n/useT';
import { screenOrientation } from '@/lib/screenOrientation';
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
  const window = useWindowDimensions();

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
        <Launch>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
              // Phones in portrait, large screens free to rotate (#203).
              orientation: screenOrientation(window),
            }}
          />
        </Launch>
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

// The launch intro (#182) over the stack, and its hand-off to Home. Mounted
// only once the app is ready, with the stack, so whether Home starts at rest
// is decided at the same moment as the intro's plan, with the same screen
// reader answer: at rest whenever the intro will not show.
function Launch({ children }: { children: ReactNode }) {
  const [introDone, setIntroDone] = useState(false);
  const [revealed] = useState(() => !introWillShow());
  const launchReveal = useLaunchRevealState(revealed);
  // However the intro ends (its dock, a fade, or at once for a screen reader),
  // Home is at rest once it has gone.
  const endIntro = () => {
    launchReveal.reveal.set(1);
    setIntroDone(true);
  };

  return (
    <LaunchRevealProvider value={launchReveal}>
      {children}
      {!introDone && <LaunchIntro onDone={endIntro} />}
    </LaunchRevealProvider>
  );
}
