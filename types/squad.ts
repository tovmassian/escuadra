export type Position = 'GK' | 'DF' | 'MF' | 'FW';

export interface Player {
  id: string;
  name: string;
  birth: string; // ISO date
  /** Exactly one position, not an array — the quiz asks for one chip, and
   *  same-position distractor selection needs a single key to group on. */
  position: Position;
  /** Asked on level 3 when the squad is a club. */
  nationality: string;
  photo: string | null; // reserved for v1
}

export interface SquadMember {
  playerId: string;
  no: number;
  captain?: boolean;
}

export interface Squad {
  id: string;
  kind: 'club' | 'nation';
  name: string;
  season: string;
  verified: boolean; // false = not fact-checked
  members: SquadMember[];
}
