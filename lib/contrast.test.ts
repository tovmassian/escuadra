import { describe, expect, it } from 'vitest';
import { contrastRatio, relativeLuminance } from './contrast';

describe('relativeLuminance', () => {
  it('runs from black to white', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 10);
  });

  // Squad files carry upper-case team colours ('#AA151B').
  it('accepts upper-case hex', () => {
    expect(relativeLuminance('#FFC400')).toBe(relativeLuminance('#ffc400'));
  });

  it('refuses anything but #rrggbb', () => {
    for (const bad of ['#fff', 'ffffff', '#12141', 'rgba(0,0,0,1)', '']) {
      expect(() => relativeLuminance(bad), bad).toThrow();
    }
  });
});

describe('contrastRatio', () => {
  it('is 21:1 for black on white and 1:1 for a colour on itself', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 10);
    expect(contrastRatio('#3e45a3', '#3e45a3')).toBe(1);
  });

  it('does not depend on order', () => {
    expect(contrastRatio('#868b91', '#12141a')).toBe(contrastRatio('#12141a', '#868b91'));
  });

  // #767676 on white is the classic pair that just passes AA.
  it('matches the WCAG reference grey', () => {
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.542, 3);
  });
});
