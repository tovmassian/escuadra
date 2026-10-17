import { describe, expect, it } from 'vitest';
import { en } from '@/i18n/en';
import {
  STUDY_FILTERS,
  filterCounts,
  studyAffiliation,
  studyCount,
  studyCreditRows,
  studyLabel,
  studyRows,
} from './studyView';
import type { PhotoCredit, Player, Position, RosterEntry } from '@/types/squad';

const photo: PhotoCredit = {
  file: 'Rodri 2021.jpg',
  url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Rodri_2021.jpg/960px-Rodri_2021.jpg',
  width: 3000,
  height: 2000,
  author: 'Example Photographer',
  licence: 'CC BY-SA 4.0',
  licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
};

function entry(
  no: number | null,
  name: string,
  position: Position,
  extra: Partial<Player> = {},
): RosterEntry {
  return {
    member: { playerId: name.toLowerCase(), no },
    player: {
      id: name.toLowerCase(),
      name,
      fullName: name,
      birth: null,
      position,
      nationality: 'Spain',
      club: 'Barcelona',
      photo: null,
      wikiTitle: null,
      ...extra,
    },
  };
}

const roster = [
  entry(7, 'Torres', 'FW'),
  entry(1, 'Raya', 'GK'),
  entry(16, 'Rodri', 'MF', { photo }),
  entry(3, 'Grimaldo', 'DF'),
  entry(23, 'Simón', 'GK', { photo }),
];

describe('studyRows', () => {
  it('lists the whole squad in shirt-number order', () => {
    expect(studyRows(roster, 'ALL').map((r) => r.member.no)).toEqual([1, 3, 7, 16, 23]);
  });

  it('keeps one position, still in shirt-number order', () => {
    expect(studyRows(roster, 'GK').map((r) => r.member.no)).toEqual([1, 23]);
  });

  it('puts a member with no shirt number last', () => {
    const withUnnumbered = [entry(null, 'Newman', 'DF'), ...roster];
    expect(studyRows(withUnnumbered, 'ALL').map((r) => r.member.no)).toEqual([
      1,
      3,
      7,
      16,
      23,
      null,
    ]);
  });
});

describe('filterCounts', () => {
  it('counts the whole squad for All and each position for its pill', () => {
    expect(filterCounts(roster)).toEqual({ ALL: 5, GK: 2, DF: 1, MF: 1, FW: 1 });
  });

  it('has a count for every filter', () => {
    const counts = filterCounts(roster);
    for (const f of STUDY_FILTERS) expect(typeof counts[f]).toBe('number');
  });
});

describe('studyCount', () => {
  it('says how many players when unfiltered', () => {
    expect(studyCount(26, 26, 'ALL', en)).toBe('26 players');
    expect(studyCount(1, 1, 'ALL', en)).toBe('1 player');
  });

  it('says how many of the squad when filtered', () => {
    expect(studyCount(9, 26, 'DF', en)).toBe('9 of 26');
  });
});

describe('studyAffiliation', () => {
  it('gives a club squad the nationality and a nation squad the club', () => {
    const p = entry(7, 'Torres', 'FW', { nationality: 'Spain', club: 'Barcelona' }).player;
    expect(studyAffiliation(p, 'club')).toBe('Spain');
    expect(studyAffiliation(p, 'nation')).toBe('Barcelona');
  });

  it('shows a dash for a nation player with no club', () => {
    const p = entry(7, 'Torres', 'FW', { club: null }).player;
    expect(studyAffiliation(p, 'nation')).toBe('—');
  });
});

describe('studyLabel', () => {
  const p = entry(7, 'Torres', 'FW').player;

  it('reads the number, name, position and affiliation', () => {
    expect(studyLabel(7, p, 'Barcelona', false, en)).toBe('7, Torres, Forward, Barcelona');
  });

  it('never speaks a hidden name', () => {
    const label = studyLabel(7, p, 'Barcelona', true, en);
    expect(label).toBe('7, name hidden, Forward, Barcelona');
    expect(label).not.toContain('Torres');
  });

  it('says "no number" for a member Wikipedia lists without one', () => {
    expect(studyLabel(null, p, 'Barcelona', false, en)).toBe(
      'no number, Torres, Forward, Barcelona',
    );
  });
});

describe('studyCreditRows', () => {
  it('credits only the rows with a photo, in list order', () => {
    const rows = studyCreditRows(studyRows(roster, 'ALL'));
    expect(rows.map((r) => r.memberNo)).toEqual([16, 23]);
    expect(rows[0]?.credit).toBe(photo);
  });

  it('still credits a photographed member who has no shirt number', () => {
    const rows = studyCreditRows([entry(null, 'Newman', 'DF', { photo })]);
    expect(rows).toEqual([
      { playerId: 'newman', memberNo: null, playerName: 'Newman', credit: photo },
    ]);
  });
});
