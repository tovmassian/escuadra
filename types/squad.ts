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
  no: number;
  /** Appearances for THIS squad specifically — club caps and country caps
   *  differ, so this lives on membership, same reasoning as shirt number. */
  apps: number;
  captain?: boolean;
}

export interface Squad {
  id: string;
  kind: 'club' | 'nation';
  name: string;
  season: string;
  /** Key into `theme/tokens.ts`'s `teamAccents` — decoupled from `id` so
   *  squad ids don't have to match the accent palette's key set. */
  accentId: string;
  verified: boolean; // false = not fact-checked
  members: SquadMember[];
}

/** `data/index.json` — the picker's manifest. A deliberately shallow subset
 *  of `Squad`, so the Team Picker never has to import every roster. */
export interface SquadManifestEntry {
  id: string;
  kind: 'club' | 'nation';
  name: string;
  season: string;
  accentId: string;
  verified: boolean;
}

/** A squad member joined with their player record. */
export interface RosterEntry {
  member: SquadMember;
  player: Player;
}
