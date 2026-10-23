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

/** Whether a measured box can be docked from or into: there, with a real
 *  size. A view that unmounted, or has not laid out, gives none, and the
 *  intro fades instead (a zero width would scale to nothing or infinity). */
export function isDockable(rect: DockRect | null): rect is DockRect {
  if (!rect) return false;
  const { x, y, width, height } = rect;
  return [x, y, width, height].every(Number.isFinite) && width > 0 && height > 0;
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

/** A one-shot timer: the global one by default; tests pass their own. */
export interface OneShotTimer<H> {
  set: (fire: () => void, ms: number) => H;
  clear: (handle: H) => void;
}

const globalTimer: OneShotTimer<ReturnType<typeof setTimeout>> = {
  set: (fire, ms) => setTimeout(fire, ms),
  clear: (handle) => clearTimeout(handle),
};

/** `work`'s result if it settles within `ms`, otherwise null: whichever comes
 *  first wins, and the other is ignored. The intro bounds its measuring with
 *  it, so a native callback that never fires cannot leave it on screen.
 *  `cancel` (on unmount) stops the timer, and then neither settles. */
export function withinTime<T, H = ReturnType<typeof setTimeout>>(
  work: Promise<T>,
  ms: number,
  timer: OneShotTimer<H> = globalTimer as unknown as OneShotTimer<H>,
): { result: Promise<T | null>; cancel: () => void } {
  let open = true;
  let handle: H | undefined;
  const result = new Promise<T | null>((resolve) => {
    const settle = (value: T | null) => {
      if (!open) return;
      open = false;
      if (handle !== undefined) timer.clear(handle);
      resolve(value);
    };
    handle = timer.set(() => settle(null), ms);
    void work.then(settle, () => settle(null));
  });
  const cancel = () => {
    if (!open) return;
    open = false;
    if (handle !== undefined) timer.clear(handle);
  };
  return { result, cancel };
}
