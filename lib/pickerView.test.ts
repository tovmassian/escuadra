import { describe, expect, it } from 'vitest';
import { leagueFilters, teamProgress, visibleSquads } from './pickerView';
import type { League, SquadManifestEntry } from '@/types/squad';

describe('teamProgress', () => {
  it('returns null for a team that has never been played', () => {
    expect(teamProgress('bar', {})).toBeNull();
  });

  it('reports the only played level', () => {
    expect(teamProgress('bar', { 'bar:1': 7 })).toEqual({
      level: 1,
      correct: 7,
      total: 10,
      cleared: false,
    });
  });

  it('reports the highest level played, not the highest score', () => {
    // Level 3 is the meaningful progress marker even though level 1 scored higher.
    const progress = teamProgress('bar', { 'bar:1': 10, 'bar:3': 4 });
    expect(progress?.level).toBe(3);
    expect(progress?.correct).toBe(4);
  });

  it('marks a team cleared once a level is passed at 8/10', () => {
    expect(teamProgress('bar', { 'bar:1': 8 })?.cleared).toBe(true);
  });

  it('does not mark a team cleared below the pass ratio', () => {
    expect(teamProgress('bar', { 'bar:1': 7 })?.cleared).toBe(false);
  });

  it('marks cleared from any level, not only the highest played', () => {
    // Passed L1, then started L2 and did badly — the team is still cleared.
    expect(teamProgress('bar', { 'bar:1': 9, 'bar:2': 2 })?.cleared).toBe(true);
  });

  it('does not leak progress between squads', () => {
    expect(teamProgress('rma', { 'bar:1': 9 })).toBeNull();
  });

  it('treats a legitimate zero score as played', () => {
    expect(teamProgress('bar', { 'bar:1': 0 })).toEqual({
      level: 1,
      correct: 0,
      total: 10,
      cleared: false,
    });
  });
});

// Only the fields the two filters actually read; the picker's other manifest
// fields (colours, marker, season) are irrelevant here.
function entry(id: string, kind: 'club' | 'nation', league?: League): SquadManifestEntry {
  return { id, kind, name: id, league } as SquadManifestEntry;
}

const MANIFEST: SquadManifestEntry[] = [
  entry('ars', 'club', 'premier-league'),
  entry('bar', 'club', 'la-liga'),
  entry('rma', 'club', 'la-liga'),
  entry('juv', 'club', 'serie-a'),
  entry('arg', 'nation'),
  entry('bra', 'nation'),
];

describe('leagueFilters', () => {
  it('leads with ALL', () => {
    expect(leagueFilters(MANIFEST)[0]).toBe('ALL');
  });

  it('offers only leagues that actually have a club', () => {
    // No Bundesliga, Ligue 1 or UCL squad in the manifest, so no dead pill
    // that would filter the list down to nothing.
    expect(leagueFilters(MANIFEST)).toEqual(['ALL', 'premier-league', 'la-liga', 'serie-a']);
  });

  it('orders leagues canonically, not by first appearance', () => {
    const reversed = [...MANIFEST].reverse();
    expect(leagueFilters(reversed)).toEqual(['ALL', 'premier-league', 'la-liga', 'serie-a']);
  });

  it('ignores nations, which carry no league', () => {
    expect(leagueFilters([entry('arg', 'nation'), entry('bra', 'nation')])).toEqual(['ALL']);
  });
});

describe('visibleSquads', () => {
  it('shows every club under ALL', () => {
    expect(visibleSquads(MANIFEST, 'club', 'ALL').map((s) => s.id)).toEqual([
      'ars',
      'bar',
      'rma',
      'juv',
    ]);
  });

  it('narrows clubs to one league', () => {
    expect(visibleSquads(MANIFEST, 'club', 'la-liga').map((s) => s.id)).toEqual(['bar', 'rma']);
  });

  it('never mixes nations into the clubs tab', () => {
    expect(visibleSquads(MANIFEST, 'club', 'ALL').every((s) => s.kind === 'club')).toBe(true);
  });

  it('ignores the league on the nations tab', () => {
    // A stale league must not empty the nations list, since nation entries
    // carry no league at all.
    expect(visibleSquads(MANIFEST, 'nation', 'la-liga').map((s) => s.id)).toEqual(['arg', 'bra']);
  });

  it('returns an empty list for a league with no clubs', () => {
    expect(visibleSquads(MANIFEST, 'club', 'bundesliga')).toEqual([]);
  });
});
