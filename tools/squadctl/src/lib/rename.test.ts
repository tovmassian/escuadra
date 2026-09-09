import { describe, expect, it } from 'vitest';
import type { Player } from '../../../../types/squad.ts';
import { renamePlayer, retitlePlayer } from './rename.ts';

const player = (over: Partial<Player> & { id: string; name: string }): Player => ({
  fullName: over.name,
  birth: '1995-01-01',
  position: 'MF',
  nationality: 'Spain',
  club: 'Benfica',
  photo: null,
  wikiTitle: null,
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

describe('retitlePlayer', () => {
  const stored = [
    player({ id: 'endrick', name: 'Endrick', wikiTitle: 'Endrick' }),
    player({ id: 'dro', name: 'Dro', wikiTitle: null }),
  ];

  it('points the record at the new title without touching the id', () => {
    const result = retitlePlayer(stored, 'endrick', 'Endrick (footballer, born 2006)');
    expect(result?.players.find((p) => p.id === 'endrick')?.wikiTitle).toBe(
      'Endrick (footballer, born 2006)',
    );
    expect(result?.players.map((p) => p.id)).toEqual(['endrick', 'dro']);
  });

  it('leaves the display name alone — that is what rename is for', () => {
    const result = retitlePlayer(stored, 'endrick', 'Endrick (footballer, born 2006)');
    expect(result?.players.find((p) => p.id === 'endrick')?.name).toBe('Endrick');
  });

  it('reports the previous title, including when there was none', () => {
    expect(retitlePlayer(stored, 'dro', 'Dro Fernández')?.before).toBeNull();
  });

  it('returns null for an unknown id rather than inventing a record', () => {
    expect(retitlePlayer(stored, 'nobody', 'Nobody')).toBeNull();
  });
});
