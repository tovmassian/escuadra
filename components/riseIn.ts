import { Platform } from 'react-native';
import { FadeIn, Keyframe } from 'react-native-reanimated';
import { durations } from '@/theme/tokens';

/**
 * An entering animation: fade in while rising `distance` into place.
 * - Reduce Motion: a plain fade over `durations.transition`, at once.
 * - Web: a plain fade with the same timing. Reanimated's web layout
 *   animations pin an element that entered with a custom `Keyframe` where it
 *   entered (`position: absolute`, fixed size) once the keyframe is cleaned
 *   up, which takes it out of the layout: a grid of them collapses onto one
 *   row. Its predefined animations are left alone. Web is the screenshot
 *   build, so only the rise is lost there.
 */
export function riseIn(reduced: boolean, distance: number, duration: number, delay = 0) {
  if (reduced) return FadeIn.duration(durations.transition);
  if (Platform.OS === 'web') return FadeIn.duration(duration).delay(delay);
  return new Keyframe({
    0: { opacity: 0, transform: [{ translateY: distance }] },
    100: { opacity: 1, transform: [{ translateY: 0 }] },
  })
    .duration(duration)
    .delay(delay);
}
