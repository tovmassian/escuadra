import { photoCreditRows, photoFor, photosGate } from '@/lib/photos';
import type { QuestionResult } from '@/stores/session';
import type { PhotoCredit, Player } from '@/types/squad';
import { describe, expect, it } from 'vitest';

const credit: PhotoCredit = {
  file: 'X.jpg',
  url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/X.jpg/500px-X.jpg',
  author: 'Example Photographer',
  licence: 'CC BY-SA 4.0',
  licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
};

const player = (photo: PhotoCredit | null): Player => ({
  id: 'pedri',
  name: 'Pedri',
  fullName: 'Pedri',
  birth: null,
  position: 'MF',
  nationality: 'Spain',
  club: 'Barcelona',
  photo,
  wikiTitle: 'Pedri',
});

function result(playerId: string, memberNo: number, playerName: string): QuestionResult {
  return {
    question: {
      playerId,
      playerName,
      memberNo,
      age: null,
      position: 'MF',
      affiliation: '—',
      parts: [],
    },
    parts: [],
    correct: true,
  };
}

// Photos load from Wikimedia, which sees the user's IP: until a store build
// ships that disclosure, nothing but a development build may show one.
describe('photosGate', () => {
  it('is on only in a development build with the flag set to 1', () => {
    expect(photosGate({ isDev: true, flag: '1' })).toBe(true);
    expect(photosGate({ isDev: false, flag: '1' })).toBe(false);
    expect(photosGate({ isDev: true, flag: undefined })).toBe(false);
    expect(photosGate({ isDev: true, flag: 'true' })).toBe(false);
  });
});

describe('photoFor', () => {
  it('returns the player’s photo when photos are on', () => {
    expect(photoFor(player(credit), true)).toEqual(credit);
  });

  it('returns nothing when photos are off, whatever the data holds', () => {
    expect(photoFor(player(credit), false)).toBeNull();
  });

  it('returns nothing for a player without a photo, or no player at all', () => {
    expect(photoFor(player(null), true)).toBeNull();
    expect(photoFor(undefined, true)).toBeNull();
  });
});

describe('photoCreditRows', () => {
  it('lists only the questions that showed a photo, in round order', () => {
    const rows = photoCreditRows(
      [result('a', 7, 'Ferran Torres'), result('b', 20, 'Pedri'), result('c', 16, 'Rodri')],
      (id) => (id === 'b' || id === 'c' ? credit : null),
    );
    expect(rows).toEqual([
      { playerId: 'b', memberNo: 20, playerName: 'Pedri', credit },
      { playerId: 'c', memberNo: 16, playerName: 'Rodri', credit },
    ]);
  });
});
