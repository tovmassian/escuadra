export type Position = 'GK' | 'DF' | 'MF' | 'FW';

export type League = 'la-liga' | 'serie-a' | 'bundesliga' | 'ligue-1' | 'premier-league' | 'ucl';

export interface Player {
  id: string;
  /** Short/known-as name — what the quiz and Study screen display. Must fit
   *  a 4-6 option card on a phone, so this stays the shirt-back-style name
   *  (e.g. "Vinícius Júnior"), never the full legal name. */
  name: string;
  /** Full legal name, for data completeness — not surfaced in v0 UI, since
   *  option cards and the Study list have no room for it. */
  fullName: string;
  /** ISO date, or null when no birth date is known. Club-squad wikitext
   *  structurally never carries one, so a new signing legitimately arrives
   *  without it — normal, not anomalous. The quiz drops the AGE stat chip
   *  rather than rendering NaN; see `lib/age.ts#getAge`. */
  birth: string | null;
  /** Exactly one position, not an array — the quiz asks for one chip, and
   *  same-position distractor selection needs a single key to group on. */
  position: Position;
  /** Asked on level 3 when the squad is a club. */
  nationality: string;
  /** Asked on level 3 when the squad is a nation. Null for players whose
   *  club is unknown/unset — never surfaced as a level-3 question in that case. */
  club: string | null;
  /** A freely licensed Wikimedia Commons photo and its credit, written by
   *  `squadctl enrich`. Null when the player has no article, the article and
   *  its Wikidata item have no image, or the image's licence is refused. */
  photo: PhotoCredit | null;
  /** Wikipedia article title this record was created from. Unique per person
   *  by construction, where a display name is not: two different real people
   *  are both rendered "Otávio" and only the title separates them.
   *
   *  Null when unknown — a record predating this field, or a row the source
   *  lists as plain text with no article, which is ~2.5% of parsed rows and
   *  therefore permanent, not merely transitional.
   *
   *  Data-layer identity only. No screen reads it and it is never a quiz
   *  answer. */
  wikiTitle: string | null;
}

/** A Wikimedia Commons photo and the credit its licence requires. Hotlinked,
 *  never copied: the app loads `url` and stores nothing. Every field but
 *  `author` and `licenceUrl` is required, so a photo never ships with a
 *  guessed credit. Its Commons page is not stored: `commonsFileUrl(file)`
 *  (scripts/commons.ts) derives it, and enrich stores only photos whose page is
 *  exactly there. See docs/superpowers/specs/2026-10-13-wikimedia-photo-poc-design.md. */
export interface PhotoCredit {
  /** The Commons file name ("Pedri 2021.jpg"), the photo's stable identity
   *  and the key to its Commons page. It usually names the player, so it
   *  never reaches visible text or a label during a question. */
  file: string;
  /** The 960 px thumbnail on thumb.wikimedia.org for an original at least
   *  960 px wide. A narrower original is served unscaled or, occasionally, at
   *  a smaller Commons step; a thumbnail URL's `NNNpx-` segment is the width
   *  actually served. Tracking query removed. Derived from `file` by Commons;
   *  can change. */
  url: string;
  /** The original file's size in pixels, not the thumbnail's. The 2.0
   *  question screen (#113) will use it to fill its stage with a photo at
   *  least 720 px wide and frame a smaller one (spec §2.6), going by the
   *  width actually served (see `url`). */
  width: number;
  height: number;
  /** Who the credit names, plain text: the attribution the licence asks for
   *  when Commons records one ("Bryan Berlin / WikiPortraits", a rights-
   *  holding agency), else the photographer. Null when neither is known; the
   *  credit then names Wikimedia Commons and links the file page. */
  author: string | null;
  /** Licence short name as Commons gives it, e.g. "CC BY-SA 4.0". */
  licence: string;
  /** Licence deed, when Commons gives one (none for public domain or the
   *  attribution-only licence); the credit falls back to the Commons page. */
  licenceUrl: string | null;
}

export interface SquadMember {
  playerId: string;
  /** Null for a squad member Wikipedia lists without an assigned shirt
   *  number (e.g. a fresh signing). Excluded from quiz question subjects —
   *  the level-1 prompt has nothing to show without a number — but still
   *  appears in Study mode and as a name distractor for other questions. */
  no: number | null;
  captain?: boolean;
}

/** A team's visual identity as declarative geometry rather than an asset —
 *  every squad, club or nation, carries one. Colour bands only: never a
 *  disc, diamond or other device.
 *
 *  For a club this is the whole story: its own colours as bands, never an
 *  emblem, per the "no crests, ever" constraint. A single-colour club
 *  (Arsenal, Real Madrid) is a one-entry `bands` array: a plain field, not a
 *  split shape.
 *
 *  For a nation it is not the main identity element. Nations show a real
 *  flag image from `assets/flags/` (see `lib/flags.ts` and
 *  `components/Flag.tsx`), because geometry could not express a flag with a
 *  coat of arms, a canton or a saltire. A nation's `marker` is its flag as
 *  bands. How a flag becomes bands, and where a nation shows its flag image
 *  and where its bands: `.claude/rules/team-identity.md`.
 *
 *  Never a Unicode regional-indicator emoji (🇦🇷) anywhere: that depends on an
 *  OS flag-emoji font, and Windows ships none — the Playwright capture step
 *  of the design loop runs on Windows Chrome and would hand the design side
 *  "AR". A committed PNG has no such dependency. */
export interface TeamMarker {
  /** Band fills, in draw order: top-to-bottom for `horizontal`,
   *  left-to-right for `vertical`. A single-entry array is a plain field. */
  bands: string[];
  orientation: 'horizontal' | 'vertical';
  /** Relative band sizes. Omit for equal bands. Spain is [1, 2, 1]. */
  weights?: number[];
}

export interface Squad {
  id: string;
  kind: 'club' | 'nation';
  name: string;
  season: string;
  /** The team's real identity colours (hex). Content, not a design-system
   *  choice — see CLAUDE.md guardrail 5 and .claude/rules/team-identity.md.
   *  Never invented or rotated; the club/nation's actual colours, sourced
   *  same as any other squad fact. */
  primaryColor: string;
  secondaryColor: string;
  verified: boolean; // false = not fact-checked
  /** A club's sole visual identity element, and a nation's flag as bands; a
   *  nation's flag image is separate (`lib/flags.ts`) — see `TeamMarker`.
   *  Present on every squad, since crests/badges/shields are never used. */
  marker: TeamMarker;
  /** ISO date this squad file was last written/synced from its source. */
  lastUpdated: string;
  /** The Wikipedia article this squad was scraped from. */
  source: string;
  members: SquadMember[];
}

/** `data/index.json` — the picker's manifest. A deliberately shallow subset
 *  of `Squad`, so the Team Picker never has to import every roster. */
export interface SquadManifestEntry {
  id: string;
  kind: 'club' | 'nation';
  name: string;
  season: string;
  primaryColor: string;
  secondaryColor: string;
  verified: boolean;
  /** Mirrors the squad file's `marker`, since the picker never imports full
   *  squad JSON. Kept in sync by lib/__tests__/squads.test.ts. */
  marker: TeamMarker;
  /** Mirrors the squad file's `lastUpdated`, so the picker can tell an
   *  outdated best score (#180) without importing the roster. */
  lastUpdated: string;
  /** Which big-5 league (or `ucl`, for a UCL group-stage club with no big-5
   *  home) a club plays in. Present for `kind: 'club'` entries, absent for
   *  `kind: 'nation'` entries. Derived from the squad file's folder path by
   *  `scripts/gen-squads.ts`, not authored by hand. */
  league?: League;
}

/** A squad member joined with their player record. */
export interface RosterEntry {
  member: SquadMember;
  player: Player;
}
