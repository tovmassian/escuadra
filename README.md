# Escuadra

A football squad quiz for iOS. Expo SDK 54 + expo-router, TypeScript strict,
Zustand, Reanimated. Dark-only.

Runs in **Expo Go** — no Xcode, no Apple Developer account, no native build.

## Daily loop

```bash
npm run check
```

```bash
npx expo start
```

Scan the QR with the iPhone Camera app; it offers to open in Expo Go. Edit, save,
see it on the phone.

Useful keys in the Metro terminal: `r` reload · `m` dev menu · `j` DevTools ·
`Ctrl+C` stop. `npx expo start -c` clears the bundler cache.

## Scripts

| Script              | Does                                                        |
| ------------------- | ----------------------------------------------------------- |
| `npm run check`     | `typecheck` then `lint` — must be green before every commit |
| `npm run typecheck` | `tsc --noEmit`                                              |
| `npm run lint`      | `expo lint`                                                 |
| `npm run format`    | Prettier, write mode                                        |

## Layout

```
app/          expo-router routes (files = routes)
components/   shared UI; ui/ holds primitives
data/         static squad JSON
lib/          pure logic — no React, no store imports
stores/       Zustand: progress (persisted), session (ephemeral)
theme/        design tokens + font map
types/        shared domain types
```

`lib/` stays pure so the question engine and answer matching are unit-testable
without a renderer.

## Constraints worth knowing

- **Pinned to SDK 54 on purpose.** App Store Expo Go stops at 54; a newer SDK
  gives `Project is incompatible with this version of Expo Go`. The SDK 57
  upgrade belongs with the move to a dev client.
- **Fonts load at runtime** via `useFonts` in `app/_layout.tsx`. Expo Go cannot
  use the expo-font config plugin — that needs a prebuild.
- **Import fonts from per-weight subpaths** (`@expo-google-fonts/inter/700Bold`),
  never the package root. The root barrel pulls in every weight and italic.
- **No Moti.** It is built against Reanimated 3; this project is on Reanimated 4.
  Use Reanimated directly.

## Troubleshooting

| Symptom                               | Fix                                                                   |
| ------------------------------------- | --------------------------------------------------------------------- |
| QR scans but never connects           | Allow Node.js on **private** networks in Windows Firewall (port 8081) |
| Connects once then dies               | Settings → Privacy & Security → Local Network → Expo Go → on          |
| Phone and laptop can't see each other | Same Wi-Fi, no client isolation; else `npx expo start --tunnel`       |
| Animations do nothing                 | `npx expo start -c`                                                   |
| Stale code after adding a package     | `npx expo start -c`                                                   |
