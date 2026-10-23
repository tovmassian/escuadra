// Whether the launch intro (#182) shows, and how; and the move that docks its
// lockup into Home's at the end. Pure, so it is tested;
// `components/LaunchIntro.tsx` asks it.

/** `play` the strike, show its `still` end frame, or `none`. */
export type IntroPlan = 'play' | 'still' | 'none';

export interface IntroConditions {
  /** This JavaScript launch has shown it already: a warm resume, or a remount. */
  alreadyShown: boolean;
  /** VoiceOver or TalkBack: the intro is decoration that would take focus and vanish. */
  screenReader: boolean;
  reduceMotion: boolean;
}

export function introPlan({
  alreadyShown,
  screenReader,
  reduceMotion,
}: IntroConditions): IntroPlan {
  if (alreadyShown || screenReader) return 'none';
  return reduceMotion ? 'still' : 'play';
}

/** A box in window coordinates, as `measureInWindow` gives it. */
export interface DockRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The transform that lays `from` over `to`: centre to centre, scaled by the
 *  ratio of their widths. React Native scales about a view's own centre, so
 *  the translate is simply the distance between the two centres. */
export function dockTransform(
  from: DockRect,
  to: DockRect,
): { translateX: number; translateY: number; scale: number } {
  return {
    translateX: to.x + to.width / 2 - (from.x + from.width / 2),
    translateY: to.y + to.height / 2 - (from.y + from.height / 2),
    scale: to.width / from.width,
  };
}
