import { describe, expect, it } from 'vitest';
import pagesResponse from './__fixtures__/wikipedia-pages.json';
import entitiesResponse from './__fixtures__/wikidata-entities.json';
import {
  BATCH_SIZE,
  articlesByTitle,
  birthDates,
  chunk,
  peopleById,
  trimEntities,
} from './wikimedia-parse.ts';

describe('chunk', () => {
  it('splits into MediaWiki-sized batches', () => {
    const titles = Array.from({ length: 120 }, (_, i) => `T${i}`);
    expect(chunk(titles, BATCH_SIZE).map((b) => b.length)).toEqual([50, 50, 20]);
  });

  it('returns no batches for no items', () => {
    expect(chunk([], BATCH_SIZE)).toEqual([]);
  });
});

describe('articlesByTitle (recorded Wikipedia response)', () => {
  const titles = [
    'Pedri',
    'Eric García (footballer, born 2001)',
    'Abu Francis',
    'Federico Serra (footballer, born 2006)',
    'Josh Cullen (footballer)',
    'Rodri_(footballer,_born_1996)',
  ];
  const articles = articlesByTitle(titles, [pagesResponse]);

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
    expect(articlesByTitle(['Never Asked'], [pagesResponse]).has('Never Asked')).toBe(false);
  });

  // `continue` splits one batch's props across responses: the image in one,
  // the Wikidata item in the next.
  it('merges a page answered across continued responses', () => {
    const merged = articlesByTitle(
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

describe('peopleById (recorded Wikidata response)', () => {
  const people = peopleById([entitiesResponse]);

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
});

describe('trimEntities', () => {
  it('keeps only the claims enrich reads, without references or qualifiers', () => {
    const trimmed = trimEntities({
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
    });
    expect(trimmed).toEqual({
      entities: {
        Q1: {
          id: 'Q1',
          claims: {
            P31: [{ rank: 'normal', mainsnak: { snaktype: 'value' } }],
            P569: [{ rank: 'normal', mainsnak: { snaktype: 'value' } }],
          },
        },
        Q2: { id: 'Q2', missing: '' },
      },
    });
  });

  it('is idempotent, so a cached response trims to itself', () => {
    expect(trimEntities(trimEntities(entitiesResponse))).toEqual(trimEntities(entitiesResponse));
  });
});
