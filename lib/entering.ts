// Entering animations come from here, and a custom one (`Sheet`'s slide) is left
// out the same way. Under Reduce Motion there is none: the view mounts as it is.
// Reanimated would skip the animation anyway, ending it on its first frame, and
// on Android a view that ends its entering there can stay at the opacity 0 it
// was inserted with: answer tiles and the miss's button never showed (#231).
import { Platform } from 'react-native';
// eslint-disable-next-line no-restricted-imports -- the one place an entering fade is built (#231)
import { FadeIn, Keyframe } from 'react-native-reanimated';

type Offset = { translateX: number } | { translateY: number } | { scale: number };

/**
 * An entering animation: fade in while moving from `from` to `to`.
 * - Reduce Motion: none.
 * - Web: a plain fade with the same timing. Reanimated's web layout
 *   animations pin an element that entered with a custom `Keyframe` where it
 *   entered (`position: absolute`, fixed size) once the keyframe is cleaned
 *   up, which takes it out of the layout: a grid of them collapses onto one
 *   row. Its predefined animations are left alone. Web is the screenshot
 *   build, so only the movement is lost there.
 */
function enter(reduced: boolean, from: Offset, to: Offset, duration: number, delay: number) {
  if (reduced) return undefined;
  if (Platform.OS === 'web') return FadeIn.duration(duration).delay(delay);
  return new Keyframe({
    0: { opacity: 0, transform: [from] },
    100: { opacity: 1, transform: [to] },
  })
    .duration(duration)
    .delay(delay);
}

/** Fade in, in place. */
export function fadeIn(reduced: boolean, duration: number, delay = 0) {
  return reduced ? undefined : FadeIn.duration(duration).delay(delay);
}

/** Fade in while rising `distance` into place. */
export function riseIn(reduced: boolean, distance: number, duration: number, delay = 0) {
  return enter(reduced, { translateY: distance }, { translateY: 0 }, duration, delay);
}

/** Fade in while sliding `distance` in from the right. */
export function slideIn(reduced: boolean, distance: number, duration: number, delay = 0) {
  return enter(reduced, { translateX: distance }, { translateX: 0 }, duration, delay);
}

/** Fade in while growing from `scale` to full size. */
export function popIn(reduced: boolean, scale: number, duration: number, delay = 0) {
  return enter(reduced, { scale }, { scale: 1 }, duration, delay);
}
