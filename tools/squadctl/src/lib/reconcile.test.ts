import { describe, expect, it } from 'vitest';
import type { EnvelopeMember, RosterEnvelope } from '../../../../scripts/roster-envelope.ts';
import type { Player, Squad } from '../../../../types/squad.ts';
import { looksLikeRename, playerId, reconcileTeam } from './reconcile.ts';

const identity = {
  primaryColor: '#FFFFFF',
  secondaryColor: '#E20001',
  marker: { bands: ['#FFFFFF'], orientation: 'vertical' as const },
};

const player = (over: Partial<Player> & { id: string; name: string }): Player => ({
  fullName: over.name,
  birth: '1995-01-01',
  position: 'MF',
  nationality: 'Spain',
  club: 'Sevilla',
  photo: null,
  wikiTitle: null,
  ...over,
});

const row = (over: Partial<EnvelopeMember> & { name: string }): EnvelopeMember => ({
  no: 1,
  position: 'MF',
  nationality: 'Spain',
  club: 'Sevilla',
  raw: '{{Fs player}}',
  ...over,
});

const envelope = (
  members: EnvelopeMember[],
  over: Partial<RosterEnvelope['team']> = {},
): RosterEnvelope => ({
  status: 'OK',
  team: {
    id: 'sev',
    kind: 'club',
    name: 'Sevilla',
    league: 'la-liga',
    season: '2026/27',
    source: 'https://en.wikipedia.org/wiki/Sevilla_FC',
    sectionTitle: 'Current squad',
    asOf: '2026-09-01',
    ...over,
  },
  identity,
  members,
  warnings: [],
});

const squad = (members: Squad['members']): Squad => ({
  id: 'sev',
  kind: 'club',
  name: 'Sevilla',
  season: '2026/27',
  primaryColor: '#FFFFFF',
  secondaryColor: '#E20001',
  verified: true,
  marker: identity.marker,
  lastUpdated: '2026-01-01',
  source: 'https://en.wikipedia.org/wiki/Sevilla_FC',
  members,
});

describe('playerId', () => {
  it('builds firstname-lastname rather than a bare surname', () => {
    expect(playerId('David Raya', new Set())).toBe('david-raya');
    expect(playerId('Martin Ødegaard', new Set())).toBe('martin-odegaard');
  });

  it('appends a numeric suffix on collision', () => {
    expect(playerId('David Raya', new Set(['david-raya']))).toBe('david-raya-2');
    expect(playerId('David Raya', new Set(['david-raya', 'david-raya-2']))).toBe('david-raya-3');
  });
});

describe('looksLikeRename', () => {
  it('catches the forms seen live on Wikipedia', () => {
    expect(looksLikeRename('Alejandro Grimaldo', 'Álex Grimaldo')).toBe(true);
    expect(looksLikeRename('Dro', 'Dro Fernández')).toBe(true);
    expect(looksLikeRename('Giovani Lo Celso', 'Giovanni Lo Celso')).toBe(true);
  });

  it('does not fire on two unrelated names', () => {
    expect(looksLikeRename('David Raya', 'Bukayo Saka')).toBe(false);
  });

  it('does not fire on an identical name, which would have matched already', () => {
    expect(looksLikeRename('David Raya', 'David Raya')).toBe(false);
  });
});

describe('reconcileTeam', () => {
  it('matches a stored member and inherits its birth date for free', () => {
    const stored = player({ id: 'raya', name: 'David Raya', birth: '1995-09-15', position: 'GK' });
    const plan = reconcileTeam({
      envelope: envelope([row({ name: 'David Raya', no: 1, position: 'GK' })]),
      storedSquad: squad([{ playerId: 'raya', no: 1 }]),
      players: [stored],
    });
    expect(plan.newPlayers).toEqual([]);
    expect(plan.matchedCount).toBe(1);
    expect(plan.squad.members).toEqual([{ playerId: 'raya', no: 1 }]);
  });

  it('removes an unmatched stored member but keeps the player record', () => {
    const plan = reconcileTeam({
      envelope: envelope([row({ name: 'David Raya', no: 1 })]),
      storedSquad: squad([
        { playerId: 'raya', no: 1 },
        { playerId: 'gone', no: 2 },
      ]),
      players: [
        player({ id: 'raya', name: 'David Raya' }),
        player({ id: 'gone', name: 'A Leaver' }),
      ],
    });
    expect(plan.departed).toEqual([{ id: 'gone', name: 'A Leaver' }]);
    expect(plan.squad.members.map((m) => m.playerId)).toEqual(['raya']);
  });

  // §13 item 7.
  it('reports an ambiguous global match as a conflict rather than merging', () => {
    const plan = reconcileTeam({
      envelope: envelope([row({ name: 'Ederson', no: 23, position: 'GK' })]),
      storedSquad: null,
      players: [
        player({ id: 'ederson', name: 'Ederson', position: 'GK', club: 'Fenerbahçe' }),
        player({ id: 'ederson-silva', name: 'Éderson', position: 'MF', club: 'Atalanta' }),
      ],
    });
    expect(plan.ambiguous).toEqual([
      { name: 'Ederson', candidateIds: ['ederson', 'ederson-silva'] },
    ]);
    expect(plan.newPlayers).toEqual([]);
    // Nothing to hold — neither candidate is in this squad — so the row is
    // left out, and the omission is named rather than silent.
    expect(plan.omitted.map((o) => o.name)).toEqual(['Ederson']);
  });

  // Same name, same position, same club, and both shirt numbers changed, so
  // none of the discriminators separates them.
  it('holds an unresolvable in-squad collision instead of shortening the squad', () => {
    const plan = reconcileTeam({
      envelope: envelope([row({ name: 'Same Name', no: 6 }), row({ name: 'Same Name', no: 7 })]),
      storedSquad: squad([
        { playerId: 'a-one', no: 4 },
        { playerId: 'a-two', no: 5 },
      ]),
      players: [
        player({ id: 'a-one', name: 'Same Name' }),
        player({ id: 'a-two', name: 'Same Name' }),
      ],
    });
    expect(plan.ambiguous).toHaveLength(1);
    expect(plan.squad.members.map((m) => m.playerId).sort()).toEqual(['a-one', 'a-two']);
    expect(plan.departed).toEqual([]);
    expect(plan.newPlayers).toEqual([]);
  });

  // §13 item 8 — the case a live run found on five of 29 teams.
  describe('a probable rename', () => {
    const base = {
      envelope: envelope([row({ name: 'Álex Grimaldo', no: 3 })], {
        id: 'esp',
        kind: 'nation' as const,
        league: undefined,
      }),
      storedSquad: squad([{ playerId: 'grimaldo', no: 3 }]),
      players: [player({ id: 'grimaldo', name: 'Alejandro Grimaldo', birth: '1995-09-20' })],
    };

    it('is reported', () => {
      expect(reconcileTeam(base).possibleRenames).toEqual([
        {
          departedId: 'grimaldo',
          departedName: 'Alejandro Grimaldo',
          arrivedName: 'Álex Grimaldo',
          arrivedId: 'alex-grimaldo',
        },
      ]);
    });

    // The whole point of the hold. Creating the record and flagging afterwards
    // put five duplicate people into players.json, each with the birth date
    // dropped, and no later command undid it.
    it('creates NO player record and keeps the slot on the stored id', () => {
      const plan = reconcileTeam(base);
      expect(plan.newPlayers).toEqual([]);
      expect(plan.squad.members).toEqual([{ playerId: 'grimaldo', no: 3 }]);
      expect(plan.departed).toEqual([]);
    });

    // The Grimaldo case: two articles, two spellings, one man. Neither rename
    // nor split can express it without lying.
    it('matches under a recorded alias, raising nothing at all', () => {
      const plan = reconcileTeam({
        ...base,
        aliases: [{ player: 'grimaldo', name: 'Álex Grimaldo' }],
      });
      expect(plan.possibleRenames).toEqual([]);
      expect(plan.newPlayers).toEqual([]);
      expect(plan.departed).toEqual([]);
      expect(plan.squad.members).toEqual([{ playerId: 'grimaldo', no: 3 }]);
    });

    it('writes the split once a person has confirmed they are two people', () => {
      const plan = reconcileTeam({
        ...base,
        acceptedSplits: [{ team: 'esp', departed: 'grimaldo', arrived: 'Álex Grimaldo' }],
      });
      expect(plan.possibleRenames).toEqual([]);
      expect(plan.newPlayers.map((p) => p.id)).toEqual(['alex-grimaldo']);
      expect(plan.departed.map((d) => d.id)).toEqual(['grimaldo']);
    });
  });

  // Brazil really does carry two different people who normalise identically.
  it('separates two stored members sharing a normalised name, using position', () => {
    const players = [
      player({ id: 'ederson', name: 'Ederson', position: 'GK', club: 'Fenerbahçe' }),
      player({ id: 'ederson-silva', name: 'Éderson', position: 'MF', club: 'Atalanta' }),
    ];
    const plan = reconcileTeam({
      envelope: envelope([
        row({ name: 'Ederson', no: 23, position: 'GK', club: 'Fenerbahçe' }),
        row({ name: 'Éderson', no: 2, position: 'MF', club: 'Atalanta' }),
      ]),
      storedSquad: squad([
        { playerId: 'ederson', no: 23 },
        { playerId: 'ederson-silva', no: 2 },
      ]),
      players,
    });
    expect(plan.ambiguous).toEqual([]);
    expect(plan.newPlayers).toEqual([]);
    expect(plan.departed).toEqual([]);
    expect(plan.squad.members).toEqual([
      { playerId: 'ederson-silva', no: 2 },
      { playerId: 'ederson', no: 23 },
    ]);
  });

  it('sorts members by shirt number with the numberless last', () => {
    const plan = reconcileTeam({
      envelope: envelope([
        row({ name: 'C Three', no: null }),
        row({ name: 'B Two', no: 9 }),
        row({ name: 'A One', no: 1 }),
      ]),
      storedSquad: null,
      players: [],
    });
    expect(plan.squad.members.map((m) => m.no)).toEqual([1, 9, null]);
    expect(plan.numberlessCount).toBe(1);
  });

  it('skips the blast-radius check when there is no stored squad', () => {
    const plan = reconcileTeam({
      envelope: envelope([row({ name: 'A One' })]),
      storedSquad: null,
      players: [],
    });
    expect(plan.blastRadius).toBeNull();
    expect(plan.hadStoredSquad).toBe(false);
  });

  it('writes identity through from the envelope, never from what was stored', () => {
    const plan = reconcileTeam({
      envelope: envelope([row({ name: 'A One' })]),
      storedSquad: squad([]),
      players: [],
    });
    expect(plan.squad.primaryColor).toBe(identity.primaryColor);
    expect(plan.squad.marker).toEqual(identity.marker);
  });

  it('gives a brand-new player a null birth date without complaint', () => {
    const plan = reconcileTeam({
      envelope: envelope([row({ name: 'New Signing' })]),
      storedSquad: null,
      players: [],
    });
    expect(plan.newPlayers[0]?.birth).toBeNull();
    expect(plan.noBirthCount).toBe(1);
  });
});

describe('title-decisive matching', () => {
  it('matches on title even when the display names differ', () => {
    // Juventus renders "Nico González"; the record stores "Nicolás González".
    // Only the shared article title can join these two.
    const stored = [
      player({
        id: 'gonzalez',
        name: 'Nicolás González',
        wikiTitle: 'Nicolás González (footballer, born 1998)',
      }),
    ];
    const plan = reconcileTeam({
      envelope: envelope([
        row({ name: 'Nico González', title: 'Nicolás González (footballer, born 1998)' }),
      ]),
      storedSquad: squad([{ playerId: 'gonzalez', no: 10 }]),
      players: stored,
    });
    expect(plan.squad.members.map((m) => m.playerId)).toEqual(['gonzalez']);
    expect(plan.newPlayers).toEqual([]);
    expect(plan.possibleRenames).toEqual([]);
  });

  it('relates a redirect to the article it redirects to', () => {
    // Real Madrid links [[Endrick]]; Brazil links the disambiguated title.
    const stored = [player({ id: 'endrick', name: 'Endrick', wikiTitle: 'Endrick' })];
    const plan = reconcileTeam({
      envelope: envelope([row({ name: 'Endrick', title: 'Endrick (footballer, born 2006)' })]),
      storedSquad: squad([{ playerId: 'endrick', no: 9 }]),
      players: stored,
    });
    expect(plan.squad.members.map((m) => m.playerId)).toEqual(['endrick']);
    expect(plan.newPlayers).toEqual([]);
  });

  it('back-fills a null stored title from the row', () => {
    const stored = [player({ id: 'raya', name: 'David Raya', wikiTitle: null })];
    const plan = reconcileTeam({
      envelope: envelope([row({ name: 'David Raya', title: 'David Raya' })]),
      storedSquad: squad([{ playerId: 'raya', no: 1 }]),
      players: stored,
    });
    expect(plan.updatedPlayers[0]?.wikiTitle).toBe('David Raya');
  });

  it('never overwrites a stored title from the row — that is retitle', () => {
    const stored = [player({ id: 'endrick', name: 'Endrick', wikiTitle: 'Endrick' })];
    const plan = reconcileTeam({
      envelope: envelope([row({ name: 'Endrick', title: 'Endrick (footballer, born 2006)' })]),
      storedSquad: squad([{ playerId: 'endrick', no: 9 }]),
      players: stored,
    });
    expect(plan.updatedPlayers.some((p) => p.id === 'endrick' && p.wikiTitle !== 'Endrick')).toBe(
      false,
    );
  });

  it('gives a genuinely new player the row title', () => {
    const plan = reconcileTeam({
      envelope: envelope([row({ name: 'Otávio', title: 'Otávio (footballer, born 2002)' })]),
      storedSquad: null,
      players: [],
    });
    expect(plan.newPlayers[0]?.wikiTitle).toBe('Otávio (footballer, born 2002)');
  });

  it('leaves a row with no title to name matching, exactly as before', () => {
    const stored = [player({ id: 'raya', name: 'David Raya', wikiTitle: 'David Raya' })];
    const plan = reconcileTeam({
      envelope: envelope([row({ name: 'David Raya' })]),
      storedSquad: squad([{ playerId: 'raya', no: 1 }]),
      players: stored,
    });
    expect(plan.squad.members.map((m) => m.playerId)).toEqual(['raya']);
  });

  it('matches a recorded title alias', () => {
    // Atlético links "Alejandro Grimaldo"; the record stores Spain's title.
    const stored = [player({ id: 'grimaldo', name: 'Álex Grimaldo', wikiTitle: 'Álex Grimaldo' })];
    const plan = reconcileTeam({
      envelope: envelope([row({ name: 'Alejandro Grimaldo', title: 'Alejandro Grimaldo' })]),
      storedSquad: squad([{ playerId: 'grimaldo', no: 3 }]),
      players: stored,
      titleAliases: [{ player: 'grimaldo', title: 'Alejandro Grimaldo' }],
    });
    expect(plan.squad.members.map((m) => m.playerId)).toEqual(['grimaldo']);
    expect(plan.newPlayers).toEqual([]);
  });

  it('holds the group when a bare title relates to two stored people', () => {
    // A bare [[Otávio]] against two stored Otávios: base equivalence relates
    // it to both and picking one would be a coin flip.
    const stored = [
      player({ id: 'otavio', name: 'Otávio', wikiTitle: 'Otávio (footballer, born 2002)' }),
      player({
        id: 'otavio-2',
        name: 'Otávio',
        wikiTitle: 'Otávio (footballer, born November 2005)',
      }),
    ];
    const plan = reconcileTeam({
      envelope: envelope([row({ name: 'Otávio', title: 'Otávio' })]),
      storedSquad: squad([
        { playerId: 'otavio', no: 6 },
        { playerId: 'otavio-2', no: 5 },
      ]),
      players: stored,
    });
    expect(plan.ambiguous[0]?.candidateIds.sort()).toEqual(['otavio', 'otavio-2']);
    expect(plan.newPlayers).toEqual([]);
  });

  it('falls back to name matching when wikiTitle key is absent', () => {
    // Legacy player records may not have the wikiTitle key at all (undefined).
    // titlesOf should treat this the same as null and fall back to name matching.
    const p = player({ id: 'raya', name: 'David Raya', wikiTitle: null });
    const { wikiTitle, ...playerWithoutKey } = p;
    const plan = reconcileTeam({
      envelope: envelope([row({ name: 'David Raya' })]),
      storedSquad: squad([{ playerId: 'raya', no: 1 }]),
      players: [playerWithoutKey as Player],
    });
    expect(plan.squad.members.map((m) => m.playerId)).toEqual(['raya']);
    expect(plan.newPlayers).toEqual([]);
  });
});
