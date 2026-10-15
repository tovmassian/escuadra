import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { bannerBands, photoLayout, stageVeil } from '@/lib/stageView';
import { durations, opacity, spotlightCues, stage } from '@/theme/tokens';
import { useThemeColors, useThemeName } from '@/theme/useTheme';
import type { PhotoCredit, TeamMarker } from '@/types/squad';

interface SpotlightStageProps {
  /** The stage's height: the top 68 % (72 % compact) of the window. */
  height: number;
  photo: PhotoCredit | null;
  marker: TeamMarker;
  /** A miss dims the photo 10 % (spec §6). */
  dimmed: boolean;
}

// The photo stage behind the question (spec §2.6), in layers, bottom to top:
// 1. The team's own colours, as the in-round banner's vertical bands, under
//    a veil strong enough for white text. They show while a photo loads,
//    when there is none, and offline. Never a flag image.
// 2. A diagonal shimmer while the photo loads.
// 3. The photo, cross-fading in: filled when served at least 720 px wide,
//    otherwise framed whole over its own darkened copy.
// 4. The miss dim.
// Decorative: hidden from screen readers. The credit is the footer's.
export function SpotlightStage({ height, photo, marker, dimmed }: SpotlightStageProps) {
  const colors = useThemeColors();
  const themeName = useThemeName();
  const reduced = useReducedMotion();
  const bands = bannerBands(marker);
  const veil = stageVeil(bands, themeName);
  const url = photo?.url ?? null;
  const [loaded, setLoaded] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const loading = url !== null && loaded !== url && failed !== url;
  const layout = photo ? photoLayout(photo) : null;

  const dim = useSharedValue(0);
  useEffect(() => {
    dim.value = dimmed
      ? withDelay(
          reduced ? 0 : spotlightCues.missDim,
          withTiming(stage.missDim, { duration: durations.reveal }),
        )
      : 0;
  }, [dimmed, reduced, dim]);
  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.value }));

  const styles = StyleSheet.create({
    stage: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height,
      overflow: 'hidden',
      backgroundColor: colors.background,
    },
    bands: { ...StyleSheet.absoluteFill, flexDirection: 'row' },
    veil: { ...StyleSheet.absoluteFill, backgroundColor: colors.veilInk, opacity: veil },
    frameDim: {
      ...StyleSheet.absoluteFill,
      backgroundColor: colors.veilInk,
      opacity: stage.frameDim,
    },
    frameBox: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: stage.frame.bottom,
      alignItems: 'center',
      justifyContent: 'center',
    },
    frameImage: { height: stage.frame.height, aspectRatio: stage.frame.aspect },
    dim: { ...StyleSheet.absoluteFill, backgroundColor: colors.veilInk },
  });

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.stage}
    >
      <View style={styles.bands}>
        {bands.map((band, i) => (
          <View key={i} style={{ flex: band.weight, backgroundColor: band.color }} />
        ))}
      </View>
      <View style={styles.veil} />
      {loading ? <Shimmer reduced={reduced} /> : null}
      {photo && layout !== null ? (
        // A fresh Image per photo: expo-image keeps the old source on screen
        // until the new one loads, so without the key the previous player's
        // face would show (and the bands and shimmer would not) while this
        // one loads. Each callback sets the URL it was created for.
        <Image
          key={photo.url}
          recyclingKey={photo.url}
          source={{ uri: photo.url }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition={stage.focal}
          transition={durations.reveal}
          cachePolicy="disk"
          onLoad={() => setLoaded(photo.url)}
          onError={() => setFailed(photo.url)}
        />
      ) : null}
      {photo && layout === 'frame' && loaded === photo.url ? (
        <>
          <View style={styles.frameDim} />
          <View style={styles.frameBox}>
            <Image
              key={photo.url}
              recyclingKey={photo.url}
              source={{ uri: photo.url }}
              style={styles.frameImage}
              contentFit="contain"
              cachePolicy="disk"
            />
          </View>
        </>
      ) : null}
      <Animated.View style={[styles.dim, dimStyle]} />
    </View>
  );
}

// A soft diagonal band sweeping across while the photo loads. With Reduce
// Motion it holds still, faint.
function Shimmer({ reduced }: { reduced: boolean }) {
  const colors = useThemeColors();
  const [width, setWidth] = useState(0);
  const sweep = useSharedValue(-1);
  useEffect(() => {
    if (reduced) return;
    sweep.value = withRepeat(
      withTiming(1, { duration: durations.skeleton, easing: Easing.inOut(Easing.quad) }),
      -1,
    );
  }, [reduced, sweep]);
  const moving = useAnimatedStyle(() => ({ transform: [{ translateX: sweep.value * width }] }));
  return (
    <View style={StyleSheet.absoluteFill} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <Animated.View
        style={[StyleSheet.absoluteFill, reduced ? { opacity: opacity.faded } : moving]}
      >
        <LinearGradient
          colors={[colors.stageShimmerEdge, colors.stageShimmer, colors.stageShimmerEdge]}
          locations={stage.shimmer.locations}
          start={stage.shimmer.start}
          end={stage.shimmer.end}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}
