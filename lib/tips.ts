// How to play (#183; spec docs/superpowers/specs/2026-10-23-how-to-play-tips-design.md):
// whether a screen opens with its tips, and where a tip's cut-out, ring, arrow
// and text go around a measured target. Pure, so it is tested; `TipsLayer` draws it.

export type TipScreen =
  'picker' | 'difficulty' | 'study' | 'question-1' | 'question-2' | 'question-3' | 'results';

/** Results' tips (#184): the misses, then what to do next. */
export type ResultsTip = 'missed' | 'again' | 'next';

/** Which of Results' tips have something to point at: no misses on a 10/10,
 *  and no next level after passing the last one. */
export function resultsTips({
  missed,
  passed,
  hasNextLevel,
}: {
  missed: number;
  passed: boolean;
  hasNextLevel: boolean;
}): ResultsTip[] {
  const tips: ResultsTip[] = [];
  if (missed > 0) tips.push('missed');
  if (!passed) tips.push('again');
  else if (hasNextLevel) tips.push('next');
  return tips;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RoundedBox extends Box {
  radius: number;
}

export interface TipGeometry {
  /** Between the target and the ring: the `hole`'s outset, which the layer
   *  leaves dark (it cuts the scrim at `cut`). */
  gap: number;
  /** The ring's stroke, drawn just outside the cut-out. */
  ring: number;
  arrow: { width: number; height: number };
  /** Between the ring and the arrow. */
  arrowGap: number;
  /** Between the arrow and the tip. */
  tipGap: number;
  /** The screen's side margin, which the tip and arrow keep inside. */
  gutter: number;
  /** How far down the tip must stay to clear Skip tips. */
  skipClear: number;
}

export interface PlaceInput {
  target: Box;
  /** The target's own corner radius; a pill passes `radii.pill`. */
  radius: number;
  screen: { width: number; height: number };
  insets: { top: number; bottom: number };
  tipHeight: number;
}

export interface TipPlacement {
  /** The target itself, on screen: where the scrim is cut, so the gap between
   *  it and the ring stays dark, as the canvas draws it. */
  cut: RoundedBox;
  hole: RoundedBox;
  ring: RoundedBox;
  side: 'below' | 'above';
  tipTop: number;
  /** The arrow's box's top left; `flip` mirrors it to curve leftwards. */
  arrow: { x: number; y: number; flip: boolean };
}

export function shouldShowTips(
  screen: TipScreen,
  seen: readonly TipScreen[],
  skipped: boolean,
): boolean {
  return !skipped && !seen.includes(screen);
}

function outset(box: Box, by: number, radius: number): RoundedBox {
  return {
    x: box.x - by,
    y: box.y - by,
    width: box.width + by * 2,
    height: box.height + by * 2,
    radius: Math.min(radius, box.height / 2) + by,
  };
}

/** The target cut to the screen's width, less the gap, so the cut-out stays on
 *  screen: a pill row may run past the edge. */
function onScreen(target: Box, width: number, inset: number): Box {
  const x = Math.max(inset, target.x);
  return { ...target, x, width: Math.min(width - inset, target.x + target.width) - x };
}

function ringOf(input: Omit<PlaceInput, 'tipHeight'>, g: TipGeometry) {
  const target = onScreen(input.target, input.screen.width, g.gap);
  const cut = outset(target, 0, input.radius);
  const hole = outset(target, g.gap, input.radius);
  const ring = outset(target, g.gap + g.ring / 2, input.radius);
  return { target, cut, hole, ring };
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

export function placeTip(input: PlaceInput, g: TipGeometry): TipPlacement {
  const { screen, insets, tipHeight } = input;
  const { target, cut, hole, ring } = ringOf(input, g);
  const top = insets.top + g.skipClear;
  const bottom = screen.height - insets.bottom - g.gutter;

  const belowArrow = ring.y + ring.height + g.arrowGap;
  const belowTip = belowArrow + g.arrow.height + g.tipGap;
  const aboveArrow = ring.y - g.arrowGap - g.arrow.height;
  const aboveTip = aboveArrow - g.tipGap - tipHeight;

  const fitsBelow = belowTip + tipHeight <= bottom;
  const fitsAbove = aboveTip >= top;
  const side =
    fitsBelow || (!fitsAbove && bottom - belowTip >= aboveArrow - g.tipGap - top)
      ? 'below'
      : 'above';
  const tipTop =
    side === 'below'
      ? clamp(belowTip, top, Math.max(top, bottom - tipHeight))
      : clamp(aboveTip, top, Math.max(top, bottom - tipHeight));

  const centre = target.x + target.width / 2;
  const narrow = target.width < screen.width / 2;
  const maxX = screen.width - g.gutter - g.arrow.width;
  const arrowX = narrow
    ? clamp(centre - g.arrow.width / 2, g.gutter, maxX)
    : clamp(target.x + g.gutter, g.gutter, maxX);

  return {
    cut,
    hole,
    ring,
    side,
    tipTop,
    arrow: {
      x: arrowX,
      y: side === 'below' ? belowArrow : aboveArrow,
      flip: narrow && centre > screen.width / 2,
    },
  };
}

/** How far to scroll so the target sits, ringed, on screen: down (positive) for
 *  one below the fold, to above the bottom gutter; up (negative) for one above
 *  the top, as an earlier step's scroll may leave it, to just below Skip tips;
 *  0 when it is already on screen.
 *
 *  `bottomClear` is how far a pinned element covers the screen's bottom, above
 *  the inset (Difficulty's footer): the fold moves up by it. A `pinned` target is
 *  on that element, which scrolling cannot move: 0. Where a target sits says
 *  nothing: at the largest text, Play is in the list, behind the footer (#187). */
export function scrollDelta(
  input: Omit<PlaceInput, 'tipHeight'> & { bottomClear?: number; pinned?: boolean },
  g: TipGeometry,
): number {
  if (input.pinned) return 0;
  const { ring } = ringOf(input, g);
  const top = input.insets.top + g.skipClear;
  const covered = input.screen.height - input.insets.bottom - (input.bottomClear ?? 0);
  if (ring.y < top) return ring.y - top;
  return Math.max(0, ring.y + ring.height - (covered - g.gutter));
}

/** An SVG path for a rounded rect, drawn clockwise, to cut out of the scrim
 *  with `fillRule="evenodd"`. */
export function roundedRectPath({ x, y, width, height, radius }: RoundedBox): string {
  const r = Math.min(radius, width / 2, height / 2);
  return [
    `M${x + r} ${y}`,
    `H${x + width - r}`,
    `A${r} ${r} 0 0 1 ${x + width} ${y + r}`,
    `V${y + height - r}`,
    `A${r} ${r} 0 0 1 ${x + width - r} ${y + height}`,
    `H${x + r}`,
    `A${r} ${r} 0 0 1 ${x} ${y + height - r}`,
    `V${y + r}`,
    `A${r} ${r} 0 0 1 ${x + r} ${y}`,
    'Z',
  ].join('');
}

/** Two measures half a point apart or less: the screen has stopped moving. */
export function settled(previous: Box | null, next: Box): boolean {
  if (previous === null) return false;
  return (
    Math.abs(previous.x - next.x) <= 0.5 &&
    Math.abs(previous.y - next.y) <= 0.5 &&
    Math.abs(previous.width - next.width) <= 0.5 &&
    Math.abs(previous.height - next.height) <= 0.5
  );
}
