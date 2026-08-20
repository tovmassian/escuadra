export type Position = 'GK' | 'DF' | 'MF' | 'FW';

export interface Player {
  id: string;
  name: string;
  birth: string; // ISO date
  position: Position;
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
