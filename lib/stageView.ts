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
 * A marker as vertical bands, under the in-round banner rule
 * (.claude/rules/team-identity.md): `orientation` is ignored.
 */
export function bannerBands(marker: TeamMarker): Band[] {
  return marker.bands.map((color, i) => ({ color, weight: marker.weights?.[i] ?? 1 }));
}

/** On-photo text over the stage's top bar holds at least this contrast. */
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
 * A `#rrggbb` colour at `alpha`, as `rgba(r,g,b,a)`: the hero's backing fades
 * the palette's ground in from clear (`stage.heroBacking`). Alpha is rounded
 * to two decimals. Anything but `#rrggbb` throws, as `relativeLuminance` does.
 */
export function withAlpha(hex: string, alpha: number): string {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error(`withAlpha: expected #rrggbb, got "${hex}"`);
  const [r, g, b] = [0, 1, 2].map((i) => channel(hex, i));
  return `rgba(${r},${g},${b},${Math.round(alpha * 100) / 100})`;
}

/**
 * How strongly the no-photo stage's veil darkens the team's bands.
 *
 * The answer is the stronger of two things:
 * - the theme's floor (`stage.veil`);
 * - the least veil, in hundredths, that gives the on-photo text colour
 *   (`onPhoto`) 3:1 on the lightest band. Real Madrid's white must still carry
 *   the top bar.
 */
export function stageVeil(bands: readonly Band[], theme: ThemeName): number {
  const { onPhoto, veilInk: ink } = palettes[theme];
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
    contrastRatio(onPhoto, veiled(lightest, ink, hundredths / 100)) < TOP_BAR_CONTRAST
  ) {
    hundredths++;
  }
  return hundredths / 100;
}

/**
 * The width actually served:
 * - for a thumbnail (a `/thumb/` URL), its `NNNpx-` step;
 * - for an unscaled original, the original's width, even when its file name
 *   happens to contain `-300px-`.
 *
 * Commons serves a few 720–959 px originals at a 500 px step (#112). The
 * served width decides the layout, so those are framed, not stretched.
 */
export function servedWidth(photo: PhotoCredit): number {
  if (!photo.url.includes('/thumb/')) return photo.width;
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
