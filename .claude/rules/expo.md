---
paths:
  - "app/**"
  - "components/**"
  - "package.json"
  - "metro.config.js"
---

# Expo SDK 57

⚠️ **Expo has changed a lot between versions.** Read the exact versioned docs
at https://docs.expo.dev/versions/v57.0.0/ before writing any Expo code — not
the `latest` docs, which may describe APIs from a newer SDK this project
cannot use.

`expo-dev-client` is installed, and EAS Build produces development, simulator, preview and production builds; an SDK upgrade is a release decision (`fingerprint.md`).

## Since SDK 56

- `expo-router` (SDK 56+) no longer allows importing directly
  from `@react-navigation/*` in app code — import `ThemeProvider`/`DarkTheme`/
  `Theme` from `expo-router` itself instead. `DefaultTheme` is exported alongside
  `DarkTheme` and is the light theme's base.
- RN 0.86 removed `StyleSheet.absoluteFillObject` in favor of `StyleSheet.absoluteFill`.
