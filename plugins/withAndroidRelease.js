// What Google Play asks of the Android build (#203). Play Console flagged two
// things on 1.0.1:
//
// - The portrait lock in the manifest. Android 16 ignores it on tablets and
//   foldables, and Play counts it against large-screen support. It comes from
//   `orientation` in app.json, which iOS still needs, so it is removed here, on
//   Android only. Phones stay in portrait through the root Stack's
//   `orientation` (lib/screenOrientation.ts).
// - DEX obfuscation at 1%: R8 was off. SDK 58's template turns it on; this
//   pins it, so a template change cannot quietly turn it off again. Resource
//   shrinking stays off: React Native looks bundled images up by name, which
//   the shrinker cannot see.
//
// The edits are pure functions, tested in plugins/__tests__/.
const { withAndroidManifest, withGradleProperties } = require('expo/config-plugins');

const MINIFY = 'android.enableMinifyInReleaseBuilds';

/** @template {{ manifest: { application?: Array<{ activity?: Array<{ $: Record<string, string> }> }> } }} M
 *  @param {M} manifest @returns {M} */
function unlockOrientation(manifest) {
  for (const application of manifest.manifest.application ?? []) {
    for (const activity of application.activity ?? []) {
      delete activity.$['android:screenOrientation'];
    }
  }
  return manifest;
}

/** @param {Array<{ type: string, key?: string, value?: string }>} properties */
function pinMinify(properties) {
  const minify = properties.find((p) => p.type === 'property' && p.key === MINIFY);
  if (minify) minify.value = 'true';
  else properties.push({ type: 'property', key: MINIFY, value: 'true' });
  return properties;
}

/** @param {import('expo/config-plugins').ExpoConfig} config */
function withAndroidRelease(config) {
  config = withAndroidManifest(config, (mod) => {
    mod.modResults = unlockOrientation(mod.modResults);
    return mod;
  });
  return withGradleProperties(config, (mod) => {
    mod.modResults = pinMinify(mod.modResults);
    return mod;
  });
}

module.exports = withAndroidRelease;
module.exports.unlockOrientation = unlockOrientation;
module.exports.pinMinify = pinMinify;
