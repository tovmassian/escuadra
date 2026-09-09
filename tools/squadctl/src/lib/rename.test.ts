import { describe, expect, it } from 'vitest';
import type { Player } from '../../../../types/squad.ts';
import { renamePlayer, retitlePlayer, forkPlayer } from './rename.ts';

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

describe('forkPlayer', () => {
  const stored = [
    player({
      id: 'otavio',
      name: 'Otávio',
      fullName: 'Otávio Ataíde',
      birth: '2002-02-09',
      position: 'DF',
      nationality: 'Brazil',
      club: 'Paris FC',
      wikiTitle: 'Otávio (footballer, born 2002)',
    }),
  ];

  it('creates a second record under a fresh id, never rewriting the first', () => {
    const result = forkPlayer(stored, 'otavio', 'Otávio (footballer, born November 2005)');
    expect(result?.created.id).toBe('otavio-2');
    expect(result?.players.find((p) => p.id === 'otavio')?.wikiTitle).toBe(
      'Otávio (footballer, born 2002)',
    );
  });

  it('carries the given title on the new record', () => {
    const result = forkPlayer(stored, 'otavio', 'Otávio (footballer, born November 2005)');
    expect(result?.created.wikiTitle).toBe('Otávio (footballer, born November 2005)');
  });

  it('does NOT copy birth — that date belongs to the original person', () => {
    const result = forkPlayer(stored, 'otavio', 'Otávio (footballer, born November 2005)');
    expect(result?.created.birth).toBeNull();
  });

  it('does not copy club or nationality; the next apply fills them from the row', () => {
    const result = forkPlayer(stored, 'otavio', 'Otávio (footballer, born November 2005)');
    expect(result?.created.club).toBeNull();
    expect(result?.created.nationality).toBe('');
  });

  it('copies name and position, since Player.position admits no null', () => {
    const result = forkPlayer(stored, 'otavio', 'Otávio (footballer, born November 2005)');
    expect(result?.created.name).toBe('Otávio');
    expect(result?.created.position).toBe('DF');
  });

  it('returns null for an unknown id', () => {
    expect(forkPlayer(stored, 'nobody', 'Nobody')).toBeNull();
  });
});
