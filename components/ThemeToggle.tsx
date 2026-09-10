import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useProgress } from '@/stores/progress';
import { borderWidths, durations, radii, sizes } from '@/theme/tokens';
import { useThemeColors, useThemeName } from '@/theme/useTheme';

const { trackWidth, trackHeight, thumb, inset } = sizes.themeToggle;
const TRAVEL = trackWidth - thumb - inset * 2;
const g = sizes.themeToggleGlyph;

// Tapping writes an explicit preference — there is deliberately no way back to
// 'system' from a two-state switch, and no Settings screen to put a third
// control on.
export function ThemeToggle() {
  const colors = useThemeColors();
  const isDark = useThemeName() === 'dark';
  const setThemePreference = useProgress((s) => s.setThemePreference);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: withTiming(isDark ? TRAVEL : 0, {
          duration: durations.toggle,
          easing: Easing.out(Easing.quad),
        }),
      },
    ],
  }));

  return (
    <Pressable
      testID="theme-toggle"
      onPress={() => setThemePreference(isDark ? 'light' : 'dark')}
      accessibilityRole="switch"
      accessibilityState={{ checked: isDark }}
      accessibilityLabel="Dark theme"
      style={[styles.track, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
    >
      <Animated.View style={[styles.thumb, { backgroundColor: colors.thumbBg }, thumbStyle]}>
        {isDark ? (
          <View style={[styles.moon, { backgroundColor: colors.thumbIcon }]}>
            <View style={[styles.moonCutout, { backgroundColor: colors.thumbBg }]} />
          </View>
        ) : (
          <View style={[styles.sunCore, { backgroundColor: colors.thumbIcon }]}>
            {(['top', 'bottom', 'left', 'right'] as const).map((side) => (
              <View
                key={side}
                style={[styles.sunRay, styles[side], { backgroundColor: colors.thumbIcon }]}
              />
            ))}
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

// Geometry only — every colour is applied inline from the active palette, so
// this stylesheet is theme-independent and stays at module scope.
const styles = StyleSheet.create({
  track: {
    width: trackWidth,
    height: trackHeight,
    borderRadius: radii.pill,
    borderWidth: borderWidths.hairline,
    padding: inset,
    justifyContent: 'center',
  },
  thumb: {
    width: thumb,
    height: thumb,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moon: {
    width: g.moon,
    height: g.moon,
    borderRadius: g.moon / 2,
    overflow: 'hidden',
  },
  moonCutout: {
    position: 'absolute',
    width: g.moonCutout,
    height: g.moonCutout,
    borderRadius: g.moonCutout / 2,
    top: g.moonCutoutTop,
    left: g.moonCutoutLeft,
  },
  sunCore: {
    width: g.sunCore,
    height: g.sunCore,
    borderRadius: g.sunCore / 2,
    position: 'relative',
  },
  sunRay: {
    position: 'absolute',
    width: g.sunRay,
    height: g.sunRay,
    borderRadius: g.sunRay / 2,
  },
  top: { top: -g.sunRayOffset, left: (g.sunCore - g.sunRay) / 2 },
  bottom: { bottom: -g.sunRayOffset, left: (g.sunCore - g.sunRay) / 2 },
  left: { left: -g.sunRayOffset, top: (g.sunCore - g.sunRay) / 2 },
  right: { right: -g.sunRayOffset, top: (g.sunCore - g.sunRay) / 2 },
});
