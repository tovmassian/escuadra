import { describe, expect, it } from 'vitest';
import { contrastRatio } from '@/lib/contrast';
import { gradients, palettes, stage, stageGradients, typography } from './tokens';

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

describe('text contrast', () => {
  // AA for body text. `textMuted` carries captions, stat labels and the photo
  // credit, so it is held to the body-copy bar on the grounds it sits on.
  it('textMuted reaches 4.5:1 on background and surface, in both themes', () => {
    (['dark', 'light'] as const).forEach((name) => {
      const p = palettes[name];
      for (const ground of ['background', 'surface'] as const) {
        expect(
          contrastRatio(p.textMuted, p[ground]),
          `${name}.textMuted on ${ground}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    });
  });
});

describe('spotlight stage', () => {
  // These sit on the player photo, which looks the same in either theme.
  it('shares the photo-side roles between themes', () => {
    for (const role of [
      'heat',
      'heatBg',
      'heatLine',
      'heatText',
      'glass',
      'glassLine',
      'veilInk',
    ] as const) {
      expect(palettes.light[role], role).toBe(palettes.dark[role]);
    }
  });

  it('gives each theme a stage gradient that ends in its own ground', () => {
    (['dark', 'light'] as const).forEach((name) => {
      const g = stageGradients[name];
      expect(g.locations.length, name).toBe(g.colors.length);
      g.colors.forEach((c) => expect(c, name).toMatch(COLOR));
      g.locations.forEach((at, i) => {
        expect(at, `${name}[${i}]`).toBeGreaterThanOrEqual(0);
        expect(at, `${name}[${i}]`).toBeLessThanOrEqual(1);
        if (i > 0) expect(at, `${name}[${i}]`).toBeGreaterThan(g.locations[i - 1] ?? 1);
      });
      expect(g.colors.at(-1), name).toBe(palettes[name].background);
    });
  });

  it('veils the no-photo bands harder on dark than on light', () => {
    for (const name of ['dark', 'light'] as const) {
      expect(stage.veil[name], name).toBeGreaterThan(0);
      expect(stage.veil[name], name).toBeLessThan(1);
    }
    expect(stage.veil.dark).toBeGreaterThan(stage.veil.light);
  });
});
