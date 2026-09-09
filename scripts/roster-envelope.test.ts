import { describe, expect, it } from 'vitest';
import {
  BLAST_RADIUS_THRESHOLD,
  LEAGUES,
  baseTitle,
  changeRatio,
  isTransliterationVariant,
  normalizeName,
  titlesEquivalent,
  validateEnvelope,
  type RosterEnvelope,
} from './roster-envelope';

function validEnvelope(): RosterEnvelope {
  return {
    status: 'OK',
    team: {
      id: 'esp',
      kind: 'nation',
      name: 'Spain',
      season: '2026',
      source: 'https://en.wikipedia.org/wiki/Spain_national_football_team',
      sectionTitle: 'Current squad',
      asOf: '2026-06-10',
    },
    members: [
      {
        name: 'David Raya',
        no: 1,
        position: 'GK',
        club: 'Arsenal',
        birth: '1995-09-15',
        raw: '{{nat fs g player|no=1|pos=GK|name=[[David Raya]]}}',
      },
    ],
    warnings: [],
  };
}

describe('validateEnvelope', () => {
  it('accepts a well-formed nation envelope', () => {
    expect(validateEnvelope(validEnvelope())).toEqual([]);
  });

  it('rejects a status outside the closed set', () => {
    const env = { ...validEnvelope(), status: 'FINE' };
    expect(validateEnvelope(env).join(' ')).toMatch(/status must be one of/);
  });

  it('rejects OK with zero members, because an empty roster is never written', () => {
    const env = { ...validEnvelope(), members: [] };
    expect(validateEnvelope(env).join(' ')).toMatch(/zero parsed members is PARSE_FAILED/);
  });

  it('allows zero members when the status is already a failure', () => {
    const env = { ...validEnvelope(), status: 'PARSE_FAILED' as const, members: [] };
    expect(validateEnvelope(env)).toEqual([]);
  });

  it('rejects duplicate shirt numbers within one squad', () => {
    const env = validEnvelope();
    const first = env.members[0];
    if (!first) throw new Error('fixture must have a member');
    env.members = [first, { ...first, name: 'Someone Else' }];
    expect(validateEnvelope(env).join(' ')).toMatch(/duplicate shirt number 1/);
  });

  it('requires league on a club squad', () => {
    const env = validEnvelope();
    env.team = { ...env.team, kind: 'club' };
    expect(validateEnvelope(env).join(' ')).toMatch(/team\.league is required/);
  });

  it('accepts a club squad whose league is in the closed set', () => {
    const env = validEnvelope();
    env.team = { ...env.team, kind: 'club', league: 'premier-league' };
    expect(validateEnvelope(env)).toEqual([]);
  });

  it('accepts every league gen-squads.ts recognises', () => {
    for (const league of LEAGUES) {
      const env = validEnvelope();
      env.team = { ...env.team, kind: 'club', league };
      expect(validateEnvelope(env), `league ${league} should be accepted`).toEqual([]);
    }
  });

  it('rejects a league outside the closed set at the gate, not in the generator', () => {
    const env = validEnvelope();
    env.team = { ...env.team, kind: 'club', league: 'eredivisie' as never };
    expect(validateEnvelope(env).join(' ')).toMatch(/team\.league must be one of/);
  });

  it('forbids league on a nation squad', () => {
    const env = validEnvelope();
    env.team = { ...env.team, league: 'la-liga' };
    expect(validateEnvelope(env).join(' ')).toMatch(/team\.league must be absent/);
  });

  it('rejects a member with a position outside GK/DF/MF/FW', () => {
    const env = validEnvelope();
    const first = env.members[0];
    if (!first) throw new Error('fixture must have a member');
    env.members = [{ ...first, position: 'ST' as never }];
    expect(validateEnvelope(env).join(' ')).toMatch(/position must be one of/);
  });

  it('requires the raw wikitext line on every member', () => {
    const env = validEnvelope();
    const first = env.members[0];
    if (!first) throw new Error('fixture must have a member');
    env.members = [{ ...first, raw: '' }];
    expect(validateEnvelope(env).join(' ')).toMatch(/raw must be a non-empty string/);
  });

  it('rejects identity colours that are not six-digit hex', () => {
    const env = validEnvelope();
    env.identity = {
      primaryColor: 'red',
      secondaryColor: '#FFCC00',
      marker: { bands: ['#AA151B'], orientation: 'horizontal' },
    };
    expect(validateEnvelope(env).join(' ')).toMatch(/primaryColor must be a six-digit hex/);
  });
});

describe('transliteration', () => {
  // NFD only strips COMBINING marks. These letters carry the mark inside the
  // glyph, so without an explicit table two sources spelling one player
  // differently would never match.
  it('folds letters NFD cannot decompose', () => {
    expect(normalizeName('Martin Ødegaard')).toBe('martin odegaard');
    expect(normalizeName('Martin Odegaard')).toBe('martin odegaard');
    expect(normalizeName('Luka Đorđević')).toBe('luka dordevic');
  });

  it('flags a match that only held because of transliteration', () => {
    expect(isTransliterationVariant('Martin Ødegaard', 'Martin Odegaard')).toBe(true);
  });

  it('does not flag identical names, or ones plain diacritic stripping matched', () => {
    expect(isTransliterationVariant('Martin Ødegaard', 'Martin Ødegaard')).toBe(false);
    expect(isTransliterationVariant('Éderson', 'Ederson')).toBe(false);
  });
});

describe('normalizeName', () => {
  it('strips diacritics and case so the same player matches across pages', () => {
    expect(normalizeName('Lautaro Martínez')).toBe('lautaro martinez');
  });

  it('collapses incidental whitespace', () => {
    expect(normalizeName('  Kepa   Arrizabalaga ')).toBe('kepa arrizabalaga');
  });

  it('leaves an already-normal name alone', () => {
    expect(normalizeName('Tommy Setford')).toBe('tommy setford');
  });
});

describe('changeRatio', () => {
  it('is 0 for identical rosters regardless of order', () => {
    expect(changeRatio(['A B', 'C D'], ['C D', 'A B'])).toBe(0);
  });

  it('is 0 for rosters differing only by diacritics', () => {
    expect(changeRatio(['Lautaro Martínez'], ['Lautaro Martinez'])).toBe(0);
  });

  it('is 1 for wholly disjoint rosters', () => {
    expect(changeRatio(['A B'], ['C D'])).toBe(1);
  });

  it('stays under the blast-radius threshold for one change in a full squad', () => {
    const stored = Array.from({ length: 26 }, (_, i) => `Player ${i}`);
    const parsed = [...stored.slice(0, 25), 'New Signing'];
    expect(changeRatio(stored, parsed)).toBeLessThan(BLAST_RADIUS_THRESHOLD);
  });

  it('exceeds the blast-radius threshold when most of a squad changes', () => {
    const stored = Array.from({ length: 26 }, (_, i) => `Player ${i}`);
    const parsed = Array.from({ length: 26 }, (_, i) => `Other ${i}`);
    expect(changeRatio(stored, parsed)).toBeGreaterThan(BLAST_RADIUS_THRESHOLD);
  });
});

describe('titlesEquivalent', () => {
  // Every row is a real pair from the envelope cache. The `true` rows are one
  // person linked through a redirect; the `false` rows are two different real
  // people. If a change makes any row flip, it merges or splits real players.
  const cases: [string, string, boolean, string][] = [
    ['Endrick', 'Endrick (footballer, born 2006)', true, 'link to the undisambiguated redirect'],
    [
      'Eric Garcia (footballer, born 2001)',
      'Eric García (footballer, born 2001)',
      true,
      'same title, one source drops the accent',
    ],
    [
      'Otávio (footballer, born November 2005)',
      'Otávio (footballer, born 2002)',
      false,
      'two Brazilian defenders, Frankfurt and Paris FC',
    ],
    [
      'Vitinha (footballer, born February 2000)',
      'Vitinha (footballer, born March 2000)',
      false,
      'two Portuguese midfielders, PSG and Genoa',
    ],
    [
      'Ederson (footballer, born 1993)',
      'Éderson (footballer, born 1999)',
      false,
      'both in the Brazil squad; the base folds together, the year does not',
    ],
    [
      'Nico González (footballer, born 2002)',
      'Nicolás González (footballer, born 1998)',
      false,
      'Newcastle and Juventus, both rendered "Nico González"',
    ],
    ['Endrick', 'Endrick', true, 'identical'],
  ];

  for (const [a, b, expected, why] of cases) {
    it(`${expected ? 'relates' : 'separates'} ${a} / ${b} — ${why}`, () => {
      expect(titlesEquivalent(a, b)).toBe(expected);
      expect(titlesEquivalent(b, a)).toBe(expected);
    });
  }
});

describe('baseTitle', () => {
  it('strips a trailing parenthetical disambiguator', () => {
    expect(baseTitle('Endrick (footballer, born 2006)')).toBe('Endrick');
  });

  it('leaves an undisambiguated title alone', () => {
    expect(baseTitle('Endrick')).toBe('Endrick');
  });

  it('leaves a parenthetical that is not trailing alone', () => {
    expect(baseTitle('Sporting CP (B) squad')).toBe('Sporting CP (B) squad');
  });
});
