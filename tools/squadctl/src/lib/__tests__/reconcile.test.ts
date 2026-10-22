import { describe, expect, it } from 'vitest';
import type { EnvelopeMember, RosterEnvelope } from '../../../../../scripts/roster-envelope.ts';
import type { Player, Squad } from '../../../../../types/squad.ts';
import { looksLikeRename, playerId, reconcileTeam } from '../reconcile.ts';

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

    // Brazil, live: `Mauro Júnior` came first in the section and `Vinícius
    // Júnior` nineteen rows later. "júnior" is a shared last token, so the
    // loose rename heuristic reached the stored `vinicius` slot before the row
    // that matches it exactly ever ran — and the real Vinícius Júnior then
    // created a duplicate record with the birth date dropped.
    it('never targets a stored record another row in the same section matches', () => {
      const plan = reconcileTeam({
        envelope: envelope(
          [row({ name: 'Mauro Júnior', no: 6 }), row({ name: 'Vinícius Júnior', no: 7 })],
          { id: 'bra', kind: 'nation' as const, league: undefined },
        ),
        storedSquad: squad([{ playerId: 'vinicius', no: 7 }]),
        players: [player({ id: 'vinicius', name: 'Vinícius Júnior', birth: '2000-07-12' })],
      });
      expect(plan.possibleRenames).toEqual([]);
      expect(plan.newPlayers.map((p) => p.id)).toEqual(['mauro-junior']);
      expect(plan.squad.members).toEqual([
        { playerId: 'mauro-junior', no: 6 },
        { playerId: 'vinicius', no: 7 },
      ]);
      expect(plan.departed).toEqual([]);
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

  // Portugal, live: the article links a bare [[Vitinha]], base-title
  // equivalent to two real people whose articles both disambiguate on a birth
  // month. Holding both left Portugal a player short and permanently
  // unverified, with no command able to resolve it — but the row itself says
  // which one it means.
  describe('a bare title equivalent to two disambiguated records', () => {
    const candidates = [
      player({
        id: 'vitinha',
        name: 'Vitinha',
        position: 'MF',
        club: 'Paris Saint-Germain',
        nationality: 'Portugal',
        wikiTitle: 'Vitinha (footballer, born February 2000)',
      }),
      player({
        id: 'vitinha-2',
        name: 'Vitinha',
        position: 'FW',
        club: 'Genoa',
        nationality: 'Portugal',
        wikiTitle: 'Vitinha (footballer, born March 2000)',
      }),
    ];
    const porto = { id: 'por', kind: 'nation' as const, league: undefined };

    it('resolves on the data the row already carries', () => {
      const plan = reconcileTeam({
        envelope: envelope(
          [
            row({
              name: 'Vitinha',
              title: 'Vitinha',
              no: 16,
              position: 'MF',
              club: 'Paris Saint-Germain',
              nationality: 'Portugal',
            }),
          ],
          porto,
        ),
        storedSquad: null,
        players: candidates,
      });
      expect(plan.ambiguous).toEqual([]);
      expect(plan.omitted).toEqual([]);
      expect(plan.squad.members).toEqual([{ playerId: 'vitinha', no: 16 }]);
    });

    it('still holds both when nothing tells them apart', () => {
      const plan = reconcileTeam({
        envelope: envelope(
          [
            row({
              name: 'Vitinha',
              title: 'Vitinha',
              no: 16,
              position: 'GK',
              club: 'Benfica',
              nationality: 'Portugal',
            }),
          ],
          porto,
        ),
        storedSquad: null,
        players: candidates,
      });
      expect(plan.ambiguous.map((a) => a.candidateIds)).toEqual([['vitinha', 'vitinha-2']]);
      expect(plan.squad.members).toEqual([]);
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

  it('falls back to name matching when the wikiTitle key is absent', () => {
    // Every record in data/players.json predates the field and carries no
    // wikiTitle key at all, so `=== null` is false for them and titlesOf
    // yields [undefined]. The ROW must carry a title for this to bite:
    // titleVerdict returns 'unknown' on a titleless row before titlesOf is
    // ever reached, so a titleless row would pass either way.
    const p = player({ id: 'raya', name: 'David Raya', wikiTitle: null });
    const { wikiTitle, ...playerWithoutKey } = p;
    const plan = reconcileTeam({
      envelope: envelope([row({ name: 'David Raya', title: 'David Raya' })]),
      storedSquad: squad([{ playerId: 'raya', no: 1 }]),
      players: [playerWithoutKey as Player],
    });
    expect(plan.squad.members.map((m) => m.playerId)).toEqual(['raya']);
    expect(plan.newPlayers).toEqual([]);
  });
});

describe('a clashing title holds the row', () => {
  // The live bug: Frankfurt's Otávio and Paris FC's Otávio are two Brazilian
  // defenders rendered identically, and one record was serving both squads.
  const frankfurtRow = row({
    name: 'Otávio',
    no: 5,
    position: 'DF',
    title: 'Otávio (footballer, born November 2005)',
  });

  it('does not match a stored member whose title says someone else', () => {
    const stored = [
      player({
        id: 'otavio',
        name: 'Otávio',
        position: 'DF',
        wikiTitle: 'Otávio (footballer, born 2002)',
      }),
    ];
    const plan = reconcileTeam({
      envelope: envelope([frankfurtRow]),
      storedSquad: squad([{ playerId: 'otavio', no: 5 }]),
      players: stored,
    });
    expect(plan.titleMismatches).toEqual([
      {
        playerId: 'otavio',
        storedTitle: 'Otávio (footballer, born 2002)',
        sourceTitle: 'Otávio (footballer, born November 2005)',
        rowName: 'Otávio',
      },
    ]);
  });

  it('creates nothing, because a moved article looks identical to a new person', () => {
    const stored = [
      player({
        id: 'otavio',
        name: 'Otávio',
        position: 'DF',
        wikiTitle: 'Otávio (footballer, born 2002)',
      }),
    ];
    const plan = reconcileTeam({
      envelope: envelope([frankfurtRow]),
      storedSquad: squad([{ playerId: 'otavio', no: 5 }]),
      players: stored,
    });
    expect(plan.newPlayers).toEqual([]);
  });

  it('keeps the squad slot, so an unresolved clash never shortens a squad', () => {
    const stored = [
      player({
        id: 'otavio',
        name: 'Otávio',
        position: 'DF',
        wikiTitle: 'Otávio (footballer, born 2002)',
      }),
    ];
    const plan = reconcileTeam({
      envelope: envelope([frankfurtRow]),
      storedSquad: squad([{ playerId: 'otavio', no: 5 }]),
      players: stored,
    });
    expect(plan.squad.members).toEqual([{ playerId: 'otavio', no: 5 }]);
    expect(plan.departed).toEqual([]);
  });

  it('omits the row when the clashing record is not in this squad', () => {
    // Genoa's Vitinha against the stored PSG one. There is no slot to hold,
    // so the row is left out and said so — never dropped in silence.
    const stored = [
      player({
        id: 'vitinha',
        name: 'Vitinha',
        wikiTitle: 'Vitinha (footballer, born February 2000)',
      }),
    ];
    const plan = reconcileTeam({
      envelope: envelope([
        row({ name: 'Vitinha', title: 'Vitinha (footballer, born March 2000)' }),
      ]),
      storedSquad: null,
      players: stored,
    });
    expect(plan.titleMismatches).toHaveLength(1);
    expect(plan.omitted).toHaveLength(1);
    expect(plan.newPlayers).toEqual([]);
  });

  it('does not clash when the stored title is unknown', () => {
    const stored = [player({ id: 'otavio', name: 'Otávio', position: 'DF', wikiTitle: null })];
    const plan = reconcileTeam({
      envelope: envelope([frankfurtRow]),
      storedSquad: squad([{ playerId: 'otavio', no: 5 }]),
      players: stored,
    });
    expect(plan.titleMismatches).toEqual([]);
    expect(plan.updatedPlayers[0]?.wikiTitle).toBe('Otávio (footballer, born November 2005)');
  });

  it('matches a globally titled fork even though the same-squad name clashes', () => {
    // The real re-apply bug: `squadctl fork otavio "Otávio (footballer, born
    // November 2005)"` correctly writes `otavio-2`, but a re-run of `apply`
    // must still find it. Paris FC's stored `otavio` (born 2002) clashes on
    // title with Frankfurt's row — that clash must not shadow the `otavio-2`
    // record whose title the row actually matches.
    const stored = [
      player({
        id: 'otavio',
        name: 'Otávio',
        position: 'DF',
        wikiTitle: 'Otávio (footballer, born 2002)',
      }),
      player({
        id: 'otavio-2',
        name: 'Otávio',
        position: 'DF',
        wikiTitle: 'Otávio (footballer, born November 2005)',
      }),
    ];
    const plan = reconcileTeam({
      envelope: envelope([frankfurtRow]),
      storedSquad: squad([{ playerId: 'otavio', no: 5 }]),
      players: stored,
    });
    expect(plan.squad.members).toEqual([{ playerId: 'otavio-2', no: 5 }]);
    expect(plan.titleMismatches).toEqual([]);
    expect(plan.newPlayers).toEqual([]);
  });
});

describe('out-on-loan rows', () => {
  const OUT =
    '{{Fs player|no=19|nat=ENG|pos=MF|name=[[Harvey Elliott]]|other=at [[Valencia CF|Valencia]] until 30 June 2027}}';
  const IN =
    '{{Fs player|no=10|nat=ENG|pos=FW|name=[[Harvey Elliott]]|other=on loan from [[Liverpool F.C.|Liverpool]]}}';

  it('drops the row from the squad the player is loaned OUT of', () => {
    const plan = reconcileTeam({
      envelope: envelope([
        row({ name: 'Ander', no: 1 }),
        row({ name: 'Harvey Elliott', no: 19, raw: OUT }),
      ]),
      storedSquad: null,
      players: [],
    });
    expect(plan.squad.members.map((m) => m.playerId)).toEqual(['ander']);
    expect(plan.loanedOut).toEqual([
      { name: 'Harvey Elliott', note: 'at [[Valencia CF|Valencia]] until 30 June 2027' },
    ]);
  });

  it('KEEPS the row at the club the player is loaned IN to', () => {
    const plan = reconcileTeam({
      envelope: envelope([row({ name: 'Harvey Elliott', no: 10, raw: IN })]),
      storedSquad: null,
      players: [],
    });
    expect(plan.squad.members.map((m) => m.playerId)).toEqual(['harvey-elliott']);
    expect(plan.loanedOut).toEqual([]);
  });

  it('removes a stored member who has since been loaned out, as a departure', () => {
    const stored = player({ id: 'harvey-elliott', name: 'Harvey Elliott' });
    const plan = reconcileTeam({
      envelope: envelope([row({ name: 'Harvey Elliott', no: 19, raw: OUT })]),
      storedSquad: squad([{ playerId: 'harvey-elliott', no: 19 }]),
      players: [stored],
    });
    expect(plan.squad.members).toEqual([]);
    expect(plan.departed.map((d) => d.id)).toEqual(['harvey-elliott']);
    // The record itself survives — it is the one the loan club reuses.
    expect(plan.newPlayers).toEqual([]);
  });

  // parsedCount feeds the blast-radius ratio. Counting a dropped row would
  // make a club with several loanees out look like a page restructure.
  it('excludes dropped rows from parsedCount', () => {
    const plan = reconcileTeam({
      envelope: envelope([
        row({ name: 'Ander', no: 1 }),
        row({ name: 'Harvey Elliott', no: 19, raw: OUT }),
      ]),
      storedSquad: null,
      players: [],
    });
    expect(plan.parsedCount).toBe(1);
  });
});

describe('notInSquad decisions', () => {
  // The residue the loan rule cannot reach: two articles list the player
  // identically, with no annotation on either, and only the real world says
  // which is right.
  const belghali = { name: 'Rafik Belghali', no: 7, title: 'Rafik Belghali' };

  it('drops the row and reports the reason the operator gave', () => {
    const plan = reconcileTeam({
      envelope: envelope([row({ name: 'Ander', no: 1 }), row(belghali)], { id: 'ver' }),
      storedSquad: null,
      players: [],
      notInSquad: [{ team: 'ver', title: 'Rafik Belghali', reason: 'moved to Torino' }],
    });
    expect(plan.squad.members.map((m) => m.playerId)).toEqual(['ander']);
    expect(plan.excluded).toEqual([{ name: 'Rafik Belghali', note: 'moved to Torino' }]);
  });

  it('applies only to the team it names, so the other squad keeps him', () => {
    const plan = reconcileTeam({
      envelope: envelope([row(belghali)], { id: 'tor' }),
      storedSquad: null,
      players: [],
      notInSquad: [{ team: 'ver', title: 'Rafik Belghali', reason: 'moved to Torino' }],
    });
    expect(plan.squad.members.map((m) => m.playerId)).toEqual(['rafik-belghali']);
    expect(plan.excluded).toEqual([]);
  });

  it('matches by title equivalence, so a redirect still resolves', () => {
    const plan = reconcileTeam({
      envelope: envelope([row({ ...belghali, title: 'Rafik Belghali (footballer)' })], {
        id: 'ver',
      }),
      storedSquad: null,
      players: [],
      notInSquad: [{ team: 'ver', title: 'Rafik Belghali', reason: 'moved to Torino' }],
    });
    expect(plan.squad.members).toEqual([]);
  });

  it('never matches a row that carries no title, rather than falling back to the name', () => {
    const plan = reconcileTeam({
      envelope: envelope([row({ name: 'Rafik Belghali', no: 7 })], { id: 'ver' }),
      storedSquad: null,
      players: [],
      notInSquad: [{ team: 'ver', title: 'Rafik Belghali', reason: 'moved to Torino' }],
    });
    expect(plan.squad.members.map((m) => m.playerId)).toEqual(['rafik-belghali']);
  });
});

describe('namesakes — a record this row provably is not', () => {
  const uruguay = (members: EnvelopeMember[]) =>
    envelope(members, {
      id: 'uru',
      kind: 'nation',
      name: 'Uruguay',
      league: undefined,
      season: '2026',
      source: 'https://en.wikipedia.org/wiki/Uruguay_national_football_team',
    });
  const argentinasKeeper = player({
    id: 'e-martinez',
    name: 'Emiliano Martínez',
    birth: '1992-09-02',
    position: 'GK',
    nationality: 'Argentina',
    club: 'Chelsea',
    wikiTitle: 'Emiliano Martínez',
  });
  const uruguayRow = row({
    name: 'Emiliano Martínez',
    title: 'Emiliano Martínez (footballer, born 1999)',
    birth: '1999-08-17',
    position: 'MF',
    nationality: 'Uruguay',
    club: 'Palmeiras',
  });

  it('creates a record when a base-equivalent title belongs to someone born on another day', () => {
    // The live case: Uruguay links the disambiguated article, which relates
    // to Argentina's goalkeeper stored under the bare title. Matching merged
    // the two into one record carrying Uruguay's nationality.
    const plan = reconcileTeam({
      envelope: uruguay([uruguayRow]),
      storedSquad: null,
      players: [argentinasKeeper],
    });
    expect(plan.updatedPlayers).toEqual([]);
    expect(plan.newPlayers.map((p) => [p.id, p.birth, p.wikiTitle])).toEqual([
      ['emiliano-martinez', '1999-08-17', 'Emiliano Martínez (footballer, born 1999)'],
    ]);
    expect(plan.namesakes).toEqual([
      { id: 'emiliano-martinez', of: ['e-martinez'], proof: 'born 1999-08-17, not 1992-09-02' },
    ]);
  });

  // Two disambiguated titles that differ: a clash, not base equivalence.
  const disambiguatedKeeper = {
    ...argentinasKeeper,
    wikiTitle: 'Emiliano Martínez (footballer, born 1992)',
  };

  it('creates a record instead of raising a title clash when the births differ', () => {
    // Two articles AND two birth dates: there is nothing left to decide.
    const plan = reconcileTeam({
      envelope: uruguay([uruguayRow]),
      storedSquad: null,
      players: [disambiguatedKeeper],
    });
    expect(plan.titleMismatches).toEqual([]);
    expect(plan.omitted).toEqual([]);
    expect(plan.newPlayers).toHaveLength(1);
  });

  it('still raises the title clash when one birth date is unknown', () => {
    const plan = reconcileTeam({
      envelope: uruguay([{ ...uruguayRow, birth: undefined }]),
      storedSquad: null,
      players: [disambiguatedKeeper],
    });
    expect(plan.titleMismatches).toHaveLength(1);
    expect(plan.newPlayers).toEqual([]);
  });

  it("lets the record's own article decide over a disagreeing birth date", () => {
    // A stray date in one source is enrich's birth-mismatch, not a second person.
    const plan = reconcileTeam({
      envelope: uruguay([{ ...uruguayRow, title: 'Emiliano Martinez' }]),
      storedSquad: null,
      players: [argentinasKeeper],
    });
    expect(plan.newPlayers).toEqual([]);
    expect(plan.namesakes).toEqual([]);
    expect(plan.squad.members.map((m) => m.playerId)).toEqual(['e-martinez']);
  });

  it("never joins a name-only row to another nation's player", () => {
    // The live case: Burkina Faso's unlinked "Aboubacar Camara" became a
    // record, and Niger's linked one then merged into it by name.
    const camara = player({
      id: 'aboubacar-camara',
      name: 'Aboubacar Camara',
      birth: null,
      nationality: 'Burkina Faso',
      wikiTitle: null,
    });
    const plan = reconcileTeam({
      envelope: envelope([row({ name: 'Aboubacar Camara', nationality: 'Niger', club: 'Bylis' })], {
        id: 'nig',
        kind: 'nation',
        name: 'Niger',
        league: undefined,
        season: '2026',
      }),
      storedSquad: null,
      players: [camara],
      nationSquadOf: new Map([['aboubacar-camara', 'bfa']]),
    });
    expect(plan.updatedPlayers).toEqual([]);
    expect(plan.newPlayers.map((p) => p.id)).toEqual(['aboubacar-camara-2']);
    expect(plan.namesakes).toEqual([
      { id: 'aboubacar-camara-2', of: ['aboubacar-camara'], proof: "already in bfa's squad" },
    ]);
  });

  it("matches a name-only row to this nation's own player as before", () => {
    const own = player({ id: 'luis-suarez', name: 'Luis Suárez', birth: null });
    const plan = reconcileTeam({
      envelope: uruguay([row({ name: 'Luis Suárez', nationality: 'Uruguay' })]),
      storedSquad: null,
      players: [own],
      nationSquadOf: new Map([['luis-suarez', 'uru']]),
    });
    expect(plan.newPlayers).toEqual([]);
    expect(plan.namesakes).toEqual([]);
  });

  it("leaves a club row free to match a nation's player by name", () => {
    // Every club squad is full of internationals; the rule is one nation each.
    const own = player({ id: 'luis-suarez', name: 'Luis Suárez', birth: null });
    const plan = reconcileTeam({
      envelope: envelope([row({ name: 'Luis Suárez' })]),
      storedSquad: null,
      players: [own],
      nationSquadOf: new Map([['luis-suarez', 'uru']]),
    });
    expect(plan.newPlayers).toEqual([]);
    expect(plan.squad.members.map((m) => m.playerId)).toEqual(['luis-suarez']);
  });
});

describe('clubless members', () => {
  const nation = (members: EnvelopeMember[]) =>
    envelope(members, {
      id: 'asa',
      kind: 'nation',
      name: 'American Samoa',
      league: undefined,
      season: '2026',
    });

  it('lists a member whose record ends up with no club', () => {
    const plan = reconcileTeam({
      envelope: nation([
        row({ name: "Ali'i Mitchell", nationality: 'American Samoa', club: undefined }),
      ]),
      storedSquad: null,
      players: [],
    });
    expect(plan.clubless).toEqual(['alii-mitchell']);
  });

  it('does not list a member whose stored record carries the club the row leaves out', () => {
    const known = player({ id: 'known', name: 'Known Player', club: 'Sevilla' });
    const plan = reconcileTeam({
      envelope: nation([
        row({ name: 'Known Player', nationality: 'American Samoa', club: undefined }),
      ]),
      storedSquad: null,
      players: [known],
    });
    expect(plan.clubless).toEqual([]);
  });
});

describe('a rename needs more than a shared surname when births disagree', () => {
  // The October sweep: Ecuador called up Fricio Caicedo as Moisés Caicedo
  // left, and the shared surname read as a rename. Two birth dates say two
  // people, which leaves nothing to ask.
  const ecuador = (members: EnvelopeMember[]) =>
    envelope(members, {
      id: 'ecu',
      kind: 'nation',
      name: 'Ecuador',
      league: undefined,
      season: '2026',
    });
  const moises = player({
    id: 'moises-caicedo',
    name: 'Moisés Caicedo',
    birth: '2001-11-02',
    nationality: 'Ecuador',
    club: 'Chelsea',
    wikiTitle: 'Moisés Caicedo',
  });
  const fricio = row({
    name: 'Fricio Caicedo',
    title: 'Fricio Caicedo',
    birth: '2008-04-17',
    nationality: 'Ecuador',
    club: 'Inter Miami',
  });

  it('creates the arrival and lets the departed player leave', () => {
    const plan = reconcileTeam({
      envelope: ecuador([fricio]),
      storedSquad: squad([{ playerId: 'moises-caicedo', no: 23 }]),
      players: [moises],
    });
    expect(plan.possibleRenames).toEqual([]);
    expect(plan.newPlayers.map((p) => p.id)).toEqual(['fricio-caicedo']);
    expect(plan.departed.map((d) => d.id)).toEqual(['moises-caicedo']);
    expect(plan.namesakes).toEqual([
      { id: 'fricio-caicedo', of: ['moises-caicedo'], proof: 'born 2008-04-17, not 2001-11-02' },
    ]);
  });

  it('still asks when the dates agree or one is unknown', () => {
    for (const birth of ['2001-11-02', undefined]) {
      const plan = reconcileTeam({
        envelope: ecuador([{ ...fricio, birth }]),
        storedSquad: squad([{ playerId: 'moises-caicedo', no: 23 }]),
        players: [moises],
      });
      expect(plan.possibleRenames.map((r) => r.departedId)).toEqual(['moises-caicedo']);
    }
  });
});

describe('a birth date proves nothing on a record no article backs', () => {
  // The October sweep: Brazil's Hugo Souza (born 1999-01-31) against an
  // untitled orphan record of him, carrying a date the retired pipeline
  // invented (1999-04-15). Only a titled record's date has been checked by
  // enrich, so only it can tell two people apart.
  it('reuses an untitled record whatever its birth date says', () => {
    const orphan = player({
      id: 'hugo-souza',
      name: 'Hugo Souza',
      birth: '1999-04-15',
      position: 'GK',
      nationality: 'Brazil',
      club: 'Corinthians',
      wikiTitle: null,
    });
    const plan = reconcileTeam({
      envelope: envelope(
        [
          row({
            name: 'Hugo Souza',
            title: 'Hugo Souza',
            birth: '1999-01-31',
            position: 'GK',
            nationality: 'Brazil',
            club: 'Corinthians',
          }),
        ],
        { id: 'bra', kind: 'nation', name: 'Brazil', league: undefined, season: '2026' },
      ),
      storedSquad: null,
      players: [orphan],
    });
    expect(plan.newPlayers).toEqual([]);
    expect(plan.namesakes).toEqual([]);
    expect(plan.updatedPlayers[0]).toMatchObject({
      id: 'hugo-souza',
      birth: '1999-04-15',
      wikiTitle: 'Hugo Souza',
    });
  });
});

describe('a split rules out one pair, not every lookalike', () => {
  // Brazil, October 2026: "Danilo" arrived as both Danilo Luiz (born 1991)
  // and Danilo Santos (born 2001, the same Botafogo player) left. With
  // `split bra danilo-luiz "Danilo"` recorded, the rename step stopped at the
  // first lookalike and created a duplicate of Danilo Santos.
  it('offers the next lookalike once the first is split off', () => {
    const luiz = player({ id: 'danilo-luiz', name: 'Danilo Luiz', birth: '1991-07-15' });
    const santos = player({ id: 'danilo-santos', name: 'Danilo Santos', birth: '2001-04-29' });
    const plan = reconcileTeam({
      envelope: envelope([row({ name: 'Danilo', birth: '2001-04-29' })]),
      storedSquad: squad([
        { playerId: 'danilo-luiz', no: 2 },
        { playerId: 'danilo-santos', no: 15 },
      ]),
      players: [luiz, santos],
      acceptedSplits: [{ team: 'sev', departed: 'danilo-luiz', arrived: 'Danilo' }],
    });
    expect(plan.newPlayers).toEqual([]);
    expect(plan.possibleRenames.map((r) => r.departedId)).toEqual(['danilo-santos']);
  });
});

describe('a link the decisions say names someone else', () => {
  // Nicaragua links [[Emmanuel Gómez]], the article of a Gambian defender born
  // 1990; their own Emmanuel Gómez, born 2000, has no article. Unlinked, the
  // row matches by name and never hands its record that title back.
  const nicaragua = (members: EnvelopeMember[]) =>
    envelope(members, {
      id: 'nca',
      kind: 'nation',
      name: 'Nicaragua',
      league: undefined,
      season: '2026',
    });
  const ours = player({
    id: 'emmanuel-gomez',
    name: 'Emmanuel Gómez',
    birth: '2000-05-17',
    nationality: 'Nicaragua',
    club: 'UMECIT',
    wikiTitle: null,
  });
  const gomezRow = row({
    name: 'Emmanuel Gómez',
    title: 'Emmanuel Gómez',
    birth: '2000-05-17',
    nationality: 'Nicaragua',
    club: 'UMECIT',
  });
  const wrongLinks = [{ team: 'nca', title: 'Emmanuel Gómez', reason: 'a Gambian defender' }];

  it('matches by name and leaves the record unlinked', () => {
    const plan = reconcileTeam({
      envelope: nicaragua([gomezRow]),
      storedSquad: squad([{ playerId: 'emmanuel-gomez', no: 5 }]),
      players: [ours],
      wrongLinks,
    });
    expect(plan.squad.members.map((m) => m.playerId)).toEqual(['emmanuel-gomez']);
    expect(plan.updatedPlayers).toEqual([]);
  });

  it('never joins the record that does carry the title', () => {
    const gambian = player({
      id: 'emmanuel-gomez-2',
      name: 'Emmanuel Gómez',
      birth: '1990-12-20',
      nationality: 'Gambia',
      wikiTitle: 'Emmanuel Gómez',
    });
    const plan = reconcileTeam({
      envelope: nicaragua([gomezRow]),
      storedSquad: squad([{ playerId: 'emmanuel-gomez', no: 5 }]),
      players: [ours, gambian],
      wrongLinks,
    });
    expect(plan.squad.members.map((m) => m.playerId)).toEqual(['emmanuel-gomez']);
  });

  it("leaves another team's identical link alone", () => {
    const plan = reconcileTeam({
      envelope: nicaragua([gomezRow]),
      storedSquad: squad([{ playerId: 'emmanuel-gomez', no: 5 }]),
      players: [ours],
      wrongLinks: [{ ...wrongLinks[0]!, team: 'gam' }],
    });
    expect(plan.updatedPlayers[0]?.wikiTitle).toBe('Emmanuel Gómez');
  });
});
