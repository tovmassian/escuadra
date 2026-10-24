---
paths:
  - "app/**"
  - "components/**"
  - "package.json"
  - "metro.config.js"
  - "app.json"
  - "plugins/**"
---

# Expo SDK 58

⚠️ **Expo has changed a lot between versions.** Read the exact versioned docs
at https://docs.expo.dev/versions/v58.0.0/ before writing any Expo code — not
the `latest` docs, which may describe APIs from a newer SDK this project
cannot use.

`expo-dev-client` is installed, and EAS Build produces development, simulator, preview and production builds; an SDK upgrade is a release decision (`fingerprint.md`).

## Android and Google Play

`plugins/withAndroidRelease.js` keeps what Play Console asks of the build (#203): R8 on
in release builds, and no `android:screenOrientation` in the manifest, which Android 16
ignores on large screens. `orientation` in `app.json` stays for iOS. Phones are held in
portrait by the root `Stack`'s `orientation` (`lib/screenOrientation.ts`), so a new
navigator sets it too. Its edits are tested in `plugins/__tests__/`.

## Since SDK 58

- RN 0.88's strict TypeScript API types a ref by its instance, not its component:
  `useRef<ViewInstance>(null)`, `Ref<ViewInstance>`, `ScrollViewInstance`, `TextInstance`,
  all type imports from `react-native`. `FlatList` is still a class, so
  `useRef<FlatList<T>>` stands. Deep imports from `react-native/Libraries/*` are type errors.
- `ImageSourcePropType` now admits readonly arrays, which `expo-image` refuses; a
  `require()`d image is `ImageRequireSource` (`scripts/gen-flags.ts`).
- `expo-router` makes `@expo/ui` and `expo-symbols` optional peers, and `web.output`
  defaults to `"server"`: `app.json` keeps `"static"`.
- Metro writes indexed source maps (`sections`), which `sourceMapSources` in
  `scripts/licences.ts` reads.
- Upgrading: when `npx expo install expo@^N --fix` stops on `ERESOLVE` against the old
  lockfile's pins, drop the lock entries of the packages it changed, then `npm install`.

## Since SDK 56

- `expo-router` (SDK 56+) no longer allows importing directly
  from `@react-navigation/*` in app code — import `ThemeProvider`/`DarkTheme`/
  `Theme` from `expo-router` itself instead. `DefaultTheme` is exported alongside
  `DarkTheme` and is the light theme's base.
- RN 0.86 removed `StyleSheet.absoluteFillObject` in favor of `StyleSheet.absoluteFill`.
