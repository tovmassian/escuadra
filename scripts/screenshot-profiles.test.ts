import { describe, expect, it } from 'vitest';
import {
  PROFILES,
  assertProfileDimensions,
  readJpegDimensions,
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

  it('resolves --profile=play to the play profile', () => {
    expect(resolveProfile(['--profile=play'])).toBe(PROFILES.play);
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

  it('does not resolve a prototype-chain property name to an inherited value', () => {
    expect(() => resolveProfile(['--profile=constructor'])).toThrow(/unknown --profile/);
  });

  it('throws on a bare --profile token instead of silently defaulting to design', () => {
    expect(() => resolveProfile(['--profile', 'store'])).toThrow(/--profile=<name>/);
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
    expect(PROFILES.store.format).toBe('png');
  });

  it('play profile targets exactly the 9:16 Play promotion-eligible dimensions, as JPEG', () => {
    expect(PROFILES.play.viewport).toEqual({ width: 360, height: 640 });
    expect(PROFILES.play.deviceScaleFactor).toBe(3);
    expect(PROFILES.play.expectedDimensions).toEqual({ width: 1080, height: 1920 });
    expect(PROFILES.play.outDir).toBe('design/play');
    expect(PROFILES.play.format).toBe('jpeg');
  });

  it('design profile keeps its current viewport and output directory', () => {
    expect(PROFILES.design.viewport).toEqual({ width: 390, height: 844 });
    expect(PROFILES.design.deviceScaleFactor).toBe(2);
    expect(PROFILES.design.outDir).toBe('design/screens');
  });

  it('every constrained profile has a viewport×scale that actually produces its expectedDimensions', () => {
    for (const profile of Object.values(PROFILES)) {
      const expected = profile.expectedDimensions;
      if (!expected) continue;
      expect(profile.viewport.width * profile.deviceScaleFactor).toBe(expected.width);
      expect(profile.viewport.height * profile.deviceScaleFactor).toBe(expected.height);
    }
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

  it('rejects a truncated buffer with garbage content', () => {
    expect(() => readPngDimensions(Buffer.alloc(10))).toThrow(/truncated before IHDR/);
  });

  it('rejects a truncated buffer even with a valid PNG signature', () => {
    const buf = Buffer.alloc(16);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
    expect(() => readPngDimensions(buf)).toThrow(/truncated before IHDR/);
  });
});

// A minimal buffer readJpegDimensions can parse: SOI, then a baseline SOF0
// segment carrying precision/height/width, then EOI. Real JPEGs interleave
// JFIF/quant/Huffman segments before SOF0; the marker-length-skip loop in
// readJpegDimensions is what lets it walk past those without needing to
// understand them, so this fake only needs the one segment that matters.
function fakeJpeg(width: number, height: number): Buffer {
  const buf = Buffer.alloc(2 + 2 + 2 + 1 + 2 + 2 + 2);
  let offset = 0;
  buf.writeUInt8(0xff, offset++);
  buf.writeUInt8(0xd8, offset++); // SOI
  buf.writeUInt8(0xff, offset++);
  buf.writeUInt8(0xc0, offset++); // SOF0
  buf.writeUInt16BE(8, offset); // segment length (excludes the marker itself)
  offset += 2;
  buf.writeUInt8(8, offset++); // precision
  buf.writeUInt16BE(height, offset);
  offset += 2;
  buf.writeUInt16BE(width, offset);
  offset += 2;
  buf.writeUInt8(0xff, offset++);
  buf.writeUInt8(0xd9, offset); // EOI
  return buf;
}

describe('readJpegDimensions', () => {
  it('reads width and height out of the SOF0 segment', () => {
    expect(readJpegDimensions(fakeJpeg(1080, 1920))).toEqual({ width: 1080, height: 1920 });
  });

  it('skips a preceding marker segment (e.g. a JFIF/APP0 header) to reach SOF0', () => {
    const sof0 = fakeJpeg(1080, 1920);
    const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x04, 0x00, 0x00]); // 4-byte segment, no payload of interest
    expect(
      readJpegDimensions(Buffer.concat([sof0.subarray(0, 2), app0, sof0.subarray(2)])),
    ).toEqual({ width: 1080, height: 1920 });
  });

  it('rejects a buffer with the wrong signature', () => {
    const buf = fakeJpeg(100, 100);
    buf[0] = 0x00;
    expect(() => readJpegDimensions(buf)).toThrow(/missing SOI marker/);
  });

  it('rejects a buffer with no SOF marker before running out of bytes', () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xd9]); // SOI immediately followed by EOI
    expect(() => readJpegDimensions(buf)).toThrow(/no SOF marker found/);
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
