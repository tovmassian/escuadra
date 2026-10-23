import { describe, expect, it } from 'vitest';
import { dockTransform, introPlan } from '@/lib/launchIntro';

const fresh = { alreadyShown: false, screenReader: false, reduceMotion: false };

describe('introPlan', () => {
  it('plays the strike on a fresh launch', () => {
    expect(introPlan(fresh)).toBe('play');
  });

  it('shows only the end frame under Reduce Motion', () => {
    expect(introPlan({ ...fresh, reduceMotion: true })).toBe('still');
  });

  it('never shows twice in one launch, so a warm resume goes straight on', () => {
    expect(introPlan({ ...fresh, alreadyShown: true })).toBe('none');
    expect(introPlan({ ...fresh, alreadyShown: true, reduceMotion: true })).toBe('none');
  });

  it('shows nothing with a screen reader on', () => {
    expect(introPlan({ ...fresh, screenReader: true })).toBe('none');
    expect(introPlan({ ...fresh, screenReader: true, reduceMotion: true })).toBe('none');
  });
});

describe('dockTransform', () => {
  // A box of the given size centred at (cx, cy), as `measureInWindow` reports it.
  const centred = (cx: number, cy: number, width: number, height = width) => ({
    x: cx - width / 2,
    y: cy - height / 2,
    width,
    height,
  });

  it('leaves a box where it is when the target is the same box', () => {
    const box = centred(100, 200, 50);
    expect(dockTransform(box, box)).toEqual({ translateX: 0, translateY: 0, scale: 1 });
  });

  it('moves centre to centre and scales by the ratio of the widths', () => {
    const { translateX, translateY, scale } = dockTransform(
      centred(195, 350, 200),
      centred(40, 44, 28),
    );
    expect(translateX).toBeCloseTo(-155);
    expect(translateY).toBeCloseTo(-306);
    expect(scale).toBeCloseTo(0.14);
  });

  it('moves right and down to a target to the right and below', () => {
    const { translateX, translateY } = dockTransform(centred(50, 50, 40), centred(300, 600, 20));
    expect(translateX).toBeGreaterThan(0);
    expect(translateY).toBeGreaterThan(0);
  });

  it('scales by width alone, so a word set wider or narrower keeps its own line height', () => {
    const word = { x: 0, y: 0, width: 200, height: 56 };
    const target = { x: 0, y: 0, width: 100, height: 26 };
    expect(dockTransform(word, target).scale).toBeCloseTo(0.5);
  });
});
