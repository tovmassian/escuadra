import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { numberWall } from '@/theme/tokens';

// The advance width of each character, read from the TTF's cmap (format 4) and
// hmtx tables: enough of the format to check the wall's digit widths.
function advances(file: string, chars: string): Record<string, number> {
  const b = readFileSync(file);
  const tables: Record<string, number> = {};
  for (let i = 0; i < b.readUInt16BE(4); i++) {
    const o = 12 + i * 16;
    tables[b.toString('ascii', o, o + 4)] = b.readUInt32BE(o + 8);
  }
  const { cmap, hhea, hmtx } = tables as Record<'cmap' | 'hhea' | 'hmtx', number>;
  const metrics = b.readUInt16BE(hhea + 34);
  let sub = 0;
  for (let i = 0; i < b.readUInt16BE(cmap + 2); i++) {
    const off = b.readUInt32BE(cmap + 8 + i * 8);
    if (b.readUInt16BE(cmap + off) === 4) sub = cmap + off;
  }
  const segX2 = b.readUInt16BE(sub + 6);
  const ends = sub + 14;
  const starts = ends + segX2 + 2;
  const deltas = starts + segX2;
  const ranges = deltas + segX2;
  const glyph = (c: number) => {
    for (let i = 0; i < segX2 / 2; i++) {
      if (c > b.readUInt16BE(ends + i * 2)) continue;
      const start = b.readUInt16BE(starts + i * 2);
      if (c < start) return 0;
      const delta = b.readInt16BE(deltas + i * 2);
      const range = b.readUInt16BE(ranges + i * 2);
      if (range === 0) return (c + delta) & 0xffff;
      const g = b.readUInt16BE(ranges + i * 2 + range + (c - start) * 2);
      return g === 0 ? 0 : (g + delta) & 0xffff;
    }
    return 0;
  };
  return Object.fromEntries(
    [...chars].map((ch) => [ch, b.readUInt16BE(hmtx + Math.min(glyph(ch.charCodeAt(0)), metrics - 1) * 4)]),
  );
}

describe('numberWall', () => {
  it("holds Archivo ExtraCondensed Black's own digit advances", () => {
    const font = join(__dirname, '../../assets/fonts/archivo/Archivo-ExtraCondensedBlack.ttf');
    expect(numberWall.advance).toEqual(advances(font, '0123456789'));
  });
});
