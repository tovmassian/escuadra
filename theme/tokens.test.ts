import { describe, expect, it } from 'vitest';
import { colors, gradients, typography } from './tokens';

const HEX = /^#[0-9a-fA-F]{6}$/;

describe('brand tokens', () => {
  it('every brand colour is a full-length hex', () => {
    for (const key of [
      'brandBright',
      'brandDeep',
      'brandSoft',
      'brandLift',
      'brandPlateTop',
      'brandPlateBottom',
    ] as const) {
      expect(colors[key], key).toMatch(HEX);
    }
  });

  it('every gradient has at least two stops, all valid hex', () => {
    for (const [name, g] of Object.entries(gradients)) {
      expect(g.colors.length, name).toBeGreaterThanOrEqual(2);
      for (const stop of g.colors) expect(stop, name).toMatch(HEX);
    }
  });

  it('every gradient start and end is inside the unit square', () => {
    for (const [name, g] of Object.entries(gradients)) {
      for (const p of [g.start, g.end]) {
        expect(p.x, name).toBeGreaterThanOrEqual(0);
        expect(p.x, name).toBeLessThanOrEqual(1);
        expect(p.y, name).toBeGreaterThanOrEqual(0);
        expect(p.y, name).toBeLessThanOrEqual(1);
      }
    }
  });

  it('the wordmark uses the ExtraBold family', () => {
    expect(typography.wordmark.fontFamily).toBe('Inter-ExtraBold');
  });
});
