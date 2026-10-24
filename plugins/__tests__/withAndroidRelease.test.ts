import { describe, expect, it } from 'vitest';
import { pinMinify, unlockOrientation } from '../withAndroidRelease';

// The shapes @expo/config-plugins hands the mods: AndroidManifest.xml parsed by
// xml2js, and gradle.properties as a list of entries.
const manifest = (activity: Record<string, string>) => ({
  manifest: {
    application: [
      {
        $: { 'android:name': '.MainApplication' },
        activity: [{ $: { 'android:name': '.MainActivity', ...activity } }],
      },
    ],
  },
});

describe('unlockOrientation', () => {
  it('drops the portrait lock from MainActivity', () => {
    const result = unlockOrientation(
      manifest({ 'android:screenOrientation': 'portrait', 'android:exported': 'true' }),
    );
    expect(result.manifest.application[0]?.activity[0]?.$).toEqual({
      'android:name': '.MainActivity',
      'android:exported': 'true',
    });
  });

  it('leaves a manifest without a lock as it was', () => {
    const result = unlockOrientation(manifest({ 'android:exported': 'true' }));
    expect(result).toEqual(manifest({ 'android:exported': 'true' }));
  });
});

describe('pinMinify', () => {
  it('turns R8 on when the template leaves it off', () => {
    const result = pinMinify([
      { type: 'property', key: 'android.enableMinifyInReleaseBuilds', value: 'false' },
    ]);
    expect(result).toEqual([
      { type: 'property', key: 'android.enableMinifyInReleaseBuilds', value: 'true' },
    ]);
  });

  it('adds the property when the template does not write it', () => {
    const result = pinMinify([{ type: 'property', key: 'newArchEnabled', value: 'true' }]);
    expect(result).toEqual([
      { type: 'property', key: 'newArchEnabled', value: 'true' },
      { type: 'property', key: 'android.enableMinifyInReleaseBuilds', value: 'true' },
    ]);
  });
});
