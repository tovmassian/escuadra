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
    throw new Error(`unknown --profile "${name}" — known profiles: ${Object.keys(PROFILES).join(', ')}`);
  }
  return profile;
}
