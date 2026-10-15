// Pure view-model helpers for the question screen's spotlight stage (spec
// §2.6): the team-colour fallback's bands and veil, and whether a photo fills
// the stage or is framed. No React, so it is unit-tested in node.
import { contrastRatio, relativeLuminance } from './contrast';
import { palettes, stage, type ThemeName } from '@/theme/tokens';
import type { PhotoCredit, TeamMarker } from '@/types/squad';

export interface Band {
  color: string;
  weight: number;
}

/**
 * A marker as vertical bands, under the in-round banner rule (CLAUDE.md):
 * - `orientation` is ignored.
 * - A sole band with an overlay (Japan's disc, Brazil's diamond) becomes
 *   edge/middle/edge in the overlay's colour, because the shape does not
 *   survive the banner's proportions.
 */
export function bannerBands(marker: TeamMarker): Band[] {
  const sole = marker.bands.length === 1 ? marker.bands[0] : undefined;
  if (marker.overlay && sole !== undefined) {
    return [
      { color: sole, weight: 1 },
      { color: marker.overlay.color, weight: 1 },
      { color: sole, weight: 1 },
    ];
  }
  return marker.bands.map((color, i) => ({ color, weight: marker.weights?.[i] ?? 1 }));
}

/** White text over the stage's top bar holds at least this contrast. */
const TOP_BAR_CONTRAST = 3;

function channel(hex: string, i: number): number {
  return parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
}

/** `ink` laid over `hex` at `alpha`, blended in sRGB as the screen paints it. */
function veiled(hex: string, ink: string, alpha: number): string {
  const mixed = [0, 1, 2].map((i) =>
    Math.round(channel(hex, i) * (1 - alpha) + channel(ink, i) * alpha),
  );
  return `#${mixed.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * How strongly the no-photo stage's veil darkens the team's bands.
 *
 * The answer is the stronger of two things:
 * - the theme's floor (`stage.veil`);
 * - the least veil, in hundredths, that gives white text 3:1 on the lightest
 *   band. Real Madrid's white must still carry the top bar.
 */
export function stageVeil(bands: readonly Band[], theme: ThemeName): number {
  const ink = palettes[theme].veilInk;
  const floor = Math.round(stage.veil[theme] * 100);
  const lightest = bands.reduce<string | null>(
    (light, band) =>
      light === null || relativeLuminance(band.color) > relativeLuminance(light)
        ? band.color
        : light,
    null,
  );
  if (lightest === null) return floor / 100;
  let hundredths = floor;
  while (
    hundredths < 100 &&
    contrastRatio('#ffffff', veiled(lightest, ink, hundredths / 100)) < TOP_BAR_CONTRAST
  ) {
    hundredths++;
  }
  return hundredths / 100;
}

/**
 * The width actually served:
 * - for a thumbnail, its `NNNpx-` step;
 * - for an unscaled original, the original's width.
 *
 * Commons serves a few 720–959 px originals at a 500 px step (#112). The
 * served width decides the layout, so those are framed, not stretched.
 */
export function servedWidth(photo: PhotoCredit): number {
  const last = photo.url.slice(photo.url.lastIndexOf('/') + 1);
  const step = /(?:^|-)(\d+)px-/.exec(last)?.[1];
  return step === undefined ? photo.width : Math.min(Number(step), photo.width);
}

/** A photo at least this wide, as served, fills the stage (spec §2.6). */
export const FILL_MIN_WIDTH = 720;

export type PhotoLayout = 'fill' | 'frame';

/**
 * - `fill`: the photo fills the stage.
 * - `frame`: the photo is shown whole at 3:4, centred over its own copy,
 *   scaled to fill and darkened. Never stretched full-bleed.
 */
export function photoLayout(photo: PhotoCredit): PhotoLayout {
  return servedWidth(photo) >= FILL_MIN_WIDTH ? 'fill' : 'frame';
}
