import { describe, expect, it } from 'vitest';
import type { TeamRegistryEntry } from './registry.ts';
import { selectTeams } from './select.ts';

function entry(
  over: Partial<TeamRegistryEntry> & Pick<TeamRegistryEntry, 'id'>,
): TeamRegistryEntry {
  return {
    kind: 'club',
    league: 'la-liga',
    name: over.id,
    source: `https://en.wikipedia.org/wiki/${over.id}`,
    identity: {
      primaryColor: '#FFFFFF',
      secondaryColor: '#000000',
      marker: { bands: ['#FFFFFF'], orientation: 'vertical' },
    },
    ...over,
  };
}

const registry: TeamRegistryEntry[] = [
  entry({ id: 'sev', kind: 'club', league: 'la-liga' }),
  entry({ id: 'ath', kind: 'club', league: 'la-liga' }),
  entry({ id: 'int', kind: 'club', league: 'serie-a' }),
  entry({ id: 'esp', kind: 'nation', league: undefined }),
];

describe('selectTeams', () => {
  it('returns every registry entry when no flags are set', () => {
    const { selected, missing } = selectTeams(registry, {});
    expect(selected).toEqual(registry);
    expect(missing).toEqual([]);
  });

  it('--only selects the matching ids and reports which ones are unknown', () => {
    const { selected, missing } = selectTeams(registry, { only: 'sev,made-up,esp' });
    expect(selected.map((e) => e.id)).toEqual(['sev', 'esp']);
    expect(missing).toEqual(['made-up']);
  });

  it('--league restricts to one league', () => {
    const { selected, missing } = selectTeams(registry, { league: 'la-liga' });
    expect(selected.map((e) => e.id)).toEqual(['sev', 'ath']);
    expect(missing).toEqual([]);
  });

  it('--kind restricts to clubs or nations', () => {
    const { selected } = selectTeams(registry, { kind: 'nation' });
    expect(selected.map((e) => e.id)).toEqual(['esp']);
  });

  it('combines --only, --league and --kind', () => {
    const { selected, missing } = selectTeams(registry, {
      only: 'sev,ath,int',
      league: 'la-liga',
      kind: 'club',
    });
    expect(selected.map((e) => e.id)).toEqual(['sev', 'ath']);
    expect(missing).toEqual([]);
  });
});
