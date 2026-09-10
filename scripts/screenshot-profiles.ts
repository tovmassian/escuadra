// The viewport/scale/output facts capture-screens.mjs needs per profile.
// Kept here, pure and dependency-free, so both the CLI flag parsing and the
// PNG dimension assertion can be unit-tested without spinning up a browser.

export interface Profile {
  readonly name: string;
  readonly viewport: { readonly width: number; readonly height: number };
  readonly deviceScaleFactor: number;
  readonly outDir: string;
  /** Non-null when a profile's output must land on an exact pixel size. */
  readonly expectedDimensions: { readonly width: number; readonly height: number } | null;
}

export const PROFILES: Record<'design' | 'store', Profile> = {
  design: {
    name: 'design',
    viewport: { width: 390, height: 844 }, // iPhone 14 logical size
    deviceScaleFactor: 2,
    outDir: 'design/screens',
    expectedDimensions: null,
  },
  store: {
    name: 'store',
    viewport: { width: 440, height: 956 },
    deviceScaleFactor: 3,
    outDir: 'design/store',
    // Apple's 6.9" class requirement — off-by-a-few is rejected at upload, not at review.
    expectedDimensions: { width: 1320, height: 2868 },
  },
};

const DEFAULT_PROFILE = 'design';

/** Reads `--profile=<name>` out of argv (default: design). Throws on an unrecognised name. */
export function resolveProfile(argv: readonly string[]): Profile {
  const flag = argv.find((arg) => arg.startsWith('--profile='));
  const name = flag ? flag.slice('--profile='.length) : DEFAULT_PROFILE;
  const profile = (PROFILES as Record<string, Profile | undefined>)[name];
  if (!profile) {
    throw new Error(
      `unknown --profile "${name}" — known profiles: ${Object.keys(PROFILES).join(', ')}`,
    );
  }
  return profile;
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
