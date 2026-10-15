// WCAG 2 contrast between two opaque sRGB colours. Pure, so the token tests
// can hold text to AA and `stageVeil` (lib/stageView.ts) can keep white text
// legible on a team's real colours.

const HEX6 = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

function channel(byte: string): number {
  const s = parseInt(byte, 16) / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of a `#rrggbb` colour: 0 for black, 1 for white. */
export function relativeLuminance(hex: string): number {
  const match = HEX6.exec(hex);
  if (!match) throw new Error(`relativeLuminance: expected #rrggbb, got "${hex}"`);
  const [, r = '', g = '', b = ''] = match;
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio of two `#rrggbb` colours, from 1 to 21. Order does not matter. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
