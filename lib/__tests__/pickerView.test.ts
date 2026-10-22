import type { League, SquadManifestEntry } from '@/types/squad';
import { describe, expect, it } from 'vitest';
import { squadDisplayName } from '@/i18n/displayNames';
import { en } from '@/i18n/en';
import { SUPPORTED_LANGUAGES } from '@/i18n/resolveLanguage';
import { listSquads } from '@/lib/squads';
import {
  initialOf,
  kindCounts,
  leagueFilters,
  leagueLabel,
  letterAt,
  nationSections,
  scoreBlock,
  teamProgress,
  visibleSquads,
  type SquadNames,
} from '../pickerView';

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

describe('leagueLabel', () => {
  it('names leagues as they are, and the clear pill from the catalog', () => {
    expect(leagueLabel('ALL', en)).toBe('ALL');
    expect(leagueLabel('la-liga', en)).toBe('La Liga');
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
    expect(leagueFilters(MANIFEST)).toEqual(['ALL', 'la-liga', 'serie-a', 'premier-league']);
  });

  it('orders leagues canonically, not by first appearance', () => {
    const reversed = [...MANIFEST].reverse();
    expect(leagueFilters(reversed)).toEqual(['ALL', 'la-liga', 'serie-a', 'premier-league']);
  });

  it('ignores nations, which carry no league', () => {
    expect(leagueFilters([entry('arg', 'nation'), entry('bra', 'nation')])).toEqual(['ALL']);
  });
});

// The English name of each fixture entry is its id (see `entry`). These tables
// stand in for a language the app does not ship yet.
const ID_NAMES: SquadNames = { nameOf: (s) => s.id, locale: 'en' };

describe('visibleSquads', () => {
  const show = (
    kind: 'club' | 'nation',
    league: Parameters<typeof visibleSquads>[2],
    query = '',
    names: SquadNames = ID_NAMES,
    squads: SquadManifestEntry[] = MANIFEST,
  ) => visibleSquads(squads, kind, league, names, query).map((s) => s.id);

  it('shows every club under ALL, sorted by name', () => {
    expect(show('club', 'ALL')).toEqual(['ars', 'bar', 'juv', 'rma']);
  });

  it('narrows clubs to one league', () => {
    expect(show('club', 'la-liga')).toEqual(['bar', 'rma']);
  });

  it('never mixes nations into the clubs tab', () => {
    expect(show('club', 'ALL')).not.toContain('arg');
  });

  it('ignores the league on the nations tab', () => {
    // A stale league must not empty the nations list, since nation entries
    // carry no league at all.
    expect(show('nation', 'la-liga')).toEqual(['arg', 'bra']);
  });

  it('returns an empty list for a league with no clubs', () => {
    expect(show('club', 'bundesliga')).toEqual([]);
  });

  it('filters by a case-insensitive substring of the name', () => {
    expect(show('club', 'ALL', 'AR')).toEqual(['ars', 'bar']);
  });

  it('trims surrounding whitespace from the query', () => {
    expect(show('club', 'ALL', '  ar  ')).toEqual(['ars', 'bar']);
  });

  it('treats an empty query as no filter', () => {
    expect(show('club', 'ALL', '')).toEqual(['ars', 'bar', 'juv', 'rma']);
  });

  it('composes the query with the league filter', () => {
    expect(show('club', 'la-liga', 'ba')).toEqual(['bar']);
  });

  it('filters nations by name too', () => {
    expect(show('nation', 'ALL', 'ar')).toEqual(['arg']);
  });

  it('returns an empty list when nothing matches the query', () => {
    expect(show('club', 'ALL', 'zzz')).toEqual([]);
  });

  describe('with displayed names', () => {
    // Three nations as a Spanish-speaking player would see them. The English
    // name stays on the entry, as it does in data/index.json.
    const nations = [
      { ...entry('esp', 'nation'), name: 'Spain' },
      { ...entry('ger', 'nation'), name: 'Germany' },
      { ...entry('aus', 'nation'), name: 'Austria' },
    ] as SquadManifestEntry[];
    const spanish: Record<string, string> = {
      esp: 'España',
      ger: 'Alemania',
      aus: 'Austria',
    };
    const es: SquadNames = { nameOf: (s) => spanish[s.id] ?? s.name, locale: 'es' };

    it('sorts by the displayed name, not by the English one', () => {
      expect(show('nation', 'ALL', '', es, nations)).toEqual(['ger', 'aus', 'esp']);
      expect(show('nation', 'ALL', '', { ...es, nameOf: (s) => s.name }, nations)).toEqual([
        'aus',
        'ger',
        'esp',
      ]);
    });

    it('sorts an accented name among its unaccented neighbours', () => {
      const accented: Record<string, string> = { esp: 'Álava', ger: 'Zaragoza', aus: 'Barcelona' };
      const names: SquadNames = { nameOf: (s) => accented[s.id] ?? s.name, locale: 'es' };
      expect(show('nation', 'ALL', '', names, nations)).toEqual(['esp', 'aus', 'ger']);
    });

    it('finds the same team by "espana", "España" and "Spain"', () => {
      expect(show('nation', 'ALL', 'espana', es, nations)).toEqual(['esp']);
      expect(show('nation', 'ALL', 'España', es, nations)).toEqual(['esp']);
      expect(show('nation', 'ALL', 'Spain', es, nations)).toEqual(['esp']);
    });

    it('ignores accents and case in the typed query and in the name', () => {
      expect(show('nation', 'ALL', 'ESPAÑA', es, nations)).toEqual(['esp']);
      expect(show('nation', 'ALL', 'alemanía', es, nations)).toEqual(['ger']);
    });

    it('matches the English name even when another is displayed', () => {
      expect(show('nation', 'ALL', 'germ', es, nations)).toEqual(['ger']);
    });

    it('does not match a name that appears in neither', () => {
      expect(show('nation', 'ALL', 'francia', es, nations)).toEqual([]);
    });
  });
});

const namesIn = (language: (typeof SUPPORTED_LANGUAGES)[number]): SquadNames => ({
  nameOf: (s) => squadDisplayName(s, language),
  locale: language,
});

describe('initialOf', () => {
  it('folds accents and case, as search does', () => {
    expect(initialOf('Ägypten')).toBe('A');
    expect(initialOf('Égypte')).toBe('E');
    expect(initialOf('Österreich')).toBe('O');
    expect(initialOf('italia')).toBe('I');
  });
});

describe.each(SUPPORTED_LANGUAGES)('nationSections in %s', (language) => {
  const names = namesIn(language);
  const squads = listSquads();
  const sections = nationSections(squads, names);
  const nations = squads.filter((s) => s.kind === 'nation');

  it('lists every nation exactly once', () => {
    const ids = sections.flatMap((s) => s.squads.map((q) => q.id));
    expect(ids).toHaveLength(nations.length);
    expect(new Set(ids).size).toBe(nations.length);
  });

  it('opens each letter once, in alphabetical order', () => {
    const letters = sections.map((s) => s.letter);
    expect(new Set(letters).size).toBe(letters.length);
    expect([...letters].sort((a, b) => a.localeCompare(b, language))).toEqual(letters);
  });

  it("files each nation under its displayed name's first letter", () => {
    for (const section of sections) {
      for (const squad of section.squads) {
        expect(initialOf(names.nameOf(squad))).toBe(section.letter);
      }
    }
  });

  it('keeps the displayed order inside a letter', () => {
    for (const section of sections) {
      const shown = section.squads.map((q) => names.nameOf(q));
      expect([...shown].sort((a, b) => a.localeCompare(b, language))).toEqual(shown);
    }
  });
});

describe('nationSections with a search', () => {
  it('keeps only the matching nations, still grouped', () => {
    const sections = nationSections(listSquads(), namesIn('en'), 'spa');
    expect(sections.map((s) => s.letter)).toEqual(['S']);
    expect(sections[0]?.squads.map((q) => q.name)).toContain('Spain');
  });

  it('is empty when nothing matches', () => {
    expect(nationSections(listSquads(), namesIn('en'), 'zzzz')).toEqual([]);
  });
});

describe('letterAt', () => {
  const offsets = [
    { letter: 'A', y: 400 },
    { letter: 'B', y: 900 },
    { letter: 'C', y: 1300 },
  ];
  it('is the first letter above the first heading', () => {
    expect(letterAt(offsets, 0)).toBe('A');
  });
  it('is the last heading at or above the offset', () => {
    expect(letterAt(offsets, 900)).toBe('B');
    expect(letterAt(offsets, 1299)).toBe('B');
    expect(letterAt(offsets, 5000)).toBe('C');
  });
  it('is null with no headings', () => {
    expect(letterAt([], 100)).toBeNull();
  });
});

describe('kindCounts', () => {
  it('counts every squad of each kind with no search', () => {
    const squads = listSquads();
    const counts = kindCounts(squads, namesIn('en'));
    expect(counts.club + counts.nation).toBe(squads.length);
  });
  it('counts the matches on each tab with a search', () => {
    const counts = kindCounts(listSquads(), namesIn('en'), 'spain');
    expect(counts.nation).toBe(1);
  });
});

describe('scoreBlock', () => {
  it('waits while the store hydrates', () => {
    expect(scoreBlock(undefined)).toEqual({ kind: 'hydrating' });
  });
  it('is unplayed for a team with no score', () => {
    expect(scoreBlock(null)).toEqual({ kind: 'unplayed' });
  });
  it('shows the highest level and its best', () => {
    expect(scoreBlock({ level: 2, correct: 7, total: 10, cleared: true })).toEqual({
      kind: 'played',
      level: 2,
      correct: 7,
      total: 10,
      flawless: false,
    });
  });
  it('marks 10/10 as flawless', () => {
    expect(scoreBlock({ level: 3, correct: 10, total: 10, cleared: true })).toMatchObject({
      flawless: true,
    });
  });
});
