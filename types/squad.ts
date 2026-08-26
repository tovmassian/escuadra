export type Position = 'GK' | 'DF' | 'MF' | 'FW';

export interface Player {
  id: string;
  /** Short/known-as name — what the quiz and Study screen display. Must fit
   *  a 4-6 option card on a phone, so this stays the shirt-back-style name
   *  (e.g. "Vinícius Júnior"), never the full legal name. */
  name: string;
  /** Full legal name, for data completeness — not surfaced in v0 UI, since
   *  option cards and the Study list have no room for it. */
  fullName: string;
  birth: string; // ISO date
  /** Exactly one position, not an array — the quiz asks for one chip, and
   *  same-position distractor selection needs a single key to group on. */
  position: Position;
  /** Asked on level 3 when the squad is a club. */
  nationality: string;
  /** Asked on level 3 when the squad is a nation. Null for players whose
   *  club is unknown/unset — never surfaced as a level-3 question in that case. */
  club: string | null;
  photo: string | null; // reserved for v1
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

/** A team's sole visual identity element, as declarative geometry rather
 *  than an asset — every squad, club or nation, carries one.
 *
 *  For a nation the marker *is* the national flag. National flags are
 *  exempt from the "no crests, badges, logos or shield shapes" rule: that
 *  rule exists for trademark exposure, and a flag carries no trademark.
 *  Deliberately not the Unicode regional-indicator emoji (🇦🇷): that depends
 *  on an OS flag-emoji font, and Windows ships none — the Playwright capture
 *  step of the design loop runs on Windows Chrome and would hand the design
 *  side "AR" instead of a flag. Geometry renders identically everywhere.
 *  National emblems and coats of arms are omitted. Spain without its arms is
 *  the civil flag; Argentina without the sun and Brazil without the celestial
 *  globe stay unambiguous at this size, and omitting them keeps the marker
 *  consistent with the app's geometric language.
 *
 *  For a club the marker is the club's own colours laid out as bands — never
 *  an emblem, per the "no crests, ever" constraint. A single-colour club
 *  (Arsenal, Real Madrid) is a one-entry `bands` array: a plain field, not a
 *  split shape. */
export interface TeamMarker {
  /** Band fills, in draw order: top-to-bottom for `horizontal`,
   *  left-to-right for `vertical`. A single-entry array is a plain field. */
  bands: string[];
  orientation: 'horizontal' | 'vertical';
  /** Relative band sizes. Omit for equal bands. Spain is [1, 2, 1]. */
  weights?: number[];
  /** A centred device over the field — Japan's disc, Brazil's diamond. */
  overlay?: { shape: 'disc' | 'diamond'; color: string };
}

export interface Squad {
  id: string;
  kind: 'club' | 'nation';
  name: string;
  season: string;
  /** The team's real identity colours (hex). Content, not a design-system
   *  choice — see CLAUDE.md's colour rule. Never invented or rotated; the
   *  club/nation's actual colours, sourced same as any other squad fact. */
  primaryColor: string;
  secondaryColor: string;
  verified: boolean; // false = not fact-checked
  /** The team's sole visual identity element — see `TeamMarker`. Present on
   *  every squad, since crests/badges/shields are never used. */
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
   *  squad JSON. Kept in sync by lib/squads.test.ts. */
  marker: TeamMarker;
}

/** A squad member joined with their player record. */
export interface RosterEntry {
  member: SquadMember;
  player: Player;
}
