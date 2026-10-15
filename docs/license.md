# Licences

What every image and font Escuadra ships is licensed under, which licences the
player photos may carry and why the others are refused, and how the rule is
enforced. Read this before you add an asset, accept a new licence, or touch the
photo credit. It is a working guide for this project, not legal advice: when
something here does not settle a question, stop and ask the owner — asset
licensing is a legal guardrail in `CLAUDE.md`, never worked around.

**The rule:** every image the app shows must have a licence someone can name,
and the app must do what that licence asks.

## The ideas you need

### Copyright is the default

A photo is protected the moment it is taken. With no licence, the only lawful
use is the photographer's own. "It's on the internet" and "it's on Wikipedia"
grant nothing; a licence does.

### A licence is permission with conditions

A licence says what you may do and what you must do in return. Most of what
Escuadra uses is a Creative Commons (CC) licence, built from four elements:

| element | name          | it asks                                                    |
| ------- | ------------- | ---------------------------------------------------------- |
| **BY**  | Attribution   | credit the creator, link the licence, say what you changed |
| **SA**  | ShareAlike    | license your adaptation of the work under the same licence |
| **NC**  | NonCommercial | no commercial use at all                                   |
| **ND**  | NoDerivatives | no adaptations — not even a crop                           |

Every CC licence includes BY. **CC BY** is attribution only; **CC BY-SA** adds
ShareAlike. ShareAlike binds adaptations of the photo itself — our crop of it
— not the app around it: a photo shown on a screen does not make the screen a
derivative of the photo.

### Versions and ports

CC licences come in versions — 2.0, 2.5, 3.0, 4.0 — whose wording differs, so
a credit names the exact one. Versions before 4.0 also came in national
"ports" adapted to one country's law: `CC BY-SA 3.0 at` is the Austrian port,
`CC BY 3.0 br` the Brazilian, `IGO` the one for intergovernmental
organisations. 4.0 is international and has none. A port grants the same
freedoms as its original.

### Public domain, CC0 and the Public Domain Mark

- **Public domain**: no copyright at all — it expired, or the work was never
  protected. Nothing is asked of you.
- **CC0**: a creator waiving their rights, as close to the public domain as the
  law allows. Nothing is asked of you.
- **Public Domain Mark (PDM)**: a _label_ saying a work is already free of
  copyright. It waives nothing, so it is not how an owner gives up their rights
  (that is CC0).

Public domain status also depends on the country: a work can be free in one
and protected in another.

### Hotlinking changes nothing

Escuadra stores no copies of photos — it loads Wikimedia's own thumbnail each
time — but the licence still applies wherever the image is _displayed_. Not
hosting a file removes no duty to credit it.

### What a credit must carry

Creative Commons' rule of thumb is **TASL**: Title, Author, Source, Licence. CC
4.0 lets you meet it "in any reasonable manner based on the medium", including
by linking a page that carries the information; earlier versions ask for credit
"reasonable to the medium" too. Two more duties: link the licence, and say if
you changed the work.

## What Escuadra ships

| asset                          | licence                                         | source of truth                          |
| ------------------------------ | ----------------------------------------------- | ---------------------------------------- |
| Squad data                     | Wikipedia CC BY-SA; Wikidata CC0                | `data/squads/`, `tools/squadctl/`        |
| Player photos                  | per photo — see the next section                | `player.photo` in `data/players.json`    |
| National flags                 | public domain (flagpedia.net)                   | `assets/flags/README.md`                 |
| Inter, IBM Plex Mono           | SIL Open Font License 1.1                       | `@expo-google-fonts/*` in `package.json` |
| Archivo (three static cuts)    | SIL Open Font License 1.1                       | `assets/fonts/archivo/README.md`         |
| App Store / Google Play badges | Apple's and Google's artwork, under their rules | `CLAUDE.md`, guardrail 2                 |
| Club crests, badges, logos     | **never** — trademarks, whatever their licence  | `CLAUDE.md`, guardrail 2                 |

The flag set replaced an earlier set nobody could name a source for; a flag
whose licence you cannot state is a release blocker. The OFL lets the app
bundle the fonts, provided their copyright notice and licence travel with them,
which they do inside each font file. Archivo's cuts are generated from its
variable font, which makes them a Modified Version under the OFL: allowed, and
under the Archivo name, because Archivo declares no Reserved Font Name. They
stay under the OFL, with `OFL.txt` beside them. The store badges may be used
only unmodified and only for a store where the app is live, with Apple's and
Google's credit lines on the site.

Squad data — names, numbers, positions, dates — is facts, not images. squadctl
takes the facts from Wikipedia and Wikidata (Wikidata is CC0), not article
text.

## Player photos: the licences we accept

Photos come from Wikimedia Commons, which hosts only freely licensed files.
`squadctl enrich` stores a photo only under one of these (counts are the 2,199
photos stored on 2026-10-15):

| licence                                        | photos | what it asks                              |
| ---------------------------------------------- | -----: | ----------------------------------------- |
| CC BY-SA, any version or port (4.0, 3.0, 2.0…) |  1,373 | credit, licence link, changes; ShareAlike |
| CC BY, any version or port                     |    332 | credit, licence link, changes             |
| CC0                                            |    435 | nothing                                   |
| Public domain (exactly that)                   |     47 | nothing                                   |
| Attribution (Commons' attribution-only)        |     12 | credit the copyright holder **by name**   |

"Attribution" is a Commons licence of its own: "anyone may use it for any
purpose, provided that the copyright holder is properly attributed". It was
accepted on 2026-10-14 (#108) after its wording was read — on the one
condition it sets, so a photo under it with no named holder is refused.

### How the credit meets them

Every photo shows, under the question's action button for as long as the
question is on screen:

> Photo: <u>Bryan Berlin / WikiPortraits</u> · <u>CC BY-SA 4.0</u> · cropped

- **Author** — the name Commons records in its `Attribution` field (the credit
  the licensor asks for, such as a photo agency's name), else the author. It
  links the file's Commons page, which carries the title, the full author line
  and the licence: the TASL a phone screen has no room for, one tap away.
- **Licence** — its exact short name, linking the licence deed, or the Commons
  page when there is no deed (public domain).
- **cropped** — the change we make: every screen crops the photo to its frame.

The **title is deliberately left out**. A Commons file name or caption names
the player, and showing it would answer the question (`CLAUDE.md`, guardrail 1).
The link supplies it instead.

When Commons names no one — an unknown-author template, or an author field so
long it is a template's boilerplate rather than a name (over 120 characters) —
the credit reads "Wikimedia Commons" and still links the page, which names the
author in full. CC0 and public-domain photos are credited the same way although
nothing is owed: one consistent credit line is simpler than a special case.

## The licences we refuse, and why

Anything not in the table above is refused rather than guessed at. These are
the ones Commons actually serves, and what is wrong with each for an app:

- **NonCommercial (CC BY-NC, BY-NC-SA).** The app ships through app stores and
  may carry monetisation, and "commercial" is ambiguous even for a free app.
  Commons itself refuses NC as not free, so seeing it means a mis-tagged file.
- **NoDerivatives (CC BY-ND).** Every screen crops the photo, and a crop is an
  adaptation. Commons refuses ND too.
- **GFDL (any version).** Written for software manuals: the licence's full text
  has to travel with the work, which a thumbnail in an app cannot do. Most GFDL
  photos are dual-licensed with a CC licence, but Commons reports one licence
  name per file, so the alternative stays invisible to `enrich`.
- **A CC licence with no version ("CC BY-SA").** The terms and the deed depend
  on the version, so there is nothing exact to comply with or link.
- **"Copyrighted free use".** A Commons summary saying the holder allows any
  use — not a licence text, and with no deed to link. What was actually
  granted lives wherever the holder granted it.
- **"PDM-owner".** An owner applying the Public Domain Mark to their own work.
  The mark waives nothing, so the rights are left unclear.
- **"Public domain in the United States".** Free under US law, perhaps not in
  the other countries the app ships to. This is why "Public domain" is matched
  exactly, never as a prefix.
- **Fair use.** Not a licence but a US legal defence for one article's own use
  of a non-free image. It does not carry over to an app. (`enrich` asks
  Wikipedia for free images only, so these never arrive.)

The cost is small: 3 photos on 2026-10-15 — one "Copyrighted free use", two
GFDL. If they ever matter, the GFDL pair could be recovered by also reading a
file's licence categories to find the CC alternative; that is a rule change,
made the way the next section describes.

## How the rule is enforced

- **`squadctl enrich`** is the only writer of `player.photo`. The rules are in
  `tools/squadctl/src/lib/photo-credit.ts`: `isAcceptedLicence`,
  `isAttributionOnly` (the named-holder rule, in any casing) and
  `MAX_CREDIT_NAME`. A photo is stored only with an accepted licence, a
  thumbnail on `upload.` or `thumb.wikimedia.org`, and its Commons page exactly
  where `scripts/commons.ts` derives it from the file name — so the credit's
  link always lands. Every refused or incomplete credit is listed in the
  report, with what it lacks.
- **`lib/dataIntegrity.test.ts`** re-checks every stored photo in
  `npm run check`: accepted licence, a named holder under "Attribution", a name
  no longer than 120 characters, an https thumbnail on a Wikimedia host, an
  https deed. A hand edit that breaks the rule fails the build.
- **The app** renders every credit through one component
  (`components/PhotoCreditText.tsx`, parts defined by `creditParts` in
  `lib/photos.ts`), so no two screens can credit a photo differently.

Loading a photo also sends the user's IP address to Wikimedia. That is a
privacy matter, not a licensing one — it is why photos ship only in a store
build with updated disclosures (`CLAUDE.md`, guardrail 4).

### Where the app says it

The About screen (`app/about.tsx`) is the user-facing half of this document.
Its "Data and image credits" section names every source and licence in the
table above — Wikipedia, Wikidata, Commons photos with the five accepted
licences, flags, fonts — and says where the per-photo credit appears (under
the question, and in the results' "photo credits" list). Its Privacy section
says what photo loading sends to Wikimedia, that photos are cached on the
device, and that a credit link opens a third-party site. Change a licence, a
source or a credit surface here and the About text in the same PR, and the web
privacy policy with it (`CLAUDE.md`, guardrail 4).

## Changing the list

Accepting a licence is a legal decision, so it is the owner's, never a
session's. To propose one:

1. **Read its wording** — the CC deed and legal code, or the Commons template
   — and write down what it asks.
2. **Check the credit meets it**: author, licence link, "cropped" and the
   Commons page. If it asks for something more (a full licence text, no
   changes), it is a refusal.
3. **Ask the owner**, with how many photos it would add: `enrich --offline`
   lists every refused photo and its licence, at no network cost.
4. Once signed off, change `photo-credit.ts`, its tests and this document in
   one PR, and re-run `enrich --offline` to store the newly accepted photos.

A new kind of asset — an image, an icon set, a font — follows the same rule
before it ships: name its licence and source where the asset lives, as
`assets/flags/README.md` does, and add it to the table above.
