import type { SquadManifestEntry } from '@/types/squad';
import { describe, expect, it } from 'vitest';
import { starredOfKind, starredTeams, toggleStarred } from '@/lib/starred';

function entry(id: string, kind: 'club' | 'nation'): SquadManifestEntry {
  return { id, kind, name: id } as SquadManifestEntry;
}

const squads = [
  entry('arsenal', 'club'),
  entry('real-madrid', 'club'),
  entry('spain', 'nation'),
  entry('armenia', 'nation'),
];

describe('toggleStarred', () => {
  it('puts a newly starred team first', () => {
    expect(toggleStarred(['spain'], 'arsenal')).toEqual(['arsenal', 'spain']);
  });

  it('removes a starred team, keeping the others in order', () => {
    expect(toggleStarred(['arsenal', 'spain', 'armenia'], 'spain')).toEqual(['arsenal', 'armenia']);
  });

  it('stars a team only once', () => {
    expect(toggleStarred(toggleStarred([], 'spain'), 'spain')).toEqual([]);
  });
});

describe('starredOfKind', () => {
  it("returns one tab's starred teams, newest first", () => {
    const starred = ['armenia', 'arsenal', 'spain', 'real-madrid'];
    expect(starredOfKind(starred, squads, 'nation').map((s) => s.id)).toEqual(['armenia', 'spain']);
    expect(starredOfKind(starred, squads, 'club').map((s) => s.id)).toEqual([
      'arsenal',
      'real-madrid',
    ]);
  });

  it('ignores a starred id that is no longer in the data', () => {
    expect(starredOfKind(['gone', 'spain'], squads, 'nation').map((s) => s.id)).toEqual(['spain']);
  });

  it('is empty with nothing starred', () => {
    expect(starredOfKind([], squads, 'club')).toEqual([]);
  });
});

describe('starredTeams', () => {
  it('keeps both kinds, newest first, and drops ids that have left the data', () => {
    expect(starredTeams(['armenia', 'gone', 'arsenal'], squads).map((s) => s.id)).toEqual([
      'armenia',
      'arsenal',
    ]);
  });
});
