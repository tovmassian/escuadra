import { describe, expect, it } from 'vitest';
import type { PhotoCredit, Player } from '../../../../types/squad.ts';
import {
  ageInSeason,
  birthConflictFixes,
  describeBirthConflict,
  enrichPlayer,
  pendingFiles,
  summarize,
  type EnrichContext,
  type Lookups,
} from './enrich-plan.ts';
import type { CreditOutcome } from './photo-credit.ts';
import type { ArticleInfo, PersonInfo } from './wikimedia-parse.ts';

function player(overrides: Partial<Player> = {}): Player {
  return {
    id: 'pedri',
    name: 'Pedri',
    fullName: 'Pedro González López',
    birth: null,
    position: 'MF',
    nationality: 'Spain',
    club: 'Barcelona',
    photo: null,
    wikiTitle: 'Pedri',
    ...overrides,
  };
}

function credit(file: string): PhotoCredit {
  return {
    file,
    url: `https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/${file}/500px-${file}`,
    author: 'Bryan Berlin',
    licence: 'CC BY-SA 4.0',
    licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
  };
}

const ok = (file: string): CreditOutcome => ({ status: 'ok', credit: credit(file) });

function lookups({
  article = { status: 'ok', title: 'Pedri', image: 'Pedri.jpg', qid: 'Q1' },
  person = { human: true, births: ['2002-11-25'], image: null },
  credits = [['Pedri.jpg', ok('Pedri.jpg')]],
  failedTitles = [],
  failedItems = [],
  failedFiles = [],
}: {
  article?: ArticleInfo | null;
  /** null: Wikidata answered that it has no such item. */
  person?: PersonInfo | null | 'unanswered';
  credits?: [string, CreditOutcome][];
  failedTitles?: string[];
  failedItems?: string[];
  failedFiles?: string[];
} = {}): Lookups {
  return {
    articles: new Map(article === null ? [] : [['Pedri', article]]),
    people: new Map(person === 'unanswered' ? [] : [['Q1', person]]),
    credits: new Map(credits),
    failedTitles: new Set(failedTitles),
    failedItems: new Set(failedItems),
    failedFiles: new Set(failedFiles),
  };
}

describe('enrichPlayer — photo', () => {
  it('attaches the credit of the article lead image', () => {
    const result = enrichPlayer(player(), lookups());
    expect(result.photo).toBe('ok');
    expect(result.imageSource).toBe('article');
    expect(result.player.photo).toEqual(credit('Pedri.jpg'));
  });

  it('falls back to the Wikidata image when the article has none', () => {
    const result = enrichPlayer(
      player(),
      lookups({
        article: { status: 'ok', title: 'Pedri', image: null, qid: 'Q1' },
        person: { human: true, births: [], image: 'Wikidata.jpg' },
        credits: [['Wikidata.jpg', ok('Wikidata.jpg')]],
      }),
    );
    expect(result.photo).toBe('ok');
    expect(result.imageSource).toBe('wikidata');
    expect(result.player.photo?.file).toBe('Wikidata.jpg');
  });

  it('falls back to the Wikidata image when the article image is refused', () => {
    const result = enrichPlayer(
      player(),
      lookups({
        person: { human: true, births: [], image: 'Free.jpg' },
        credits: [
          ['Pedri.jpg', { status: 'refused-licence', licence: 'GFDL' }],
          ['Free.jpg', ok('Free.jpg')],
        ],
      }),
    );
    expect(result.photo).toBe('ok');
    expect(result.player.photo?.file).toBe('Free.jpg');
  });

  it('reports the first image when no candidate is usable', () => {
    const result = enrichPlayer(
      player(),
      lookups({
        person: { human: true, births: [], image: 'Other.jpg' },
        credits: [
          ['Pedri.jpg', { status: 'refused-licence', licence: 'Attribution' }],
          ['Other.jpg', { status: 'refused-licence', licence: 'GFDL' }],
        ],
      }),
    );
    expect(result).toMatchObject({
      photo: 'refused-licence',
      file: 'Pedri.jpg',
      licence: 'Attribution',
    });
    expect(result.player.photo).toBeNull();
  });

  it('names what an incomplete credit lacks', () => {
    const result = enrichPlayer(
      player(),
      lookups({
        credits: [
          [
            'Pedri.jpg',
            { status: 'incomplete-credit', licence: 'CC BY 4.0', missing: ['thumbnail'] },
          ],
        ],
      }),
    );
    expect(result).toMatchObject({ photo: 'incomplete-credit', missing: ['thumbnail'] });
  });

  it('has no photo for an article and item without an image', () => {
    const result = enrichPlayer(
      player({ photo: credit('Stale.jpg') }),
      lookups({ article: { status: 'ok', title: 'Pedri', image: null, qid: 'Q1' } }),
    );
    expect(result.photo).toBe('no-free-image');
    expect(result.player.photo).toBeNull();
  });

  it('has no photo or birth without a title', () => {
    const result = enrichPlayer(player({ wikiTitle: null }), lookups());
    expect(result).toMatchObject({ photo: 'no-title', birth: 'none' });
    expect(result.player.photo).toBeNull();
  });

  it('has no photo for a missing article or a disambiguation page', () => {
    expect(
      enrichPlayer(player(), lookups({ article: { status: 'missing', title: 'Pedri' } })).photo,
    ).toBe('missing-article');
    expect(
      enrichPlayer(player(), lookups({ article: { status: 'disambiguation', title: 'Pedri' } }))
        .photo,
    ).toBe('disambiguation');
  });

  // A title pointing at a club or a town would otherwise show its image.
  it('has no photo or birth when the Wikidata item is not a person', () => {
    const result = enrichPlayer(
      player(),
      lookups({ person: { human: false, births: ['1902-03-06'], image: 'Stadium.jpg' } }),
    );
    expect(result).toMatchObject({ photo: 'not-a-person', birth: 'none' });
    expect(result.player.photo).toBeNull();
    expect(result.player.birth).toBeNull();
  });

  it('uses the article image when the article has no Wikidata item', () => {
    const result = enrichPlayer(
      player(),
      lookups({ article: { status: 'ok', title: 'Pedri', image: 'Pedri.jpg', qid: null } }),
    );
    expect(result).toMatchObject({ photo: 'ok', birth: 'none' });
  });

  it('uses the article image when Wikidata has no such item', () => {
    expect(enrichPlayer(player(), lookups({ person: null }))).toMatchObject({
      photo: 'ok',
      birth: 'none',
    });
  });
});

describe('enrichPlayer — birth', () => {
  it('fills an unknown birth from a single Wikidata date', () => {
    const result = enrichPlayer(player(), lookups());
    expect(result.birth).toBe('filled');
    expect(result.player.birth).toBe('2002-11-25');
  });

  it('agrees when the stored date is Wikidata’s', () => {
    expect(enrichPlayer(player({ birth: '2002-11-25' }), lookups()).birth).toBe('agrees');
  });

  it('agrees when the stored date is one of several Wikidata candidates', () => {
    const result = enrichPlayer(
      player({ birth: '2002-11-25' }),
      lookups({ person: { human: true, births: ['2002-11-25', '2002-11-26'], image: null } }),
    );
    expect(result.birth).toBe('agrees');
  });

  it('fills nothing when Wikidata’s own claims disagree', () => {
    const result = enrichPlayer(
      player(),
      lookups({ person: { human: true, births: ['2002-11-25', '2002-11-26'], image: null } }),
    );
    expect(result.birth).toBe('ambiguous');
    expect(result.player.birth).toBeNull();
  });

  it('fills nothing when Wikidata has no day-precise date', () => {
    const result = enrichPlayer(
      player(),
      lookups({ person: { human: true, births: [], image: null } }),
    );
    expect(result.birth).toBe('none');
  });

  // The stored date may be wrong, Wikidata may be, or the title may name a
  // different person — so neither is overwritten and the photo is held too.
  it('reports a disagreement as a conflict, keeps the stored date and holds the photo', () => {
    const result = enrichPlayer(
      player({ birth: '1998-02-29', photo: credit('Old.jpg') }),
      lookups(),
    );
    expect(result.birth).toBe('conflict');
    expect(result.photo).toBe('held');
    expect(result.player.birth).toBe('1998-02-29');
    expect(result.player.photo).toBeNull();
    expect(result.conflict).toEqual({
      kind: 'birth-mismatch',
      playerId: 'pedri',
      name: 'Pedri',
      title: 'Pedri',
      qid: 'Q1',
      stored: '1998-02-29',
      wikidata: ['2002-11-25'],
    });
  });
});

describe('enrichPlayer — a filled birth date at no playing age', () => {
  const inSeason = (year: number): EnrichContext => ({
    kept: new Map(),
    seasonYears: new Map([['pedri', year]]),
  });
  const born = (date: string) => lookups({ person: { human: true, births: [date], image: null } });

  it('counts age on 1 July of the season’s first year', () => {
    expect(ageInSeason('2002-07-01', 2026)).toBe(24);
    expect(ageInSeason('2002-07-02', 2026)).toBe(23);
  });

  it('fills a date that puts the player at 15 to 45 in their season', () => {
    expect(enrichPlayer(player(), born('2011-06-30'), inSeason(2026)).birth).toBe('filled');
    expect(enrichPlayer(player(), born('1981-01-01'), inSeason(2026)).birth).toBe('filled');
  });

  // Filled from the item alone, the date has nothing to agree or disagree
  // with: an age no squad player has is how an older namesake shows up.
  it('holds the photo and fills nothing for a date outside it', () => {
    const result = enrichPlayer(
      player({ photo: credit('Old.jpg') }),
      born('1950-03-02'),
      inSeason(2026),
    );
    expect(result).toMatchObject({ birth: 'conflict', photo: 'held' });
    expect(result.player).toMatchObject({ birth: null, photo: null });
    expect(result.conflict).toEqual({
      kind: 'implausible-birth',
      playerId: 'pedri',
      name: 'Pedri',
      title: 'Pedri',
      qid: 'Q1',
      wikidata: '1950-03-02',
      seasonYear: 2026,
      age: 76,
    });
    expect(enrichPlayer(player(), born('2012-01-01'), inSeason(2026)).birth).toBe('conflict');
  });

  // Once a person has stored it, the date is cross-checked, not filled.
  it('checks a stored date against Wikidata, not against the window', () => {
    expect(
      enrichPlayer(player({ birth: '1950-03-02' }), born('1950-03-02'), inSeason(2026)).birth,
    ).toBe('agrees');
  });

  it('fills without the check for a player in no squad', () => {
    expect(enrichPlayer(player(), born('1950-03-02')).birth).toBe('filled');
  });
});

describe('enrichPlayer — a kept birth date', () => {
  const kept: EnrichContext = {
    kept: new Map([['pedri', '1998-02-29']]),
    seasonYears: new Map(),
  };

  it('stands against Wikidata and releases the photo', () => {
    const result = enrichPlayer(player({ birth: '1998-02-29' }), lookups(), kept);
    expect(result).toMatchObject({ birth: 'kept', photo: 'ok', conflict: null });
    expect(result.player.birth).toBe('1998-02-29');
  });

  // The decision named a date; a different stored date is a new question.
  it('lapses once the stored date is no longer the one it confirmed', () => {
    const result = enrichPlayer(player({ birth: '1999-01-01' }), lookups(), kept);
    expect(result.birth).toBe('conflict');
  });
});

describe('enrichPlayer — failed lookups keep what is stored', () => {
  const stored = player({ birth: '2002-11-25', photo: credit('Kept.jpg') });

  it('keeps everything when the article batch failed', () => {
    const result = enrichPlayer(stored, lookups({ failedTitles: ['Pedri'] }));
    expect(result).toMatchObject({ photo: 'lookup-failed', birth: 'lookup-failed' });
    expect(result.player).toEqual(stored);
  });

  it('keeps everything when the article is simply not answered', () => {
    expect(enrichPlayer(stored, lookups({ article: null })).player).toEqual(stored);
  });

  it('keeps everything when the Wikidata batch failed', () => {
    const result = enrichPlayer(stored, lookups({ failedItems: ['Q1'] }));
    expect(result).toMatchObject({ photo: 'lookup-failed', birth: 'lookup-failed' });
    expect(result.player).toEqual(stored);
  });

  // Not the same as Wikidata answering that there is no item.
  it('keeps everything when the item is simply not answered', () => {
    const result = enrichPlayer(stored, lookups({ person: 'unanswered' }));
    expect(result).toMatchObject({ photo: 'lookup-failed', birth: 'lookup-failed' });
    expect(result.player).toEqual(stored);
  });

  it('keeps the stored photo but applies the birth when only the Commons batch failed', () => {
    const result = enrichPlayer(
      player({ photo: credit('Kept.jpg') }),
      lookups({ failedFiles: ['Pedri.jpg'] }),
    );
    expect(result).toMatchObject({ photo: 'lookup-failed', birth: 'filled' });
    expect(result.player.photo?.file).toBe('Kept.jpg');
    expect(result.player.birth).toBe('2002-11-25');
  });

  // Moving on to the Wikidata image would flip the photo between runs
  // whenever Commons is flaky.
  it('does not fall back past an image whose lookup failed', () => {
    const result = enrichPlayer(
      player(),
      lookups({
        person: { human: true, births: [], image: 'Other.jpg' },
        credits: [['Other.jpg', ok('Other.jpg')]],
        failedFiles: ['Pedri.jpg'],
      }),
    );
    expect(result.photo).toBe('lookup-failed');
  });
});

describe('describeBirthConflict and birthConflictFixes', () => {
  const conflict = {
    kind: 'birth-mismatch' as const,
    playerId: 'torres',
    name: 'Ferran Torres',
    title: 'Ferran Torres',
    qid: 'Q44297797',
    stored: '1998-02-29',
    wikidata: ['2000-02-29'],
  };

  it('names both dates and the article', () => {
    expect(describeBirthConflict(conflict)).toBe(
      'birth date on torres ("Ferran Torres") — stored 1998-02-29, Wikidata 2000-02-29 ("Ferran Torres")',
    );
  });

  it('offers a command for each answer', () => {
    expect(birthConflictFixes(conflict)).toEqual([
      'Wikidata is right:      npm run squadctl -- birth torres 2000-02-29',
      'wrong person:           npm run squadctl -- retitle torres "<their article title>"',
      'stored date is right:   npm run squadctl -- birth torres --keep',
    ]);
  });

  it('names an implausible date, the age it gives and the window', () => {
    const implausible = {
      kind: 'implausible-birth' as const,
      playerId: 'torres',
      name: 'Ferran Torres',
      title: 'Ferran Torres (footballer, born 1950)',
      qid: 'Q1',
      wikidata: '1950-03-02',
      seasonYear: 2026,
      age: 76,
    };
    expect(describeBirthConflict(implausible)).toBe(
      'birth date on torres ("Ferran Torres") — Wikidata\'s 1950-03-02 ("Ferran Torres (footballer, born 1950)") makes them 76 in 2026, outside playing age 15–45',
    );
    expect(birthConflictFixes(implausible)).toEqual([
      'wrong person:           npm run squadctl -- retitle torres "<their article title>"',
      'the date is right:      npm run squadctl -- birth torres 1950-03-02',
    ]);
  });

  it('offers no single date when Wikidata holds several', () => {
    expect(birthConflictFixes({ ...conflict, wikidata: ['2000-02-28', '2000-02-29'] })[0]).toBe(
      'Wikidata is right:      npm run squadctl -- birth torres <2000-02-28 | 2000-02-29>',
    );
  });
});

describe('pendingFiles', () => {
  const players = [player()];

  it('asks for the article image first, and not yet the item’s', () => {
    expect(
      pendingFiles(
        players,
        lookups({ person: { human: true, births: [], image: 'Item.jpg' }, credits: [] }),
      ),
    ).toEqual(['Pedri.jpg']);
  });

  it('asks for the item’s image once the article’s proves unusable', () => {
    expect(
      pendingFiles(
        players,
        lookups({
          person: { human: true, births: [], image: 'Item.jpg' },
          credits: [['Pedri.jpg', { status: 'refused-licence', licence: 'GFDL' }]],
        }),
      ),
    ).toEqual(['Item.jpg']);
  });

  it('asks for nothing once a usable image is answered, or a file failed', () => {
    const withItem = { human: true, births: [], image: 'Item.jpg' };
    expect(pendingFiles(players, lookups({ person: withItem }))).toEqual([]);
    expect(
      pendingFiles(players, lookups({ person: withItem, credits: [], failedFiles: ['Pedri.jpg'] })),
    ).toEqual([]);
  });

  it('asks nothing for a record with no one to photograph', () => {
    expect(pendingFiles([player({ wikiTitle: null })], lookups({ credits: [] }))).toEqual([]);
    expect(
      pendingFiles(
        players,
        lookups({ person: { human: false, births: [], image: 'Stadium.jpg' }, credits: [] }),
      ),
    ).toEqual([]);
  });

  // So that the answer to the conflict re-runs with --offline.
  it('asks for a held photo too', () => {
    const held = player({ birth: '1998-02-29' });
    expect(enrichPlayer(held, lookups()).photo).toBe('held');
    expect(pendingFiles([held], lookups({ credits: [] }))).toEqual(['Pedri.jpg']);
  });
});

describe('summarize', () => {
  it('counts statuses, the licence mix of shown photos, and what changed', () => {
    const before = player();
    const results = [
      enrichPlayer(before, lookups()),
      enrichPlayer(player({ id: 'x', wikiTitle: null }), lookups()),
    ];
    expect(summarize([before, player({ id: 'x', wikiTitle: null })], results)).toEqual({
      players: 2,
      photo: { ok: 1, 'no-title': 1 },
      birth: { filled: 1, none: 1 },
      licences: { 'CC BY-SA 4.0': 1 },
      changed: { photos: 1, births: 1, records: 1 },
    });
  });
});
