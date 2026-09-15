// The viewport/scale/output facts capture-screens.mjs needs per profile.
// Kept here, pure and dependency-free, so both the CLI flag parsing and the
// PNG dimension assertion can be unit-tested without spinning up a browser.

export type ImageFormat = 'png' | 'jpeg';

export interface Profile {
  readonly name: string;
  readonly viewport: { readonly width: number; readonly height: number };
  readonly deviceScaleFactor: number;
  readonly outDir: string;
  readonly format: ImageFormat;
  /** Non-null when a profile's output must land on an exact pixel size. */
  readonly expectedDimensions: { readonly width: number; readonly height: number } | null;
}

export const PROFILES: Record<'design' | 'store' | 'play', Profile> = {
  design: {
    name: 'design',
    viewport: { width: 390, height: 844 }, // iPhone 14 logical size
    deviceScaleFactor: 2,
    outDir: 'design/screens',
    format: 'png',
    expectedDimensions: null,
  },
  store: {
    name: 'store',
    viewport: { width: 440, height: 956 },
    deviceScaleFactor: 3,
    outDir: 'design/store',
    format: 'png',
    // Apple's 6.9" class requirement — off-by-a-few is rejected at upload, not at review.
    expectedDimensions: { width: 1320, height: 2868 },
  },
  play: {
    name: 'play',
    // 360×640 is a common Android logical width, not chosen for that alone:
    // at 3x it lands on exactly 1080×1920, the 9:16 ratio Play requires for
    // promotion-eligible phone screenshots (its own "long side ≤ 2× short
    // side" minimum is looser and this satisfies it too).
    viewport: { width: 360, height: 640 },
    deviceScaleFactor: 3,
    outDir: 'design/play',
    // JPEG side-steps any ambiguity over Play's "24-bit PNG, no alpha" rule —
    // a JPEG has no alpha channel to get wrong.
    format: 'jpeg',
    expectedDimensions: { width: 1080, height: 1920 },
  },
};

const DEFAULT_PROFILE = 'design';

/** Reads `--profile=<name>` out of argv (default: design). Throws on an unrecognised name. */
export function resolveProfile(argv: readonly string[]): Profile {
  if (argv.includes('--profile')) {
    throw new Error(
      'unknown --profile flag: pass it as --profile=<name> (a single token), not a space-separated pair',
    );
  }
  const flag = argv.find((arg) => arg.startsWith('--profile='));
  const name = flag ? flag.slice('--profile='.length) : DEFAULT_PROFILE;
  if (!Object.hasOwn(PROFILES, name)) {
    throw new Error(
      `unknown --profile "${name}" — known profiles: ${Object.keys(PROFILES).join(', ')}`,
    );
  }
  // Object.hasOwn just proved `name` is one of PROFILES' own keys, so this
  // indexes by the closed key union rather than a generic string index
  // signature — no need to cast past noUncheckedIndexedAccess.
  return PROFILES[name as keyof typeof PROFILES];
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Reads the IHDR-chunk width/height out of a PNG buffer — no PNG-decoding dependency needed for that. */
export function readPngDimensions(buffer: Buffer): { width: number; height: number } {
  if (buffer.length < 24) {
    throw new Error(
      `PNG file truncated before IHDR (need at least 24 bytes, got ${buffer.length})`,
    );
  }
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('not a PNG file (bad signature)');
  }
  // IHDR is always the first chunk: signature(8) + length(4) + type(4), then
  // width and height as big-endian uint32s.
  const chunkType = buffer.toString('ascii', 12, 16);
  if (chunkType !== 'IHDR') {
    throw new Error(`expected IHDR as the first chunk, got "${chunkType}"`);
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

/**
 * Reads width/height out of a JPEG buffer by walking its marker segments to
 * the first SOF (start-of-frame) marker, where dimensions live — no
 * JPEG-decoding dependency needed for that. Handles the baseline/progressive
 * SOF variants (0xC0–0xC3, 0xC5–0xC7, 0xC9–0xCB, 0xCD–0xCF); JFIF/EXIF/quant/
 * huffman segments in between are skipped via their own length prefix.
 */
export function readJpegDimensions(buffer: Buffer): { width: number; height: number } {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    throw new Error('not a JPEG file (missing SOI marker)');
  }
  let offset = 2;
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) {
      throw new Error(`malformed JPEG: expected a marker at byte ${offset}`);
    }
    const marker = buffer[offset + 1];
    const isSofMarker =
      marker !== undefined &&
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 && // DHT (Huffman table), not a frame header
      marker !== 0xc8 && // JPG extension, reserved
      marker !== 0xcc; // DAC (arithmetic conditioning), not a frame header
    const segmentLength = buffer.readUInt16BE(offset + 2);
    if (isSofMarker) {
      // Segment: length(2) + precision(1) + height(2) + width(2) + ...
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + segmentLength;
  }
  throw new Error('malformed JPEG: no SOF marker found before end of buffer');
}

/** Throws if `dims` doesn't match the profile's required output size; no-op when the profile doesn't constrain dimensions. */
export function assertProfileDimensions(
  profile: Profile,
  dims: { width: number; height: number },
  filePath: string,
): void {
  const expected = profile.expectedDimensions;
  if (!expected) return;
  if (dims.width !== expected.width || dims.height !== expected.height) {
    throw new Error(
      `${filePath} is ${dims.width}×${dims.height}, expected exactly ${expected.width}×${expected.height} for the "${profile.name}" profile`,
    );
  }
}
