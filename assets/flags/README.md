# Flag images

214 national flag PNGs, one per FIFA three-letter country code (`ARG.png`,
`IRL.png`, `KOS.png`). 70×46 px each, ~1.1 MB in total.

Used for nation identity on the team picker, level-3 nationality answer
options, the `NAT` stat chip and the Study screen's affiliation column. See
`lib/flags.ts` for the name→code lookup and `assets/flags/generated.ts` for
the Metro require map.

Clubs never get an image here. CLAUDE.md hard constraint #2 bans crests,
badges, logos and shield shapes permanently; national flags are its only
carve-out, because the rule exists for trademark exposure and a flag carries
none.

## Resolution

70×46 is a near-exact fit for the picker marker (22×15 pt is 66×45 px at @3x)
and sufficient at the smaller sizes. There is no headroom: a hero-sized flag
would need larger source images.

## Adding a flag

Drop `<CODE>.png` in this directory, run `npm run gen:flags`, and add the
country's name to `FLAG_BY_NATIONALITY` in `lib/flags.ts`. `npm run check`
fails if either step is skipped.

## Provenance

TODO: origin and licence unknown. What is observable: 214 files, FIFA
three-letter codes, 70×46 px. This must be resolved before any App Store or
Play Store distribution. Not a v0 blocker — v0 is not distributed.
