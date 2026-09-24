# Difficulty ladder: the next level expands into a Play card

Issue [#67](https://github.com/tovmassian/escuadra/issues/67). Ships as an OTA update on
`release/1.0.0`: JavaScript only, fingerprint unchanged.

Design canvas: <https://claude.ai/artifact/VDQD9sb58ZxBQfgqEmFHPK> (artboards "After — inline
expansion (next level)" and "After — inline expansion (all completed, replay)").

## Problem

Players on the difficulty screen don't see that a level is something to tap. Each level is
a small card whose only hint is an accent border, while "Study This Squad" below is a
bordered 56px button, so Study reads as the way forward. The ladder also leaves the lower
half of the screen empty.

## Design

**One list, always in level order.** Levels render 1, 2, 3 top to bottom, joined by the
existing `LadderConnector`. A level never moves out of its slot, so position on the ladder
always says where the player is, and the layout holds if levels are added later.

**One level is expanded; the rest are compact.**

- **Expanded (the focused level):** a large card with the level's title, its description
  and a full-width filled **Play** button. If the level already has a best score, the card
  shows the `BEST n/10` pill beside the title and the button reads **Play Again**.
- **Compact (every other level):** one line with badge, title and trailing status: the
  `BEST n/10` pill for a played level, the unlock hint (`CLEAR L1`) for a locked one. No
  description.

**Which level is focused** (a pure function of `ladderRows()`):

1. the first `unlocked` level, if there is one;
2. otherwise the last level that isn't `locked` (all played: the last level, as a replay);
3. otherwise level 1.

**One tap plays.** The expanded card's Play button starts its level. A compact played
level is itself a button and starts its level directly; tapping it does not move the
expansion. A locked level is dimmed (`opacity.disabled`) and not pressable.

**Study This Squad becomes a text link** (`Button variant="text"`), centred below the
ladder, so it no longer competes with Play.

**Badges size by state, not by level.** Expanded badge 48px, compact 32px, both centred in
one fixed-width column so the connector stays on a single axis. The old per-level escalation
(`badgeSize`, `difficultyTitleSize`, `difficultyTitleWeight`) is removed: the expanded card
is now what makes one level heavier than the others.

**Accessibility.** A compact row announces its state: "Name from Number, best 9 of 10" or
"Full Profile, locked, Clear L2". The Play button is a real button with its visible label.

## Out of scope

- The level copy (titles and descriptions) is unchanged.
- No new levels, no change to unlock rules or scoring.
- The screen does not become scrollable; three levels fit on the smallest supported phone.
  A fourth level would need a `ScrollView` and is a separate change.
