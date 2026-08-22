import { describe, expect, it } from 'vitest';
import { parsePlayerIds, studyRows } from './studyView';
import type { RosterEntry } from '@/types/squad';

function entry(id: string, no: number, position: 'GK' | 'DF' | 'MF' | 'FW'): RosterEntry {
  return {
    player: {
      id,
      name: id,
      birth: '2000-01-01',
      position,
      nationality: 'Spain',
      photo: null,
    },
    member: { playerId: id, no },
  } as RosterEntry;
}

const roster: RosterEntry[] = [entry('c', 9, 'FW'), entry('a', 1, 'GK'), entry('b', 4, 'DF')];

describe('parsePlayerIds', () => {
  it('returns null when the param is absent', () => {
    expect(parsePlayerIds(undefined)).toBeNull();
  });

  it('returns null for an empty string, so an empty param is not a filter to nothing', () => {
    expect(parsePlayerIds('')).toBeNull();
  });

  it('splits a comma-separated list', () => {
    expect(parsePlayerIds('a,b')).toEqual(['a', 'b']);
  });

  it('trims whitespace and drops empty entries', () => {
    expect(parsePlayerIds('a, ,b,')).toEqual(['a', 'b']);
  });
});

describe('studyRows', () => {
  it('sorts by shirt number when unfiltered', () => {
    expect(studyRows(roster, 'ALL', null).map((r) => r.member.no)).toEqual([1, 4, 9]);
  });

  it('filters by position', () => {
    expect(studyRows(roster, 'GK', null).map((r) => r.player.id)).toEqual(['a']);
  });

  it('filters to the given player ids', () => {
    expect(studyRows(roster, 'ALL', ['c', 'a']).map((r) => r.player.id)).toEqual(['a', 'c']);
  });

  it('keeps shirt-number order when filtering by id, not the order of the id list', () => {
    expect(studyRows(roster, 'ALL', ['c', 'a']).map((r) => r.member.no)).toEqual([1, 9]);
  });

  it('ignores ids that are not in this squad', () => {
    expect(studyRows(roster, 'ALL', ['a', 'zzz']).map((r) => r.player.id)).toEqual(['a']);
  });

  it('returns an empty list when no id matches', () => {
    expect(studyRows(roster, 'ALL', ['zzz'])).toEqual([]);
  });
});
