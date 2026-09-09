# Flag images

106 national flag PNGs, one per FIFA three-letter country code (`ARG.png`,
`IRL.png`, `KOS.png`). 160 px wide, ~424 KB in total.

Used for nation identity on the team picker, level-3 nationality answer
options, the `NAT` stat chip and the Study screen's affiliation column. See
`lib/flags.ts` for the name→code lookup and `assets/flags/generated.ts` for
the Metro require map.

Clubs never get an image here. CLAUDE.md hard constraint #2 bans crests,
badges, logos and shield shapes permanently; national flags are its only
carve-out, because the rule exists for trademark exposure and a flag carries
none.

## Licence

Source: [flagpedia.net](https://flagpedia.net) / flagcdn.com.

> "Flag images are in the public domain (exempt from copyright). They are
> completely free for non-commercial and even commercial use."

Public domain, commercial use permitted, no attribution required. This is the
whole licence position for every file in this directory — there is no per-file
variation to check, which is exactly why this set was chosen: v0 ships to the
App Store and Play Store, and a set whose provenance could not be named was
not shippable.

This set replaced an earlier 214-file set of unverified origin. Do not
reintroduce images from an unnamed source, however convenient — a flag whose
licence you cannot state is a release blocker, not a detail.

## Resolution

160 px wide. The largest on-screen use is `sizes.flagMarker` at 22 pt, which
is 66 px at @3x, so there is roughly 2.4× headroom — enough for a larger
treatment later without resourcing.

Aspect ratios are each flag's true ratio, not normalised: most are 3:2, but
England and Scotland are 5:3 and Northern Ireland is 2:1. `components/Flag.tsx`
renders with `contentFit="cover"` into a 3:2-ish box, so a non-3:2 flag is
cropped a few percent at the sides. Invisible at these sizes; revisit if flags
ever get a hero treatment, where `contain` with a matched box would be better.

## Adding a flag

Only the flags the squad data actually needs are committed, so a new nation or
a new player nationality may need one. `lib/flags.test.ts` fails with the
missing name when that happens.

1. Find the country's ISO 3166-1 alpha-2 code (UK home nations are `gb-eng`,
   `gb-sct`, `gb-wls`, `gb-nir`; Kosovo is `xk`).
2. `curl -o assets/flags/<FIFA>.png https://flagcdn.com/w160/<iso>.png`
3. `npm run gen:flags`
4. Add the country's name to `FLAG_BY_NATIONALITY` in `lib/flags.ts`.

`npm run check` fails if step 3 or 4 is skipped.
