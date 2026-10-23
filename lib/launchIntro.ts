// Whether the launch intro (#182) shows, and how. Pure, so it is tested;
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
