import { describe, expect, it } from 'vitest';
import pagesResponse from './fixtures/wikipedia-pages.json';
import entitiesResponse from './fixtures/wikidata-entities.json';
import type { Lookup } from '../wikimedia-fetch.ts';
import {
  ARTICLES,
  INFOBOXES,
  PEOPLE,
  birthDates,
  infoboxBirth,
  infoboxClub,
} from '../wikimedia-parse.ts';

/** What a lookup reads for each key from a batch's replies — what the
 *  client does with each answer, cached or not. */
function readAll<Info, Answer>(
  lookup: Lookup<Info, Answer>,
  keys: readonly string[],
  replies: readonly unknown[],
): Map<string, Info> {
  return new Map(
    [...lookup.answers(keys, replies)].map(([key, answer]) => [key, lookup.read(answer)]),
  );
}

describe('ARTICLES (recorded Wikipedia response)', () => {
  const titles = [
    'Pedri',
    'Eric García (footballer, born 2001)',
    'Abu Francis',
    'Federico Serra (footballer, born 2006)',
    'Josh Cullen (footballer)',
    'Rodri_(footballer,_born_1996)',
  ];
  const articles = readAll(ARTICLES, titles, [pagesResponse]);

  it('gives an article its lead image as a file key and its Wikidata item', () => {
    expect(articles.get('Pedri')).toEqual({
      status: 'ok',
      title: 'Pedri',
      image: 'Pedri France v Spain 7.24.26-245.jpg',
      qid: 'Q66606355',
    });
  });

  it('follows a redirect', () => {
    expect(articles.get('Eric García (footballer, born 2001)')).toMatchObject({
      status: 'ok',
      title: 'Eric Garcia (footballer, born 2001)',
      qid: 'Q59938996',
    });
  });

  it('follows normalisation and then a redirect', () => {
    expect(articles.get('Rodri_(footballer,_born_1996)')).toMatchObject({
      status: 'ok',
      title: 'Rodri',
      qid: 'Q20994118',
    });
  });

  it('reports an article with no free lead image as having none', () => {
    expect(articles.get('Abu Francis')).toEqual({
      status: 'ok',
      title: 'Abu Francis',
      image: null,
      qid: 'Q65559585',
    });
  });

  it('reports a title with no article as missing', () => {
    expect(articles.get('Federico Serra (footballer, born 2006)')).toEqual({
      status: 'missing',
      title: 'Federico Serra (footballer, born 2006)',
    });
  });

  // A disambiguation page names several people; nothing on it is this one.
  it('reports a redirect to a disambiguation page as disambiguation', () => {
    expect(articles.get('Josh Cullen (footballer)')).toEqual({
      status: 'disambiguation',
      title: 'Josh Cullen',
    });
  });

  it('answers nothing for a title the responses do not hold', () => {
    expect(readAll(ARTICLES, ['Never Asked'], [pagesResponse]).has('Never Asked')).toBe(false);
  });

  // `continue` splits one batch's props across responses: the image in one,
  // the Wikidata item in the next.
  it('merges a page answered across continued responses', () => {
    const merged = readAll(
      ARTICLES,
      ['Split'],
      [
        { query: { pages: [{ title: 'Split', pageimage: 'Split.jpg' }] } },
        { query: { pages: [{ title: 'Split', pageprops: { wikibase_item: 'Q1' } }] } },
      ],
    );
    expect(merged.get('Split')).toEqual({
      status: 'ok',
      title: 'Split',
      image: 'Split.jpg',
      qid: 'Q1',
    });
  });
});

describe('birthDates', () => {
  const claim = (time: string, precision = 11, rank = 'normal', calendar = 'Q1985727') => ({
    rank,
    mainsnak: {
      snaktype: 'value',
      datavalue: {
        value: { time, precision, calendarmodel: `http://www.wikidata.org/entity/${calendar}` },
      },
    },
  });

  it('reads a day-precise date', () => {
    expect(birthDates([claim('+2002-11-25T00:00:00Z')])).toEqual(['2002-11-25']);
  });

  it('ignores a year- or month-precise date', () => {
    expect(
      birthDates([claim('+1997-00-00T00:00:00Z', 9), claim('+1997-05-00T00:00:00Z', 10)]),
    ).toEqual([]);
  });

  it('prefers preferred-rank claims and ignores deprecated ones', () => {
    expect(
      birthDates([
        claim('+2003-01-01T00:00:00Z', 11),
        claim('+2003-07-07T00:00:00Z', 11, 'preferred'),
      ]),
    ).toEqual(['2003-07-07']);
    expect(
      birthDates([
        claim('+2003-01-01T00:00:00Z', 11, 'deprecated'),
        claim('+2003-07-07T00:00:00Z', 11),
      ]),
    ).toEqual(['2003-07-07']);
  });

  it('returns every distinct candidate when claims disagree, sorted', () => {
    expect(
      birthDates([
        claim('+2004-02-26T00:00:00Z'),
        claim('+2004-02-24T00:00:00Z'),
        claim('+2004-02-24T00:00:00Z'),
      ]),
    ).toEqual(['2004-02-24', '2004-02-26']);
  });

  it('ignores a Julian-calendar date and a claim with no value', () => {
    expect(
      birthDates([
        claim('+1990-01-01T00:00:00Z', 11, 'normal', 'Q1985786'),
        { rank: 'normal', mainsnak: { snaktype: 'somevalue' } },
      ]),
    ).toEqual([]);
  });

  it('reads nothing from no claims', () => {
    expect(birthDates(undefined)).toEqual([]);
  });
});

describe('PEOPLE (recorded Wikidata response)', () => {
  const ids = Object.keys(entitiesResponse.entities);
  const people = readAll(PEOPLE, ids, [entitiesResponse]);

  it('reads a person: human, one birth date, their image', () => {
    expect(people.get('Q66606355')).toEqual({
      human: true,
      births: ['2002-11-25'],
      image: 'Pedri France v Spain 7.24.26-245.jpg',
    });
  });

  it('keeps every candidate when the claims disagree', () => {
    expect(people.get('Q115181709')?.births).toEqual(['2004-02-24', '2004-02-26']);
  });

  it('reads no birth date from a year-only claim', () => {
    expect(people.get('Q65160117')?.births).toEqual([]);
  });

  // A club item has an image too — a building. Only `human` keeps it out.
  it('marks an item that is not a person', () => {
    expect(people.get('Q8682')?.human).toBe(false);
  });

  // An answer, unlike an id the reply skips: Wikidata says there is no item.
  it('reads an item Wikidata does not have as no person', () => {
    const missing = readAll(
      PEOPLE,
      ['Q1', 'Q2'],
      [{ entities: { Q1: { id: 'Q1', missing: '' } } }],
    );
    expect([...missing]).toEqual([['Q1', null]]);
  });
});

describe('PEOPLE answers', () => {
  it('keep only the claims PEOPLE reads, without references or qualifiers', () => {
    const answers = PEOPLE.answers(
      ['Q1', 'Q2'],
      [
        {
          entities: {
            Q1: {
              id: 'Q1',
              labels: { en: { value: 'X' } },
              claims: {
                P31: [{ rank: 'normal', mainsnak: { snaktype: 'value' }, references: [{}] }],
                P54: [{ rank: 'normal', mainsnak: { snaktype: 'value' } }],
                P569: [{ rank: 'normal', mainsnak: { snaktype: 'value' }, qualifiers: {} }],
              },
            },
            Q2: { id: 'Q2', missing: '' },
          },
        },
      ],
    );
    expect([...answers]).toEqual([
      [
        'Q1',
        {
          id: 'Q1',
          claims: {
            P31: [{ rank: 'normal', mainsnak: { snaktype: 'value' } }],
            P569: [{ rank: 'normal', mainsnak: { snaktype: 'value' } }],
          },
        },
      ],
      ['Q2', { id: 'Q2', missing: '' }],
    ]);
  });

  it('answer only the ids asked for', () => {
    expect([...PEOPLE.answers(['Q8682'], [entitiesResponse]).keys()]).toEqual(['Q8682']);
  });
});

describe('infoboxBirth', () => {
  it.each([
    ['{{birth date and age|1999|3|2}}', '1999-03-02'],
    ['{{Birth date and age|df=yes|1999|03|02}}', '1999-03-02'],
    ['{{birth date and age|2009 |January|28|df=y}}', '2009-01-28'],
    ['{{bda|2001|11|3}}', '2001-11-03'],
    ['{{birth date|1995|5|14}}<ref>FIFA</ref>', '1995-05-14'],
  ])('reads %s', (raw, date) => {
    expect(infoboxBirth(raw)).toBe(date);
  });

  it.each([null, '', '1999', '{{birth year and age|1999}}', '{{birth date and age|1999|2|30}}'])(
    'gives nothing for %s rather than a guess',
    (raw) => {
      expect(infoboxBirth(raw)).toBeNull();
    },
  );
});

describe('infoboxClub', () => {
  it.each([
    [
      '[[FC Inter Turku|Inter Turku]]<br/>(on loan from [[Strømsgodset IF|Strømsgodset]])',
      'Inter Turku',
    ],
    ['[[Al-Zawraa SC]]', 'Al-Zawraa SC'],
    ['Free agent', 'Free agent'],
  ])('reads %s', (raw, club) => {
    expect(infoboxClub(raw)).toBe(club);
  });

  it('gives nothing for an empty value', () => {
    expect(infoboxClub(null)).toBeNull();
    expect(infoboxClub('')).toBeNull();
  });
});

describe('INFOBOXES', () => {
  const wikitext = `{{Infobox football biography
| name = Alie Conteh
| birth_date = {{birth date and age|2004|10|29|df=y}}
| currentclub = [[FC Inter Turku|Inter Turku]]
}}
'''Alie Conteh''' is a footballer.`;
  const reply = {
    query: {
      redirects: [{ from: 'Alie Conteh (footballer)', to: 'Alie Conteh' }],
      pages: [{ title: 'Alie Conteh', revisions: [{ slots: { main: { content: wikitext } } }] }],
    },
  };

  it('asks for the lead section of every title in one query', () => {
    expect(INFOBOXES.params(['A', 'B'])).toMatchObject({
      prop: 'revisions',
      rvsection: '0',
      titles: 'A|B',
    });
  });

  it('caches only the two values it reads, following redirects', () => {
    const answers = INFOBOXES.answers(['Alie Conteh (footballer)'], [reply]);
    expect(answers.get('Alie Conteh (footballer)')).toEqual({
      title: 'Alie Conteh',
      birthDate: '{{birth date and age|2004|10|29|df=y}}',
      currentClub: '[[FC Inter Turku|Inter Turku]]',
    });
  });

  it('reads the birth date and club from what it cached', () => {
    const page = INFOBOXES.answers(['Alie Conteh'], [reply]).get('Alie Conteh');
    expect(page === undefined ? null : INFOBOXES.read(page)).toEqual({
      birth: '2004-10-29',
      club: 'Inter Turku',
    });
  });
});
