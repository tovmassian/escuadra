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

Sourced from Wikipedia / Wikimedia Commons.

Wikipedia's own article content is licensed CC BY-SA 4.0. Media files hosted
on Commons are licensed individually rather than under one blanket licence,
and national flag images there are overwhelmingly public domain: a flag
design is generally either uncopyrightable or an official government insignia
released for free use. A minority of Commons flag renderings are contributed
under CC BY-SA, which requires attribution and share-alike.

⚠️ **The per-file licence of each of the 214 images here is unverified, and
v0 is going to the App Store and Play Store.** That makes this a release
blocker, not a nice-to-have: shipping an image whose licence you cannot name
is the risk the "no crests, ever" constraint exists to avoid, arriving by a
different door.

Resolving it means one of two things. Either establish the provenance of each
file and add an attribution screen for any that require one, or replace the
set wholesale with one carrying a single documented licence — see
`docs/superpowers/specs/2026-09-09-png-flags-design.md`. Until then, treat
these assets as unshippable.
