import { describe, expect, it } from 'vitest';
import { gradients, palettes, typography } from './tokens';

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
      expect(palettes.dark[key], key).toMatch(HEX);
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

// Hex or rgba(). Catches a truncated hex like '#12141', which is a valid
// string and a silently wrong colour — neither TypeScript nor the compiler
// can see the difference.
const COLOR = /^(#[0-9a-f]{6}|rgba\(\d+,\d+,\d+,[\d.]+\))$/;

describe('palettes', () => {
  it('expose identical key sets', () => {
    expect(new Set(Object.keys(palettes.light))).toEqual(new Set(Object.keys(palettes.dark)));
  });

  it('hold a well-formed colour in every role, in both themes', () => {
    (['dark', 'light'] as const).forEach((name) => {
      Object.entries(palettes[name]).forEach(([role, value]) => {
        expect(value.replace(/\s/g, ''), `${name}.${role}`).toMatch(COLOR);
      });
    });
  });
});
