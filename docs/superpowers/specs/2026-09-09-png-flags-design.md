# PNG flags for national squads

Issue: tovmassian/escuadra#9. Branch: `design/png-flags`, off `data/ingest-new-squads`,
so it lands before national squad data is ingested.

## Problem

A nation's identity marker is currently declarative band geometry (`TeamMarker`).
That renders Spain and France well and Japan and Brazil acceptably, but it cannot
express a flag with a coat of arms, a canton, a saltire, or any non-band device.
As national squad coverage grows past the current six, the share of flags the
geometry misrepresents grows with it.

215 flag PNGs already sit in `assets/flags/`, uncommitted, named by FIFA three-letter
code (`ARG.png`, `IRL.png`), 70x46 px each, ~1.1 MB in total.

## Scope

Nations gain a PNG flag on four surfaces. Everything else is unchanged.

In scope:

- Team picker rows, for `kind: 'nation'` entries.
- Level-3 nationality answer options (club squads only).
- The `NAT` stat chip on levels 1-2 (club squads only).
- The Study screen's `NAT` affiliation column (club squads only).

Explicitly out of scope:

- The in-round banner on the question screen. It is 100x3 pt, far too thin for an
  image; nation squads keep their `marker` geometry and CLAUDE.md's "in-round team
  marker is always a vertical banner" rule stands unchanged.
- Any change to squad JSON, `data/index.json`, `scripts/gen-squads.ts`, or squadctl.
  No data migration.
- Any change to `lib/questionEngine.ts`.
- Flags for clubs. Clubs keep their banded marker; hard constraint #2's ban on
  crests, badges, logos and shield shapes is untouched and permanent.
- The level-3 *club* part on nation squads. A club has no flag.

## Constraint conflict, and its resolution

CLAUDE.md hard constraint #2 and the `TeamMarker` doc comment in `types/squad.ts`
both state that a nation's marker *is* its flag, "rendered as geometry rather than
an asset". This work changes that for four surfaces, so both documents are rewritten
as part of it.

The rationale recorded there survives and must be kept: it argues against Unicode
regional-indicator emoji, because Windows ships no flag-emoji font and the design
loop's Playwright capture runs on Windows Chrome. A committed PNG renders identically
on every platform, so `npm run shots` is unaffected. The geometry also survives — it
remains the identity element mid-round and for every club.

## Assets

All 215 PNGs are committed. `assets/flags/LIB.jpg` is deleted: it is 0 bytes, the
only non-PNG in the directory, and Lebanon appears in no squad data.

`assets/flags/README.md` records what is observable — 215 files, FIFA three-letter
codes, 70x46 px — with an explicit TODO for provenance and licence, to be filled in
before release. Origin is currently unknown.

Resolution is adequate but has no headroom. 70x46 is a near-exact fit for the picker
marker (22x15 pt is 66x45 px at @3x) and sufficient at the smaller sizes. A
hero-sized flag would need larger source images.

## Components

### `assets/flags/generated.ts` (generated)

Metro cannot resolve `require()` with a computed path, so every image needs a literal
require. `scripts/gen-flags.ts` scans `assets/flags/*.png` and emits:

```ts
export type FlagCode = 'AFG' | 'AIA' | /* ... */ 'ZIM';
export const FLAG_SOURCES: Record<FlagCode, ImageSourcePropType> = {
  AFG: require('./AFG.png'),
  // ...
};
```

Exposed as `npm run gen:flags` and wired into `npm run check` alongside `gen:squads`:
regenerate, then `git diff --exit-code`. A flag file dropped in without regenerating
fails the check.

### `lib/flags.ts`

The only place a name becomes a code. Pure — no React, no I/O, and no import of the
generated module, so it stays trivially unit-testable.

```ts
export const FLAG_BY_NATIONALITY: Record<string, FlagCode>;
export function flagFor(nationality: string): FlagCode | null;
```

`flagFor` returns `null` for an unmapped name, and every call site degrades to today's
text-only layout rather than showing a gap.

The map is hand-authored: it is knowledge, not derivable. It is chosen over an
explicit `flag` field on squad JSON because a field would require a data migration,
`gen-squads` changes, and squadctl learning to emit it — scope creep into the very
ingest pipeline this is meant to land ahead of — while player nationalities would
still need a lookup table regardless.

Naming drift is the risk this trades for, and a test is what covers it:
`lib/flags.test.ts` asserts that every distinct `player.nationality` in
`data/players.json` (94 values today) and every `kind: 'nation'` squad `name` resolves
to a code, and that every mapped code exists in `FLAG_SOURCES`. A newly ingested squad
whose name does not match the table fails the check.

### `components/Flag.tsx`

```tsx
<Flag code={code} size="marker" | "inline" | "row" />
```

An `expo-image` (already a dependency, `~57.0.4`) with `contentFit="cover"`,
`borderRadius: sizes.teamMarkerRadius`, and a hairline `colors.border` — the theme is
dark-only, and Japan's and Poland's white would otherwise bleed into the surface.
Renders nothing when `code` is null.

Three new `sizes` entries in `theme/tokens.ts`. No dimension is inlined, per the
token rule.

| Token        | Size    | Used by                            |
| ------------ | ------- | ---------------------------------- |
| `flagMarker` | 22 x 15 | Team picker rows                   |
| `flagInline` | 18 x 12 | `NAT` stat chip                    |
| `flagRow`    | 20 x 13 | Study rows, level-3 answer options |

`flagMarker` deliberately matches `sizes.teamMarker`, so a nation row and a club row
in the picker keep identical metrics.

## Call sites

**`components/TeamRow.tsx`** gains an optional `flag?: FlagCode | null`. When set it
renders `<Flag size="marker">` in place of `<TeamMarker>`. `app/team-picker.tsx`
passes `flagFor(entry.name)` for `kind: 'nation'` entries only; club entries pass
nothing and are untouched.

**`components/AnswerOption.tsx`** gains an optional `flag`, rendered as a leading
element before the label, inside the existing row. `app/play/[squadId]/[level]/index.tsx`
resolves it in the view: for `part.kind === 'nationality'`, `flagFor(label)`.

The question engine is not touched. Having it emit `{ label, flag }` option objects
would change `QuestionPart`'s shape and ripple through `lib/roundView.ts`, `PartRail`,
`CompletedPartPill` and their tests, for no gain — the view already holds the label,
and the mapping is a pure function of it.

**`components/StatChip.tsx`** gains an optional `flag`, leading. The play screen
passes it only for the `NAT` chip (`squad.kind === 'club'`), never for `CLUB`.

**`components/StudyRow.tsx`** gains an optional `flag`, leading in the affiliation
column. `app/team/[squadId]/study.tsx` passes it for club squads only.

`sizes.studyColumn.affiliation` is 92 and must now absorb a 20 pt flag plus its gap.
"Central African Republic" (24 chars) and "Bosnia and Herzegovina" (22) already
truncate at 92, so the text must not lose room: the column grows to
`92 + sizes.flagRow.width + spacing.xs`, and the name column — which has the most
slack — absorbs the difference. Truncation ends up no worse than today.

## Verification

- `lib/flags.test.ts` — resolution coverage in both directions, as described above.
- `npm run check` gains the `gen:flags` regenerate-and-diff step.
- `npm run shots` regenerated: the picker, question and study screens all change.
- Manual check on a physical iPhone via Expo Go, per the environment constraint.

## Risks

- **Bundle size.** ~1.1 MB of PNGs enter the JS bundle's asset set. Acceptable for an
  offline app with no other image assets; worth revisiting if v1's player photos land.
- **Naming drift** between `player.nationality` / squad `name` and the lookup table.
  Covered by the test, which fails the check rather than silently dropping a flag.
- **Unknown provenance.** The licence TODO in the assets README must be resolved
  before any store distribution. Not a v0 blocker — v0 is not distributed.
