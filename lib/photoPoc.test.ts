import photosData from '@/data/poc/photos.esp.json';
import spain from '@/data/squads/nation/esp.json';
import { getPhoto, photoCreditRows, photoPocGate } from '@/lib/photoPoc';
import type { QuestionResult } from '@/stores/session';
import type { PhotoCredit, PhotoFile } from '@/types/photo';
import { describe, expect, it } from 'vitest';

const photos = photosData as PhotoFile;

const credit: PhotoCredit = {
  url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/X.jpg/512px-X.jpg',
  author: 'Example Photographer',
  licence: 'CC BY-SA 4.0',
  licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:X.jpg',
};

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

describe('photoPocGate', () => {
  it('is on only in a development build with the flag set to 1', () => {
    expect(photoPocGate({ isDev: true, flag: '1' })).toBe(true);
    expect(photoPocGate({ isDev: false, flag: '1' })).toBe(false);
    expect(photoPocGate({ isDev: true, flag: undefined })).toBe(false);
    expect(photoPocGate({ isDev: true, flag: 'true' })).toBe(false);
  });
});

describe('getPhoto', () => {
  it('returns nothing when the POC is off, whatever the data holds', () => {
    for (const id of Object.keys(photos)) expect(getPhoto(id, false)).toBeNull();
  });

  it('returns nothing for a player without a photo entry', () => {
    expect(getPhoto('not-a-player', true)).toBeNull();
  });

  it('returns the entry for a player who has one', () => {
    for (const [id, entry] of Object.entries(photos)) expect(getPhoto(id, true)).toEqual(entry);
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

// The licensing guardrail as a test: nothing reaches the screen without a
// nameable author and licence, hosted where the spec says.
describe('data/poc/photos.esp.json', () => {
  const memberIds = new Set(spain.members.map((m) => m.playerId));

  it('holds only Spain members, each with a complete credit', () => {
    for (const [id, entry] of Object.entries(photos)) {
      expect(memberIds.has(id), id).toBe(true);
      expect(entry.author.trim(), id).not.toBe('');
      expect(entry.licence.trim(), id).not.toBe('');
      expect(entry.url.startsWith('https://upload.wikimedia.org/'), id).toBe(true);
      expect(entry.sourceUrl.startsWith('https://commons.wikimedia.org/wiki/File:'), id).toBe(true);
      if (entry.licenceUrl !== null) expect(entry.licenceUrl.startsWith('https://'), id).toBe(true);
    }
  });
});
