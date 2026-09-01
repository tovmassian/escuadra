import { describe, expect, it } from 'vitest';
import {
  BLAST_RADIUS_THRESHOLD,
  LEAGUES,
  changeRatio,
  normalizeName,
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
