// Home's number wall (#181): where each shirt number sits in its row, and how
// far a row has drifted. Pure, so Vitest can hold the loop to its seams; the
// drawing is components/NumberWall.tsx.
import { numberWall } from '@/theme/tokens';

/** A filled number's ink: `textPrimary` or `mark`. */
export type WallFill = 'primary' | 'mark';

export interface WallRowSpec {
  /** The row loops through `from`…`to`. */
  from: number;
  to: number;
  filled: Readonly<Partial<Record<number, WallFill>>>;
  direction: 'left' | 'right';
  /** How far into its loop the row starts, in pt, so the rows don't line up. */
  phase: number;
}

// Ten numbers a row rather than the canvas's 26: a drawn row costs memory in
// proportion to its width (spec, How the wall is drawn). Between them the rows
// still show every number from 1 to 26, and the filled ones and the starting
// offsets are the canvas's.
export const WALL_ROWS: readonly WallRowSpec[] = [
  { from: 1, to: 10, filled: { 7: 'primary' }, direction: 'left', phase: 0 },
  { from: 5, to: 14, filled: { 10: 'mark' }, direction: 'right', phase: 60 },
  { from: 15, to: 24, filled: {}, direction: 'left', phase: 140 },
  { from: 17, to: 26, filled: { 19: 'primary' }, direction: 'right', phase: 30 },
];

export interface WallItem {
  n: number;
  /** The number's left edge in its row, pt. */
  x: number;
  fill: WallFill | null;
}

export interface WallRowLayout {
  items: WallItem[];
  /** One pass through the row's numbers, each with its gap: the drift's period. */
  loopWidth: number;
  /** The drawn row: a loop plus a viewport, so any offset in the loop is covered. */
  width: number;
}

/** A number's drawn width: its digits' advances plus the tracking between them. */
export function numberWidth(n: number): number {
  const digits = String(n).split('') as (keyof typeof numberWall.advance)[];
  const advance = digits.reduce((sum, d) => sum + numberWall.advance[d], 0);
  return (advance * numberWall.fontSize) / 1000 + (digits.length - 1) * numberWall.tracking;
}

export function layoutRow(row: WallRowSpec, viewport: number): WallRowLayout {
  const count = row.to - row.from + 1;
  const numberAt = (i: number) => row.from + (i % count);
  let loopWidth = 0;
  for (let i = 0; i < count; i++) loopWidth += numberWidth(numberAt(i)) + numberWall.gap;

  const items: WallItem[] = [];
  let x = 0;
  for (let i = 0; x < loopWidth + viewport; i++) {
    const n = numberAt(i);
    items.push({ n, x, fill: row.filled[n] ?? null });
    x += numberWidth(n) + numberWall.gap;
  }
  return { items, loopWidth, width: x };
}

/** A row's translateX at `progress` (0 to 1) through its loop. The content
 *  repeats every `loopWidth`, so 0 and 1 are the same frame. */
export function rowOffset(
  progress: number,
  loopWidth: number,
  phase: number,
  direction: 'left' | 'right',
): number {
  'worklet';
  const travelled = direction === 'left' ? progress : 1 - progress;
  return -((phase + travelled * loopWidth) % loopWidth);
}
