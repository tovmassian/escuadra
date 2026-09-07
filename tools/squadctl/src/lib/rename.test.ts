import { describe, expect, it } from 'vitest';
import type { Player } from '../../../../types/squad.ts';
import { renamePlayer } from './rename.ts';

const player = (over: Partial<Player> & { id: string; name: string }): Player => ({
  fullName: over.name,
  birth: '1995-01-01',
  position: 'MF',
  nationality: 'Spain',
  club: 'Benfica',
  photo: null,
  ...over,
});

describe('renamePlayer', () => {
  const stored = [
    player({ id: 'grimaldo', name: 'Alejandro Grimaldo', fullName: 'Alejandro Grimaldo García' }),
    player({ id: 'dro', name: 'Dro' }),
  ];

  it('renames without touching the id, which squad files reference', () => {
    const result = renamePlayer(stored, 'grimaldo', 'Álex Grimaldo');
    expect(result?.players.find((p) => p.id === 'grimaldo')?.name).toBe('Álex Grimaldo');
    expect(result?.players.map((p) => p.id)).toEqual(['grimaldo', 'dro']);
  });

  it('leaves a divergent fullName alone, since that is real data', () => {
    const result = renamePlayer(stored, 'grimaldo', 'Álex Grimaldo');
    expect(result?.fullNameFollowed).toBe(false);
    expect(result?.players.find((p) => p.id === 'grimaldo')?.fullName).toBe(
      'Alejandro Grimaldo García',
    );
  });

  it('moves fullName with name when it was tracking it exactly', () => {
    const result = renamePlayer(stored, 'dro', 'Dro Fernández');
    expect(result?.fullNameFollowed).toBe(true);
    expect(result?.players.find((p) => p.id === 'dro')?.fullName).toBe('Dro Fernández');
  });

  it('reports the previous name so the change is auditable', () => {
    expect(renamePlayer(stored, 'dro', 'Dro Fernández')?.before).toBe('Dro');
  });

  it('returns null for an unknown id rather than inventing a record', () => {
    expect(renamePlayer(stored, 'nobody', 'A Name')).toBeNull();
  });

  it('does not mutate the array it was given', () => {
    renamePlayer(stored, 'dro', 'Dro Fernández');
    expect(stored[1]?.name).toBe('Dro');
  });
});
