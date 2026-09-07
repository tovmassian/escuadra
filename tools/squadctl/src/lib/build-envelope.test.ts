import { describe, expect, it } from 'vitest';
import { SEASON, buildEnvelope } from './build-envelope.ts';
import type { TeamRegistryEntry } from './registry.ts';
import { parseSection } from './wikitext-parse.ts';

const identity = {
  primaryColor: '#FFFFFF',
  secondaryColor: '#E20001',
  marker: { bands: ['#FFFFFF', '#E20001'], orientation: 'vertical' as const },
};

const club: TeamRegistryEntry = {
  id: 'sev',
  kind: 'club',
  league: 'la-liga',
  name: 'Sevilla',
  source: 'https://en.wikipedia.org/wiki/Sevilla_FC',
  identity,
};

const nation: TeamRegistryEntry = {
  id: 'esp',
  kind: 'nation',
  name: 'Spain',
  source: 'https://en.wikipedia.org/wiki/Spain_national_football_team',
  identity,
};

const build = (entry: TeamRegistryEntry, wikitext: string, sectionTitle = 'Current squad') =>
  buildEnvelope({
    entry,
    sectionTitle: sectionTitle as 'Current squad',
    parsed: parseSection(wikitext),
  });

describe('buildEnvelope — club squad', () => {
  const { envelope, failures } = build(
    club,
    `{{updated|1 September 2026}}
{{Fs player|no=1|nat=GRE|pos=GK|name=[[Odysseas Vlachodimos]]}}
{{Fs player|no=2|nat=CIV|pos=DF|name=[[A Defender]]|other=[[Captain (association football)|captain]]}}
{{Fs player|no=|nat=ESP|pos=MF|name=[[A Newcomer]]}}`,
  );

  it('produces a valid envelope', () => {
    expect(failures).toEqual([]);
    expect(envelope?.status).toBe('OK');
    expect(envelope?.team.season).toBe(SEASON.club);
    expect(envelope?.team.league).toBe('la-liga');
    expect(envelope?.identity).toEqual(identity);
  });

  it('translates the nat code into the spelling players.json stores', () => {
    expect(envelope?.members.map((m) => m.nationality)).toEqual(['Greece', 'Ivory Coast', 'Spain']);
  });

  it('sets every member club to the registry name, since a club squad has no per-member club', () => {
    expect(envelope?.members.every((m) => m.club === 'Sevilla')).toBe(true);
  });

  it('keeps the numberless member rather than dropping it', () => {
    expect(envelope?.members.map((m) => m.no)).toEqual([1, 2, null]);
  });

  it('carries exactly one captain', () => {
    expect(envelope?.members.filter((m) => m.captain === true)).toHaveLength(1);
  });

  it('leaves birth unset, since club wikitext never carries one', () => {
    expect(envelope?.members.every((m) => m.birth === undefined)).toBe(true);
  });
});

describe('buildEnvelope — nation squad', () => {
  const { envelope } = build(
    nation,
    `{{nat fs player|no=1|pos=GK|name=[[Unai Simón]]|age={{birth date and age|df=y|1997|6|11}}|club=[[Athletic Bilbao]]}}
{{nat fs player|no=5|pos=MF|name=[[Rodri (footballer, born 1996)|Rodri]]|age={{birth date and age|df=y|1996|6|22}}|club=[[Manchester City]]}}`,
  );

  it('gives every member the squad country, since a nation squad has no nat field', () => {
    expect(envelope?.members.map((m) => m.nationality)).toEqual(['Spain', 'Spain']);
  });

  it('takes each member own club and birth date from the wikitext', () => {
    expect(envelope?.members.map((m) => m.club)).toEqual(['Athletic Bilbao', 'Manchester City']);
    expect(envelope?.members.map((m) => m.birth)).toEqual(['1997-06-11', '1996-06-22']);
  });

  it('uses the nation season and carries no league', () => {
    expect(envelope?.team.season).toBe(SEASON.nation);
    expect(envelope?.team.league).toBeUndefined();
  });
});

describe('buildEnvelope — the team is not written at all', () => {
  it('fails on an unmapped FIFA code rather than passing it through as a nationality', () => {
    const { envelope, failures } = build(
      club,
      '{{Fs player|no=1|nat=ZZZ|pos=GK|name=[[A Keeper]]}}',
    );
    expect(envelope).toBeNull();
    expect(failures.join()).toContain('unmapped FIFA code ZZZ');
  });

  it('fails on a position outside GK/DF/MF/FW', () => {
    const { envelope, failures } = build(
      club,
      '{{Fs player|no=1|nat=ESP|pos=SW|name=[[A Sweeper]]}}',
    );
    expect(envelope).toBeNull();
    expect(failures.join()).toContain('not one of GK/DF/MF/FW');
  });

  it('fails on a shirt number outside 1-99', () => {
    const { failures } = build(club, '{{Fs player|no=100|nat=ESP|pos=GK|name=[[A Keeper]]}}');
    expect(failures.join()).toContain('outside 1-99');
  });

  // A blank no= is legitimate; a non-empty one that will not parse is not.
  it('tells an unparseable shirt number apart from a deliberately blank one', () => {
    expect(build(club, '{{Fs player|no=|nat=ESP|pos=GK|name=[[A]]}}').failures).toEqual([]);
    expect(
      build(club, '{{Fs player|no=nine|nat=ESP|pos=GK|name=[[A]]}}').failures.join(),
    ).toContain('is not a shirt number');
  });

  it('fails when the section parsed no members at all', () => {
    expect(build(club, '{{fs start}}{{fs end}}').failures.join()).toContain('zero members');
  });

  it('fails on a duplicate shirt number, via the shared envelope contract', () => {
    const { envelope, failures } = build(
      club,
      `{{Fs player|no=1|nat=ESP|pos=GK|name=[[A One]]}}
{{Fs player|no=1|nat=ESP|pos=DF|name=[[B Two]]}}`,
    );
    expect(envelope).toBeNull();
    expect(failures.join()).toContain('duplicate shirt number');
  });
});

describe('buildEnvelope — flagged for review', () => {
  it('flags a call-ups section as needing a decision rather than failing', () => {
    const { envelope } = build(
      nation,
      '{{nat fs player|no=|pos=GK|name=[[A Keeper]]|club=[[Arsenal]]}}',
      'Recent call-ups',
    );
    expect(envelope?.status).toBe('NEEDS_DECISION');
    expect(envelope?.warnings.join()).toContain('not a contract roster');
  });

  it('flags an unrecognised player-ish template instead of quietly parsing a short squad', () => {
    const { envelope } = build(
      club,
      `{{Fs player|no=1|nat=ESP|pos=GK|name=[[A Keeper]]}}
{{football squad player|no=2|nat=ESP|pos=DF|name=[[B Back]]}}`,
    );
    expect(envelope?.members).toHaveLength(1);
    expect(envelope?.warnings.join()).toContain('football squad player');
  });
});
