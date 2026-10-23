import { describe, expect, it } from 'vitest';
import {
  placeTip,
  roundedRectPath,
  scrollDelta,
  settled,
  shouldShowTips,
  type TipGeometry,
} from '../tips';

const G: TipGeometry = {
  gap: 5,
  ring: 2,
  arrow: { width: 40, height: 40 },
  arrowGap: 4,
  tipGap: 8,
  gutter: 24,
  skipClear: 100,
};
const SCREEN = { width: 390, height: 844 };
const INSETS = { top: 47, bottom: 34 };

describe('shouldShowTips', () => {
  it('shows a screen whose tips have not shown', () => {
    expect(shouldShowTips('picker', [], false)).toBe(true);
    expect(shouldShowTips('study', ['picker'], false)).toBe(true);
  });
  it('never shows a screen twice', () => {
    expect(shouldShowTips('picker', ['picker'], false)).toBe(false);
  });
  it('shows nothing anywhere once skipped', () => {
    expect(shouldShowTips('difficulty', [], true)).toBe(false);
  });
});

describe('placeTip', () => {
  const play = { x: 20, y: 380, width: 350, height: 56 };

  it('cuts the hole the gap outside the target, its radius grown by the gap', () => {
    const p = placeTip(
      { target: play, radius: 999, screen: SCREEN, insets: INSETS, tipHeight: 150 },
      G,
    );
    expect(p.hole).toEqual({ x: 15, y: 375, width: 360, height: 66, radius: 33 });
  });

  it('rings the hole one stroke-centre further out', () => {
    const p = placeTip(
      { target: play, radius: 999, screen: SCREEN, insets: INSETS, tipHeight: 150 },
      G,
    );
    expect(p.ring).toEqual({ x: 14, y: 374, width: 362, height: 68, radius: 34 });
  });

  it('puts the tip under the target when it fits', () => {
    const p = placeTip(
      { target: play, radius: 28, screen: SCREEN, insets: INSETS, tipHeight: 150 },
      G,
    );
    expect(p.side).toBe('below');
    // ring bottom 442, + arrowGap 4 = arrow at 446, + 40 + tipGap 8 = 494
    expect(p.arrow.y).toBe(446);
    expect(p.tipTop).toBe(494);
  });

  it('puts the tip over a target near the bottom', () => {
    const study = { x: 20, y: 700, width: 350, height: 56 };
    const p = placeTip(
      { target: study, radius: 28, screen: SCREEN, insets: INSETS, tipHeight: 150 },
      G,
    );
    expect(p.side).toBe('above');
    // ring top 694, - arrowGap 4 - arrow 40 = arrow at 650; - tipGap 8 - 150 = 492
    expect(p.arrow.y).toBe(650);
    expect(p.tipTop).toBe(492);
  });

  it('takes the roomier side, clamped on screen, when neither fits', () => {
    const middle = { x: 20, y: 300, width: 350, height: 200 };
    const p = placeTip(
      {
        target: middle,
        radius: 16,
        screen: { width: 360, height: 640 },
        insets: { top: 0, bottom: 0 },
        tipHeight: 260,
      },
      G,
    );
    expect(p.side).toBe('above');
    expect(p.tipTop).toBeGreaterThanOrEqual(G.skipClear);
  });

  it('points the arrow at a narrow target centre, mirrored on the right half', () => {
    const star = { x: 326, y: 54, width: 44, height: 44 };
    const p = placeTip(
      { target: star, radius: 22, screen: SCREEN, insets: INSETS, tipHeight: 120 },
      G,
    );
    expect(p.arrow.flip).toBe(true);
    // centre 348 - 20 = 328, clamped to 390 - 24 - 40 = 326
    expect(p.arrow.x).toBe(326);
  });

  it('sets the arrow at the left of a wide target', () => {
    const p = placeTip(
      { target: play, radius: 28, screen: SCREEN, insets: INSETS, tipHeight: 150 },
      G,
    );
    expect(p.arrow.flip).toBe(false);
    expect(p.arrow.x).toBe(play.x + G.gutter);
  });

  it('clips a target wider than the screen to it', () => {
    const pills = { x: 16, y: 120, width: 600, height: 36 };
    const p = placeTip(
      { target: pills, radius: 999, screen: SCREEN, insets: INSETS, tipHeight: 120 },
      G,
    );
    expect(p.hole.x + p.hole.width).toBeLessThanOrEqual(SCREEN.width);
  });
});

describe('scrollDelta', () => {
  it('is 0 for a target on screen', () => {
    const target = { x: 20, y: 700, width: 350, height: 56 };
    expect(scrollDelta({ target, radius: 28, screen: SCREEN, insets: INSETS }, G)).toBe(0);
  });
  it('scrolls a target below the fold up to the bottom gutter', () => {
    const target = { x: 20, y: 900, width: 350, height: 56 };
    // ring bottom 900 + 56 + 6 = 962; visible bottom 844 - 34 - 24 = 786
    expect(scrollDelta({ target, radius: 28, screen: SCREEN, insets: INSETS }, G)).toBe(176);
  });
});

describe('roundedRectPath', () => {
  it('draws a rounded rect clockwise', () => {
    expect(roundedRectPath({ x: 0, y: 0, width: 10, height: 10, radius: 2 })).toBe(
      'M2 0H8A2 2 0 0 1 10 2V8A2 2 0 0 1 8 10H2A2 2 0 0 1 0 8V2A2 2 0 0 1 2 0Z',
    );
  });
  it('caps the radius at half the shorter side', () => {
    expect(roundedRectPath({ x: 0, y: 0, width: 20, height: 10, radius: 99 })).toBe(
      'M5 0H15A5 5 0 0 1 20 5V5A5 5 0 0 1 15 10H5A5 5 0 0 1 0 5V5A5 5 0 0 1 5 0Z',
    );
  });
});

describe('settled', () => {
  const box = { x: 1, y: 2, width: 3, height: 4 };
  it('waits for a first measure', () => {
    expect(settled(null, box)).toBe(false);
  });
  it('holds when two measures agree to half a point', () => {
    expect(settled(box, { ...box, y: 2.4 })).toBe(true);
    expect(settled(box, { ...box, x: 12 })).toBe(false);
  });
});
