// Metro config — web-only resolver override for zustand.
//
// Why this file exists:
//
// zustand@5's package.json declares an `exports` map with a `react-native`
// condition (used on iOS/Android via Expo Go) and an `import` condition
// (used everywhere else, i.e. web) but no `browser` condition. Expo's
// default Metro config turns on `unstable_enablePackageExports`, so on the
// web platform Metro follows the `import` condition and resolves
// `node_modules/zustand/esm/middleware.mjs` — which contains `import.meta`
// references. `node_modules/zustand/middleware.js` (the CJS build) has none.
//
// Metro's web output is a classic, non-module <script> tag, not an ES
// module, so `import.meta` is a syntax error there. A syntax error anywhere
// in the concatenated bundle aborts the *entire* script — so this doesn't
// just break the state stores, it silently kills ALL client-side JS on web.
// Server-rendered markup still paints, so the app *looks* like it's working
// right up until you tap anything.
//
// The fix: only for the web platform, and only for zustand module
// specifiers, resolve with package-exports resolution turned off. That
// makes Metro fall back to classic `main`/`browser`-field resolution, which
// finds the CJS build (no `import.meta`). Every other module, and both
// native platforms (ios/android), fall through to Expo's default resolver
// completely untouched — this must never affect what ships to Expo Go,
// since Expo Go on a physical iPhone is the only way this app runs.
//
// If this override is ever removed without also fixing zustand's exports
// map (or upgrading past whatever zustand version adds a `browser`
// condition), the web build will still bundle successfully — a syntax
// error inside a bundled dependency doesn't fail `expo start --web` at
// build time — it will just go back to being a blank, unresponsive page
// with every click silently doing nothing.
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const isZustand = moduleName === 'zustand' || moduleName.startsWith('zustand/');

  if (platform === 'web' && isZustand) {
    return (defaultResolveRequest ?? context.resolveRequest)(
      { ...context, unstable_enablePackageExports: false },
      moduleName,
      platform,
    );
  }

  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
