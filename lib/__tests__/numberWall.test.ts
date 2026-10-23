import { describe, expect, it } from 'vitest';
import { WALL_ROWS, layoutRow, numberWidth, rowOffset, type WallRowSpec } from '@/lib/numberWall';
import { numberWall } from '@/theme/tokens';

const em = numberWall.fontSize / 1000;
const row: WallRowSpec = { from: 1, to: 3, filled: { 2: 'mark' }, direction: 'left', phase: 0 };

describe('numberWidth', () => {
  it('is a digit’s advance at the wall’s size', () => {
    expect(numberWidth(7)).toBeCloseTo(400 * em);
  });

  it('adds the tracking between digits', () => {
    expect(numberWidth(10)).toBeCloseTo((375 + 447) * em + numberWall.tracking);
  });
});

describe('layoutRow', () => {
  const loop = numberWidth(1) + numberWidth(2) + numberWidth(3) + 3 * numberWall.gap;

  it('loops once through the row’s numbers, each followed by the gap', () => {
    expect(layoutRow(row, 390).loopWidth).toBeCloseTo(loop);
  });

  it('places each number after the last one and its gap, starting at 0', () => {
    const [a, b, c, d] = layoutRow(row, 390).items;
    expect(a).toEqual({ n: 1, x: 0, fill: null });
    expect(b?.x).toBeCloseTo(numberWidth(1) + numberWall.gap);
    expect(c?.n).toBe(3);
    expect(d?.n).toBe(1);
    expect(d?.x).toBeCloseTo(loop);
  });

  it('fills only the row’s filled numbers, every time they come round', () => {
    const filled = layoutRow(row, 390).items.filter((i) => i.fill !== null);
    expect(filled.length).toBeGreaterThan(1);
    expect(filled.every((i) => i.n === 2 && i.fill === 'mark')).toBe(true);
  });

  it('draws one loop plus the viewport, so every offset of the loop is covered', () => {
    const layout = layoutRow(row, 390);
    expect(layout.width).toBeGreaterThanOrEqual(layout.loopWidth + 390);
    const last = layout.items[layout.items.length - 1];
    expect(last && last.x).toBeLessThan(layout.loopWidth + 390);
  });
});

describe('rowOffset', () => {
  it('starts a row at its phase', () => {
    expect(rowOffset(0, 1000, 60, 'left')).toBeCloseTo(-60);
  });

  it('moves a left row left as the loop runs, wrapping back to where it began', () => {
    expect(rowOffset(0.5, 1000, 0, 'left')).toBeCloseTo(-500);
    expect(rowOffset(1, 1000, 60, 'left')).toBeCloseTo(rowOffset(0, 1000, 60, 'left'));
  });

  it('moves a right row right', () => {
    const a = rowOffset(0.2, 1000, 0, 'right');
    const b = rowOffset(0.3, 1000, 0, 'right');
    expect(b).toBeGreaterThan(a);
    expect(rowOffset(1, 1000, 30, 'right')).toBeCloseTo(rowOffset(0, 1000, 30, 'right'));
  });

  it('never leaves the loop: an offset is always in (-loop, 0]', () => {
    for (const p of [0, 0.1, 0.5, 0.99, 1]) {
      for (const dir of ['left', 'right'] as const) {
        const x = rowOffset(p, 1000, 140, dir);
        expect(x).toBeLessThanOrEqual(0);
        expect(x).toBeGreaterThan(-1000);
      }
    }
  });
});

describe('WALL_ROWS', () => {
  it('shows every shirt number from 1 to 26 between its four rows', () => {
    const shown = new Set(WALL_ROWS.flatMap((r) => range(r.from, r.to)));
    expect([...shown].sort((a, b) => a - b)).toEqual(range(1, 26));
  });

  it('alternates direction, row by row', () => {
    expect(WALL_ROWS.map((r) => r.direction)).toEqual(['left', 'right', 'left', 'right']);
  });

  it('fills 7 and 19 in the primary ink and 10 in the mark’s, as the canvas does', () => {
    expect(WALL_ROWS.map((r) => r.filled)).toEqual([
      { 7: 'primary' },
      { 10: 'mark' },
      {},
      { 19: 'primary' },
    ]);
  });
});

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}
