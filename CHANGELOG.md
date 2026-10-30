# Changelog

What each version of Escuadra shipped, newest first, in the form of
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions are `app.json`'s.

A version's section is written when its release branch is cut, from the PRs in its
milestone ([`docs/release.md`](docs/release.md#cut-a-release)). An over-the-air change adds
its line to its version's section, under the category that fits and with the date it
shipped, in the change's own PR, or on `main` with its pick when the release branch has no
`CHANGELOG.md` ([`docs/release.md`](docs/release.md#ship-a-js-fix)).
Work on `main` that no release branch holds yet is not listed: its milestone is.

## [2.0.0] - Unreleased

The redesign: player photos, a rebuilt round, Results and Study, five languages and 157
national squads.

### Added

- Player photos from Wikimedia Commons in the round, Results and Study, where Commons has
  one, each credited (#112, #126).
- 157 national squads, up from 46, beside the 96 clubs (#162).
- Español, Français, Italiano and Deutsch beside English, following the phone or chosen in
  Settings (#141).
- Settings: language, appearance, vibration, usage statistics and Rate (#175).
- Share a round as a picture or as text (#114).
- Star a team to keep it in Your squads, on Home and in the team picker (#179, #181).
- Nations filtered by confederation (#177).
- How to play tips on the team picker, Difficulty, Study, the round and Results, the first
  time each one opens (#183, #184).
- Start a team over, clear all scores, or reset Escuadra (#197).
- A best score made before its squad was updated is marked outdated (#180).
- A one-second intro as the app opens (#182).
- Licences: every font, package and native library the app ships, with its licence (#156,
  #160).
- After an a la escuadra round, Escuadra may ask you to rate it, at most once per version
  (#57).
- Anonymous usage statistics, sent to TelemetryDeck unless switched off in Settings. About
  lists what they contain (#53, #221).

### Changed

- The question screen: the player's photo, or the team's colours when there is none, fills
  the top, the shirt number stands over it, and the clues under it show what each level
  asks (#113).
- Vibration on answers can be switched off in Settings (#113).
- Results are rebuilt: the misses are cards you swipe through, and an a la escuadra round
  shows all ten players (#114).
- Study shows the squad as cards or a list, with Hide names (#115).
- Home, the team picker and Difficulty are redesigned: Home is a wall of shirt numbers,
  nations are grouped A–Z with a letter rail, and Difficulty opens on the team's colours
  (#176, #178, #181).
- A new look, with Archivo as the display face (#111).
- VoiceOver starts each new question and part on its prompt (#226).
- VoiceOver says whether each answer was right or wrong (#247).
- Android: on tablets and other large screens, Escuadra turns with the screen (#203).

### Removed

- The Study These button on Results, which opened Study on the round's missed players
  alone. The missed players' cards on Results take its place (#114, #115).

### Fixed

- Android: bold text is drawn in the app's own fonts, not the system's (#117).

## [1.0.1] - 2026-10-11

Android only. On Google Play's closed test from 11 October 2026, and in production from
17 October 2026 (#51).

### Fixed

- Android: the adaptive icon's mark fits inside the safe zone (#93, #94).
- Over the air, 2026-10-11: the question screen fits short screens and clears the
  system navigation bar (#101).
- Over the air, 2026-10-13: Back on the team picker always returns to Home (#104).

## [1.0.0] - 2026-09-21

### Added

- 96 club and 46 national squads, and a team picker with search.
- Three difficulty levels, each a round of 10 questions.
- Results that show every miss, and Study, to look a squad over before playing it.
- Best scores kept on the device.
- Light and dark themes, following the device by default.
- About.
- Over the air, 2026-09-24: About shows the running update (#82).

### Changed

- Over the air, 2026-09-24: the next difficulty level is a Play card, and a level opens
  only when the one before it reaches the pass mark (#88).
- Over the air, 2026-09-25: Back and Exit read consistently, the active filter chip is
  legible in dark mode, and Missed Players can retry the round (#91).

### Fixed

- Over the air, 2026-10-11: the question screen fits short screens and clears the
  system navigation bar (#101).
- Over the air, 2026-10-13: Back on the team picker always returns to Home (#104).

[2.0.0]: https://github.com/tovmassian/escuadra/tree/release/2.0.0
[1.0.1]: https://github.com/tovmassian/escuadra/tree/release/1.0.1
[1.0.0]: https://github.com/tovmassian/escuadra/tree/release/1.0.0
