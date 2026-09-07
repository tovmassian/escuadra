import { describe, expect, it } from 'vitest';
import { validateRegistry, wikiTitleFromSource, type TeamRegistryEntry } from './registry.ts';

const marker = { bands: ['#FFFFFF', '#E20001'], orientation: 'vertical' as const };
const entry = (over: Partial<TeamRegistryEntry> = {}): TeamRegistryEntry => ({
  id: 'sev',
  kind: 'club',
  league: 'la-liga',
  name: 'Sevilla',
  source: 'https://en.wikipedia.org/wiki/Sevilla_FC',
  identity: { primaryColor: '#FFFFFF', secondaryColor: '#E20001', marker },
  ...over,
});

describe('wikiTitleFromSource', () => {
  it('restores underscores to spaces', () => {
    expect(wikiTitleFromSource('https://en.wikipedia.org/wiki/Sevilla_FC')).toBe('Sevilla FC');
  });

  it('percent-decodes a title', () => {
    expect(wikiTitleFromSource('https://en.wikipedia.org/wiki/Atl%C3%A9tico_Madrid')).toBe(
      'Atlético Madrid',
    );
  });

  it('drops an anchor', () => {
    expect(wikiTitleFromSource('https://en.wikipedia.org/wiki/Arsenal_F.C.#Players')).toBe(
      'Arsenal F.C.',
    );
  });

  it('refuses anything that is not an en.wikipedia article', () => {
    expect(wikiTitleFromSource('https://es.wikipedia.org/wiki/Sevilla_FC')).toBeNull();
    expect(wikiTitleFromSource('https://en.wikipedia.org/wiki/')).toBeNull();
    expect(wikiTitleFromSource('not a url')).toBeNull();
  });
});

describe('validateRegistry', () => {
  it('accepts a well-formed registry', () => {
    expect(
      validateRegistry([entry(), entry({ id: 'esp', kind: 'nation', league: undefined })]),
    ).toEqual([]);
  });

  it('rejects a non-array', () => {
    expect(validateRegistry({})).toHaveLength(1);
  });

  it('catches a duplicate team id', () => {
    expect(validateRegistry([entry(), entry()]).join()).toContain('duplicate team id sev');
  });

  it('requires league on a club and forbids it on a nation', () => {
    expect(validateRegistry([entry({ league: undefined })]).join()).toContain(
      'league is required on club entries',
    );
    expect(validateRegistry([entry({ kind: 'nation' })]).join()).toContain(
      'league must be absent on nation entries',
    );
  });

  it('rejects a league outside the closed set', () => {
    expect(
      validateRegistry([entry({ league: 'eredivisie' as TeamRegistryEntry['league'] })]).join(),
    ).toContain('league must be one of');
  });

  // The rule that stops a maintenance run from inventing a colour.
  it('treats a missing identity as an error rather than a default', () => {
    const { identity: _identity, ...withoutIdentity } = entry();
    expect(validateRegistry([withoutIdentity]).join()).toContain('identity is required');
  });

  it('rejects a malformed colour or marker', () => {
    expect(
      validateRegistry([
        entry({ identity: { primaryColor: 'white', secondaryColor: '#E20001', marker } }),
      ]).join(),
    ).toContain('six-digit hex colour');
    expect(
      validateRegistry([
        entry({
          identity: {
            primaryColor: '#FFFFFF',
            secondaryColor: '#E20001',
            marker: { bands: [], orientation: 'vertical' },
          },
        }),
      ]).join(),
    ).toContain('non-empty bands array');
  });

  it('rejects a source that is not a Wikipedia article URL', () => {
    expect(validateRegistry([entry({ source: 'https://example.com/sevilla' })]).join()).toContain(
      'article URL',
    );
  });
});
