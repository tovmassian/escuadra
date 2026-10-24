import type { Ref } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { sampleShot, type LiveShot } from '@/lib/shot';
import { sizes, spotlightMotion } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useTheme';

interface Layer {
  delay: number;
  opacity: number;
  scale: number;
}

const { drawScale, trail } = spotlightMotion.shot;
const DRAWN = sizes.corner.question.ball * drawScale;
const GHOSTS: Layer[] = [...trail];
// Back to front: the faintest of the trail first, the ball last.
const LAYERS: readonly Layer[] = [...GHOSTS.reverse(), { delay: 0, opacity: 1, scale: 1 }];

interface ShotOverlayProps {
  /** The question on screen: a shot fired for another one is not drawn. */
  question: number;
  live: SharedValue<LiveShot | null>;
  clock: SharedValue<number>;
  /** Measured to place the shot: everything is planned in its coordinates. */
  ref?: Ref<ViewInstance>;
}

// The shot (#129, spec §6): the ball struck from the tapped tile and its
// trail, over the whole question screen and never in the way of a tap. It
// draws what `planShot` planned, sampled from the shot's clock on the UI
// thread, so no frame waits on JavaScript.
export function ShotOverlay({ question, live, clock, ref }: ShotOverlayProps) {
  const colors = useThemeColors();
  return (
    <View
      ref={ref}
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {LAYERS.map((layer) => (
        <ShotBall
          key={layer.delay}
          layer={layer}
          question={question}
          live={live}
          clock={clock}
          goal={colors.success}
          miss={colors.error}
        />
      ))}
    </View>
  );
}

interface ShotBallProps {
  layer: Layer;
  question: number;
  live: SharedValue<LiveShot | null>;
  clock: SharedValue<number>;
  goal: string;
  miss: string;
}

// One ball: the shot itself, or one of its trail, `layer.delay` ms behind,
// fainter and smaller. Drawn large and scaled down, so it stays sharp.
function ShotBall({ layer, question, live, clock, goal, miss }: ShotBallProps) {
  const style = useAnimatedStyle(() => {
    const shot = live.value;
    const at =
      shot && shot.frames && shot.question === question
        ? sampleShot(shot.frames, clock.value - layer.delay)
        : null;
    return {
      backgroundColor: shot?.verdict === 'miss' ? miss : goal,
      opacity: at ? at.opacity * layer.opacity : 0,
      transform: [
        { translateX: at ? at.x : 0 },
        { translateY: at ? at.y : 0 },
        { scale: ((at ? at.scale : 1) * layer.scale) / drawScale },
      ],
    };
  });
  return <Animated.View style={[styles.ball, style]} />;
}

const styles = StyleSheet.create({
  // Centred on its own origin, so a translate puts its centre on the point.
  ball: {
    position: 'absolute',
    left: -DRAWN / 2,
    top: -DRAWN / 2,
    width: DRAWN,
    height: DRAWN,
    borderRadius: DRAWN / 2,
  },
});
