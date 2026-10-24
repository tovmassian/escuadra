import { describe, expect, it } from 'vitest';
import {
  NATIVE_ALLOWED_LICENCES,
  buildNativeData,
  catalogCoordinates,
  gradleCoordinates,
  matchesPattern,
  podDependencies,
  podspecName,
  type NativeEntry,
  type NativeScan,
} from '../native-licences';

const MIT = 'MIT License\n\nCopyright (c) 2016 Someone\n\nPermission is hereby granted.\n';
const APACHE = 'Apache License\nVersion 2.0, January 2004\n';
const texts: Record<string, string> = {
  'scripts/licence-texts/native/a.LICENSE': MIT,
  'scripts/licence-texts/native/apache-2.0.LICENSE': APACHE,
};
const readText = (file: string): string => {
  const text = texts[file];
  if (text === undefined) throw new Error(`no such file: ${file}`);
  return text;
};
const entry = (over: Partial<NativeEntry> = {}): NativeEntry => ({
  licence: 'MIT',
  platforms: ['ios'],
  found: 'scan',
  matches: { ios: ['A*'] },
  via: 'expo-image',
  copyright: 'Copyright (c) 2016 Someone',
  files: [{ file: 'scripts/licence-texts/native/a.LICENSE', url: 'https://example.org/a/LICENSE' }],
  ...over,
});
const scan = (over: Partial<NativeScan> = {}): NativeScan => ({
  ios: ['ALib'],
  android: [],
  vendoredLicenceFiles: [],
  notLinked: {},
  ...over,
});

describe('podDependencies', () => {
  it('reads s., spec. and ss. dependencies, reduced to their root pod', () => {
    const podspec = [
      'Pod::Spec.new do |s|',
      "  s.dependency 'ExpoModulesCore'",
      "  s.dependency 'SDWebImage', '~> 5.21.0'",
      "  s.dependency 'libavif/libdav1d' unless disable_libdav1d",
      '  spec.dependency "boost"',
      "  s.subspec 'x' do |ss|",
      "    ss.dependency 'React-Core/Default'",
      '  end',
      "  s.test_spec 'Tests' do |test_spec|",
      "    test_spec.dependency 'OHHTTPStubs'",
      '  end',
      'end',
    ].join('\n');
    expect(podDependencies(podspec)).toEqual([
      'ExpoModulesCore',
      'SDWebImage',
      'libavif',
      'boost',
      'React-Core',
    ]);
  });
  it('ignores commented-out lines', () => {
    expect(podDependencies("  # s.dependency 'Old'\n  s.dependency 'New'")).toEqual(['New']);
  });
});

it('names a pod by its podspec file', () => {
  expect(podspecName('RCT-Folly.podspec')).toBe('RCT-Folly');
});

describe('gradleCoordinates', () => {
  it('reads implementation and api coordinates, quoted either way, with or without parentheses', () => {
    const gradle = [
      'dependencies {',
      '  implementation "com.google.android.play:review:2.0.1"',
      "  api 'com.caverock:androidsvg-aar:1.4'",
      '  api "com.github.bumptech.glide:glide:${GLIDE_VERSION}"',
      '  implementation("com.squareup.okhttp3:okhttp:4.9.2")',
      "  implementation 'com.facebook.react:react-native:+'",
      '  implementation "com.facebook.react:react-android"',
      "  implementation project(':expo-modules-core')",
      '  debugImplementation "com.example:debug-only:1.0"',
      '  testImplementation "junit:junit:4.13"',
      '  compileOnly "com.example:compile-only:1.0"',
      '}',
    ].join('\n');
    expect(gradleCoordinates(gradle)).toEqual([
      'com.google.android.play:review',
      'com.caverock:androidsvg-aar',
      'com.github.bumptech.glide:glide',
      'com.squareup.okhttp3:okhttp',
      'com.facebook.react:react-native',
      'com.facebook.react:react-android',
    ]);
  });
  it('ignores commented-out lines', () => {
    expect(gradleCoordinates('  // implementation "a:b:1"\n  implementation "c:d:1"')).toEqual([
      'c:d',
    ]);
  });
});

describe('catalogCoordinates', () => {
  it('maps libs.x aliases through the [libraries] table, module or group/name form', () => {
    const toml = [
      '[versions]',
      'fresco = "3.6.0"',
      '[libraries]',
      'fresco-middleware = { module = "com.facebook.fresco:middleware", version.ref = "fresco" }',
      'androidx-profileinstaller = { group = "androidx.profileinstaller", name = "profileinstaller", version.ref = "p" }',
      'junit = {module = "junit:junit", version.ref = "junit" }',
      '[plugins]',
    ].join('\n');
    const kts = [
      '  api(libs.fresco.middleware)',
      '  implementation(libs.androidx.profileinstaller)',
      '  testImplementation(libs.junit)',
    ].join('\n');
    expect(catalogCoordinates(kts, toml)).toEqual([
      'com.facebook.fresco:middleware',
      'androidx.profileinstaller:profileinstaller',
    ]);
  });
  it('fails on an alias the catalog does not define', () => {
    expect(() => catalogCoordinates('api(libs.nope)', '[libraries]\n')).toThrow(/libs\.nope/);
  });
});

describe('matchesPattern', () => {
  it('matches exactly without a star', () => {
    expect(matchesPattern('SDWebImage', 'SDWebImage')).toBe(true);
    expect(matchesPattern('SDWebImageWebPCoder', 'SDWebImage')).toBe(false);
  });
  it('lets a star match any run, dots included', () => {
    expect(matchesPattern('androidx.core:core-ktx', 'androidx.*:*')).toBe(true);
    expect(matchesPattern('org.jetbrains.kotlin:kotlin-stdlib', 'org.jetbrains.kotlin:*')).toBe(
      true,
    );
    expect(
      matchesPattern('org.jetbrains.kotlinx:kotlinx-coroutines-core', 'org.jetbrains.kotlin:*'),
    ).toBe(false);
  });
});

it('allows exactly the licences, the two compound expressions and the two Google terms the owner accepted', () => {
  expect([...NATIVE_ALLOWED_LICENCES].sort()).toEqual(
    [
      'Android Software Development Kit License',
      'Apache-2.0',
      'Apache-2.0 WITH LLVM-exception',
      'Apache-2.0 WITH LLVM-exception AND NCSA',
      'BSD-2-Clause',
      'BSD-2-Clause-Views',
      'BSD-3-Clause',
      'BSL-1.0',
      'IJG',
      'IJG AND BSD-3-Clause AND Zlib',
      'ISC',
      'LicenseRef-Public-Domain',
      'LicenseRef-scancode-unicode-mappings',
      'MIT',
      'MPL-2.0',
      'NCSA',
      'Play Core Software Development Kit Terms of Service',
      'Unlicense',
      'Zlib',
      'bzip2-1.0.6',
      'dtoa',
    ].sort(),
  );
});

describe('buildNativeData', () => {
  it('builds a sorted list with interned texts, appended after the existing ones', () => {
    const data = buildNativeData(
      {
        Zeta: entry({ matches: { ios: ['Zeta'] } }),
        Alpha: entry({ matches: { ios: ['ALib'] } }),
      },
      scan({ ios: ['ALib', 'Zeta'] }),
      ['existing text'],
      readText,
    );
    expect(data.texts).toEqual(['existing text', MIT.trim()]);
    expect(data.libraries.map((l) => l.name)).toEqual(['Alpha', 'Zeta']);
    expect(data.libraries[0]).toEqual({
      name: 'Alpha',
      platforms: ['ios'],
      licence: 'MIT',
      copyright: 'Copyright (c) 2016 Someone',
      texts: [1],
    });
  });

  it('reuses an existing text index for an identical text', () => {
    // The package half hands over its texts already normalised (trimmed).
    const data = buildNativeData({ A: entry() }, scan(), [MIT.trim()], readText);
    expect(data.libraries[0]?.texts).toEqual([0]);
  });

  it('accepts a proprietary Google entry with no text', () => {
    const data = buildNativeData(
      {
        'Google Play In-App Review': entry({
          licence: 'Play Core Software Development Kit Terms of Service',
          platforms: ['android'],
          matches: { android: ['com.google.android.play:*'] },
          copyright: 'Google LLC',
          files: [],
        }),
      },
      scan({ ios: [], android: ['com.google.android.play:review'] }),
      [],
      readText,
    );
    expect(data.libraries[0]?.texts).toEqual([]);
  });

  it('skips a dependency named in notLinked', () => {
    expect(() =>
      buildNativeData(
        { A: entry() },
        scan({ ios: ['ALib', 'sqlite3'], notLinked: { sqlite3: 'why' } }),
        [],
        readText,
      ),
    ).not.toThrow();
  });

  it('lists every problem at once', () => {
    const run = () =>
      buildNativeData(
        {
          Bad: entry({ licence: 'GPL-3.0', matches: { ios: ['Bad'] } }),
          NoText: entry({ matches: { ios: ['NoText'] }, files: [] }),
          NoCopyright: entry({ matches: { ios: ['NoCopyright'] }, copyright: '' }),
          Dead: entry({ matches: { ios: ['Gone'] } }),
          Inventory: entry({ found: 'inventory', matches: { android: ['x:y'] } }),
          Vendored: entry({
            found: 'vendored',
            matches: {},
            vendored: ['node_modules/p/android/LICENSE'],
          }),
        },
        scan({
          ios: ['Bad', 'NoText', 'NoCopyright', 'Unlisted'],
          vendoredLicenceFiles: ['node_modules/p/android/LICENSE', 'node_modules/q/ios/LICENSE'],
        }),
        [],
        readText,
      );
    expect(run).toThrow(/6 problem\(s\)/);
    expect(run).toThrow(/Bad: licence "GPL-3.0" is not on the native allowlist/);
    expect(run).toThrow(/NoText: an open licence needs its text/);
    expect(run).toThrow(/NoCopyright: no copyright/);
    expect(run).toThrow(/Dead: found by "scan", but no scanned dependency matches it/);
    expect(run).toThrow(/ios dependency "Unlisted" is not in scripts\/native-licences\.json/);
    expect(run).toThrow(
      /node_modules\/q\/ios\/LICENSE: a licence file inside a native folder that no entry claims/,
    );
  });

  it('does not report inventory or vendored entries as dead', () => {
    expect(() =>
      buildNativeData(
        { A: entry(), I: entry({ found: 'inventory', matches: { android: ['x:y'] } }) },
        scan(),
        [],
        readText,
      ),
    ).not.toThrow();
  });
});
