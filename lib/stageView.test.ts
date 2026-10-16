import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast';
import {
  bannerBands,
  FILL_MIN_WIDTH,
  photoLayout,
  servedWidth,
  stageVeil,
  withAlpha,
} from './stageView';
import { palettes, stage } from '@/theme/tokens';
import type { PhotoCredit, Squad } from '@/types/squad';

const squad = (file: string) =>
  JSON.parse(
    readFileSync(path.join(import.meta.dirname, '..', 'data', 'squads', file), 'utf8'),
  ) as Squad;

/** sRGB blend of `ink` over `hex` at `alpha`, as the veil paints it. */
function veiled(hex: string, ink: string, alpha: number): string {
  const ch = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2]
    .map((i) => Math.round(ch(hex, i) * (1 - alpha) + ch(ink, i) * alpha))
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')}`;
}

describe('bannerBands', () => {
  it("keeps a marker's bands and weights, whatever its orientation", () => {
    expect(bannerBands(squad('nation/esp.json').marker)).toEqual([
      { color: '#AA151B', weight: 1 },
      { color: '#F1BF00', weight: 2 },
      { color: '#AA151B', weight: 1 },
    ]);
  });

  it('turns a sole band with an overlay into edge, middle, edge', () => {
    expect(bannerBands(squad('nation/jpn.json').marker)).toEqual([
      { color: '#FFFFFF', weight: 1 },
      { color: '#BC002D', weight: 1 },
      { color: '#FFFFFF', weight: 1 },
    ]);
  });
});

describe('stageVeil', () => {
  for (const theme of ['dark', 'light'] as const) {
    it(`never goes below the ${theme} floor`, () => {
      expect(stageVeil([{ color: '#12141a', weight: 1 }], theme)).toBe(stage.veil[theme]);
    });

    // Spec §2.6: Real Madrid's white must still carry the top bar.
    it(`gives on-photo text 3:1 on Real Madrid's white, ${theme}`, () => {
      const bands = bannerBands(squad('club/la-liga/rma.json').marker);
      const alpha = stageVeil(bands, theme);
      const { onPhoto, veilInk } = palettes[theme];
      expect(contrastRatio(onPhoto, veiled('#ffffff', veilInk, alpha))).toBeGreaterThanOrEqual(3);
      expect(alpha).toBeGreaterThan(stage.veil[theme]);
    });

    it(`raises the veil no further than it must, ${theme}`, () => {
      const bands = bannerBands(squad('nation/esp.json').marker);
      const alpha = stageVeil(bands, theme);
      const { onPhoto, veilInk } = palettes[theme];
      if (alpha > stage.veil[theme]) {
        expect(contrastRatio(onPhoto, veiled('#F1BF00', veilInk, alpha - 0.01))).toBeLessThan(3);
      }
      expect(contrastRatio(onPhoto, veiled('#F1BF00', veilInk, alpha))).toBeGreaterThanOrEqual(3);
    });
  }
});

describe('the hero backing', () => {
  // The worst photo for each theme's number: white under dark's white
  // number, black under light's near-black one.
  const worstPhoto = { dark: '#ffffff', light: '#000000' } as const;

  for (const theme of ['dark', 'light'] as const) {
    it(`keeps the shirt number at 3:1 over the worst photo, ${theme}`, () => {
      const { background, onStage } = palettes[theme];
      const ground = veiled(worstPhoto[theme], background, stage.heroBacking.top[theme]);
      expect(contrastRatio(onStage, ground)).toBeGreaterThanOrEqual(3);
    });
  }

  it('starts clear above the hero and partly opaque at its top edge', () => {
    expect(stage.heroBacking.rise).toBeGreaterThan(0);
    for (const theme of ['dark', 'light'] as const) {
      expect(stage.heroBacking.top[theme], theme).toBeGreaterThan(0);
      expect(stage.heroBacking.top[theme], theme).toBeLessThan(1);
    }
  });
});

describe('withAlpha', () => {
  it('writes a #rrggbb colour as rgba with no spaces', () => {
    expect(withAlpha('#12141a', 0.55)).toBe('rgba(18,20,26,0.55)');
    expect(withAlpha('#F7F7F9', 1)).toBe('rgba(247,247,249,1)');
    expect(withAlpha('#000000', 0)).toBe('rgba(0,0,0,0)');
  });

  it('rounds alpha to two decimals', () => {
    expect(withAlpha('#ffffff', 0.123456)).toBe('rgba(255,255,255,0.12)');
    expect(withAlpha('#ffffff', 0.666)).toBe('rgba(255,255,255,0.67)');
  });

  it('throws on anything but #rrggbb', () => {
    expect(() => withAlpha('#fff', 0.5)).toThrow(/#rrggbb/);
    expect(() => withAlpha('rgba(255,255,255,0.1)', 0.5)).toThrow(/#rrggbb/);
    expect(() => withAlpha('12141a', 0.5)).toThrow(/#rrggbb/);
  });
});

const photo = (url: string, width: number): PhotoCredit => ({
  file: 'X.jpg',
  url,
  width,
  height: Math.round(width * 1.4),
  author: null,
  licence: 'CC0',
  licenceUrl: null,
});
const THUMB = (step: number) =>
  `https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/X.jpg/${step}px-X.jpg`;
const ORIGINAL = 'https://upload.wikimedia.org/wikipedia/commons/a/ab/X.jpg';

describe('servedWidth and photoLayout', () => {
  it("reads a thumbnail's width from its URL", () => {
    expect(servedWidth(photo(THUMB(960), 3333))).toBe(960);
    expect(servedWidth(photo(THUMB(500), 859))).toBe(500);
  });

  it("uses the original's width for an unscaled original", () => {
    expect(servedWidth(photo(ORIGINAL, 722))).toBe(722);
  });

  // Only a /thumb/ URL carries a step. A file name that merely contains
  // `-300px-` is an original, served at its own width.
  it('ignores an NNNpx- in the file name of an unscaled original', () => {
    const odd = 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Foo-300px-Bar.jpg';
    expect(servedWidth(photo(odd, 900))).toBe(900);
    expect(photoLayout(photo(odd, 900))).toBe('fill');
  });

  it(`fills the stage from ${FILL_MIN_WIDTH} px served, frames anything smaller`, () => {
    expect(photoLayout(photo(THUMB(960), 3333))).toBe('fill');
    expect(photoLayout(photo(ORIGINAL, 722))).toBe('fill');
    expect(photoLayout(photo(ORIGINAL, 480))).toBe('frame');
  });

  it('switches from frame to fill at the served-width boundary', () => {
    expect(photoLayout(photo(ORIGINAL, FILL_MIN_WIDTH - 1))).toBe('frame');
    expect(photoLayout(photo(ORIGINAL, FILL_MIN_WIDTH))).toBe('fill');
    expect(photoLayout(photo(THUMB(FILL_MIN_WIDTH - 1), 3333))).toBe('frame');
    expect(photoLayout(photo(THUMB(FILL_MIN_WIDTH), 3333))).toBe('fill');
  });

  // #112: Commons serves some 720–959 px originals at a 500 px step. The
  // served width decides, so these are framed, not stretched.
  it('frames a large original Commons served small', () => {
    expect(photoLayout(photo(THUMB(500), 859))).toBe('frame');
  });
});
