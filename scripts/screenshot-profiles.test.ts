import { describe, expect, it } from 'vitest';
import {
  PROFILES,
  assertProfileDimensions,
  readPngDimensions,
  resolveProfile,
} from './screenshot-profiles';

describe('resolveProfile', () => {
  it('defaults to the design profile with no flag', () => {
    expect(resolveProfile([])).toBe(PROFILES.design);
  });

  it('resolves --profile=store to the store profile', () => {
    expect(resolveProfile(['--profile=store'])).toBe(PROFILES.store);
  });

  it('resolves --profile=design explicitly', () => {
    expect(resolveProfile(['--profile=design'])).toBe(PROFILES.design);
  });

  it('throws on an unknown profile name, naming the known ones', () => {
    expect(() => resolveProfile(['--profile=ipad'])).toThrow(/unknown --profile "ipad"/);
    expect(() => resolveProfile(['--profile=ipad'])).toThrow(/design, store/);
  });

  it('ignores unrelated argv entries', () => {
    expect(resolveProfile(['--headless', '--profile=store', '--foo=bar'])).toBe(PROFILES.store);
  });
});

describe('PROFILES', () => {
  it('design profile has no dimension constraint — it is a handoff aid, not a store asset', () => {
    expect(PROFILES.design.expectedDimensions).toBeNull();
  });

  it('store profile targets exactly Apple 6.9" class dimensions', () => {
    expect(PROFILES.store.viewport).toEqual({ width: 440, height: 956 });
    expect(PROFILES.store.deviceScaleFactor).toBe(3);
    expect(PROFILES.store.expectedDimensions).toEqual({ width: 1320, height: 2868 });
    expect(PROFILES.store.outDir).toBe('design/store');
  });

  it('design profile keeps its current viewport and output directory', () => {
    expect(PROFILES.design.viewport).toEqual({ width: 390, height: 844 });
    expect(PROFILES.design.deviceScaleFactor).toBe(2);
    expect(PROFILES.design.outDir).toBe('design/screens');
  });
});

// A minimal buffer readPngDimensions can parse: real 8-byte PNG signature,
// then an IHDR chunk header (4-byte length + "IHDR") and width/height as
// big-endian uint32s. The remaining IHDR fields and CRC are irrelevant to a
// reader that only looks at width/height, so they're left zeroed.
function fakePng(width: number, height: number): Buffer {
  const buf = Buffer.alloc(29);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.writeUInt32BE(13, 8);
  buf.write('IHDR', 12, 'ascii');
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

describe('readPngDimensions', () => {
  it('reads width and height out of the IHDR chunk', () => {
    expect(readPngDimensions(fakePng(1320, 2868))).toEqual({ width: 1320, height: 2868 });
  });

  it('rejects a buffer with the wrong signature', () => {
    const buf = fakePng(100, 100);
    buf[0] = 0x00;
    expect(() => readPngDimensions(buf)).toThrow(/bad signature/);
  });

  it('rejects a buffer whose first chunk is not IHDR', () => {
    const buf = fakePng(100, 100);
    buf.write('IDAT', 12, 'ascii');
    expect(() => readPngDimensions(buf)).toThrow(/expected IHDR.*got "IDAT"/);
  });

  it('rejects a truncated buffer', () => {
    expect(() => readPngDimensions(Buffer.alloc(10))).toThrow(/not a PNG/);
  });
});

describe('assertProfileDimensions', () => {
  it('is a no-op for a profile with no dimension constraint', () => {
    expect(() =>
      assertProfileDimensions(PROFILES.design, { width: 780, height: 1688 }, 'x.png'),
    ).not.toThrow();
  });

  it('passes silently when dimensions match exactly', () => {
    expect(() =>
      assertProfileDimensions(PROFILES.store, { width: 1320, height: 2868 }, 'x.png'),
    ).not.toThrow();
  });

  it('throws, naming the file, the actual size and the expected size, on a mismatch', () => {
    expect(() =>
      assertProfileDimensions(
        PROFILES.store,
        { width: 1319, height: 2868 },
        'design/store/01-home.png',
      ),
    ).toThrow(/design\/store\/01-home\.png is 1319×2868, expected exactly 1320×2868/);
  });
});
