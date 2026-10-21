# Changelog

What each version of Escuadra shipped, newest first, in the form of
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions are `app.json`'s.

A version's section is written when its release branch is cut, from the PRs in its
milestone ([`docs/release.md`](docs/release.md#cut-a-release)). An over-the-air change adds
its line to its version's section, under the category that fits and with the date it
shipped, in the change's own PR.
Work on `main` that no release branch holds yet is not listed: its milestone is.

## [1.0.1] - 2026-10-11

Reached Google Play's closed test only, not production.

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

[1.0.1]: https://github.com/tovmassian/escuadra/tree/release/1.0.1
[1.0.0]: https://github.com/tovmassian/escuadra/tree/release/1.0.0
