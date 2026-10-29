import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  findTemplates,
  isOutOnLoan,
  namedParams,
  parseClubField,
  parseIll,
  parseSection,
  parseSortname,
  parseUpdated,
  parseWikilink,
  selectSquadSection,
  splitParams,
} from '../wikitext-parse.ts';

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const fixture = (name: string): string =>
  readFileSync(path.join(FIXTURES, `${name}.wikitext`), 'utf8');

describe('splitParams', () => {
  // The trap the depth tracking exists for: three pipes live inside {{}}.
  it('does not split inside a nested template', () => {
    expect(splitParams('no=1|age={{birth date and age|df=y|1995|9|15}}|pos=GK')).toEqual([
      'no=1',
      'age={{birth date and age|df=y|1995|9|15}}',
      'pos=GK',
    ]);
  });

  it('does not split inside a piped wikilink', () => {
    expect(splitParams('name=[[Rodri (footballer, born 1996)|Rodri]]|pos=MF')).toEqual([
      'name=[[Rodri (footballer, born 1996)|Rodri]]',
      'pos=MF',
    ]);
  });

  it('handles a template nested inside a wikilink-bearing parameter', () => {
    expect(splitParams('a=1|b=[[X|Y]] {{t|p|q}}|c=3')).toEqual([
      'a=1',
      'b=[[X|Y]] {{t|p|q}}',
      'c=3',
    ]);
  });

  it('returns a single part when there is nothing to split', () => {
    expect(splitParams('fs start')).toEqual(['fs start']);
  });
});

describe('parseWikilink', () => {
  it('separates a disambiguated target from its display text', () => {
    expect(parseWikilink('[[Rodri (footballer, born 1996)|Rodri]]')).toEqual({
      title: 'Rodri (footballer, born 1996)',
      display: 'Rodri',
    });
  });

  it('uses the target as display text when there is no pipe', () => {
    expect(parseWikilink('[[Lamine Yamal]]')).toEqual({
      title: 'Lamine Yamal',
      display: 'Lamine Yamal',
    });
  });

  it('strips an anchor and normalises underscores', () => {
    expect(parseWikilink('[[Arsenal_F.C.#Players|Arsenal]]')).toEqual({
      title: 'Arsenal F.C.',
      display: 'Arsenal',
    });
  });

  it('reports a plain unlinked value as having no title', () => {
    expect(parseWikilink('Bukayo Saka')).toEqual({ title: null, display: 'Bukayo Saka' });
  });
});

describe('parseSortname', () => {
  it('joins the two positional parameters and links the same title', () => {
    expect(parseSortname('{{sortname|Mathew|Ryan}}')).toEqual({
      title: 'Mathew Ryan',
      display: 'Mathew Ryan',
    });
  });

  it('disambiguates the title with dab= while leaving the display name alone', () => {
    expect(parseSortname('{{sortname|Matt|Turner|dab=soccer}}')).toEqual({
      title: 'Matt Turner (soccer)',
      display: 'Matt Turner',
    });
  });

  it('keeps a comma inside dab=, which splitParams would otherwise not reach', () => {
    expect(parseSortname('{{sortname|Mohamed|Touré|dab=soccer, born 2004}}')).toEqual({
      title: 'Mohamed Touré (soccer, born 2004)',
      display: 'Mohamed Touré',
    });
  });

  it('takes a third positional parameter as the link target', () => {
    expect(parseSortname('{{sortname|Tim|Ream|Timothy Ream}}')).toEqual({
      title: 'Timothy Ream',
      display: 'Tim Ream',
    });
  });

  it('links nowhere when nolink is set', () => {
    expect(parseSortname('{{sortname|Kai|Trewin|nolink=1}}')).toEqual({
      title: null,
      display: 'Kai Trewin',
    });
  });

  it('returns null for a plain wikilink, so the caller falls back', () => {
    expect(parseSortname('[[Lamine Yamal]]')).toBeNull();
  });
});

// `{{ill}}` links a person or club with no English article to another
// language's. Left unread, the template source itself became the name: 25
// records stored raw wikitext (#230).
describe('parseIll', () => {
  it('takes the first parameter as the display text and links no article', () => {
    expect(parseIll('{{ill|Juan Manuel Rengifo|es}}')).toEqual({
      title: null,
      display: 'Juan Manuel Rengifo',
    });
  });

  it('ignores the language-code and foreign-title pairs after the first parameter', () => {
    expect(parseIll('{{ill|Jonathan Fonkel|nl|Jonathan Fonkel|pt|Jonathan Fonkel}}')?.display).toBe(
      'Jonathan Fonkel',
    );
  });

  it('shows lt= over the first parameter, wherever it sits', () => {
    expect(parseIll('{{ill|CSD Ebenezer|lt=Ebenezer|es|Club Socio Deportivo Ebenezer}}')).toEqual({
      title: null,
      display: 'Ebenezer',
    });
  });

  it('reads {{sortname ill}} as first and last name, then a language code', () => {
    expect(parseIll('{{sortname ill|Awet|Alemseged|no}}')).toEqual({
      title: null,
      display: 'Awet Alemseged',
    });
  });

  it('returns null for a wikilink and for a plain value, so the caller falls back', () => {
    expect(parseIll('[[Lamine Yamal]]')).toBeNull();
    expect(parseIll('Bukayo Saka')).toBeNull();
  });

  it('returns null for a template that is not an ill, even when one is nested in it', () => {
    expect(parseIll('{{sortname|Mathew|Ryan}}')).toBeNull();
  });
});

describe('parseClubField', () => {
  it('reads a wikilink, keeping the article title apart from the display text', () => {
    expect(parseClubField('[[FC Barcelona|Barcelona]]')).toEqual({
      club: 'Barcelona',
      clubTitle: 'FC Barcelona',
    });
  });

  // Sri Lanka's and Palestine's articles italicise the whole cell.
  it('sees through the italics around a link', () => {
    expect(parseClubField("''[[Rot-Weiß Walldorf]]''")).toEqual({
      club: 'Rot-Weiß Walldorf',
      clubTitle: 'Rot-Weiß Walldorf',
    });
  });

  it('reads an {{ill}} club, which has no English article to title', () => {
    expect(parseClubField('{{ill|FC 15 de Agosto|lt=15 de Agosto|es}}')).toEqual({
      club: '15 de Agosto',
      clubTitle: null,
    });
  });

  it.each([
    "''[[Free agent]]''",
    "''[[Free Agent|Unattached]]''",
    '[[free agent]]',
    "''Unattached''",
    'Free agent',
  ])('reads %s as no club', (value) => {
    expect(parseClubField(value)).toEqual({ club: null, clubTitle: null });
  });

  it('reads an empty or missing value as no club', () => {
    expect(parseClubField('')).toEqual({ club: null, clubTitle: null });
    expect(parseClubField(undefined)).toEqual({ club: null, clubTitle: null });
  });
});

describe('findTemplates', () => {
  it('returns only top-level templates, keeping nested ones inside raw', () => {
    const found = findTemplates('{{a|x={{b|1|2}}}}{{c}}');
    expect(found.map((t) => t.name)).toEqual(['a', 'c']);
    expect(found[0]?.raw).toBe('{{a|x={{b|1|2}}}}');
  });

  it('stops rather than emitting a truncated template on unbalanced braces', () => {
    expect(findTemplates('{{a|b}}{{c|d')).toHaveLength(1);
  });
});

describe('namedParams', () => {
  it('keys named parameters lowercase and ignores positional ones', () => {
    expect(namedParams(['no=1', 'GK', 'Pos=MF'])).toEqual({ no: '1', pos: 'MF' });
  });
});

describe('parseUpdated', () => {
  it('reads the date out of the template rather than surrounding prose', () => {
    expect(parseUpdated('{{updated|1 September 2026}}')).toBe('2026-09-01');
  });

  it('returns null when there is no updated template', () => {
    expect(parseUpdated('Squad correct as of 1 September 2026.')).toBeNull();
  });
});

describe('parseSection — club squad', () => {
  const parsed = parseSection(fixture('club-first-team-squad'));

  it('parses every player row', () => {
    expect(parsed.rows).toHaveLength(7);
    expect(parsed.asOf).toBe('2026-09-01');
    expect(parsed.unknownTemplates).toEqual([]);
  });

  // The guard that matters most: this squad carries `captain`, `vice-captain`
  // AND `3rd captain`, so a substring test yields three and trips the
  // "at most one captain" hard failure on the first team parsed.
  it('finds exactly one captain despite vice- and 3rd-captain rows', () => {
    const captains = parsed.rows.filter((r) => r.captain).map((r) => r.name);
    expect(captains).toEqual(['Martin Ødegaard']);
  });

  it('keeps a numberless row with no: null rather than dropping it', () => {
    const jones = parsed.rows.find((r) => r.name === 'Curtis Jones');
    expect(jones?.no).toBeNull();
    expect(jones?.position).toBe('MF');
  });

  it('carries the raw nat code untranslated and no birth date', () => {
    const raya = parsed.rows[0];
    expect(raya?.nat).toBe('ESP');
    expect(raya?.birth).toBeNull();
    expect(raya?.club).toBeNull();
  });

  it('keeps the source line verbatim for each row', () => {
    expect(parsed.rows[0]?.raw).toBe('{{fs player|no=1|nat=ESP|name=[[David Raya]]|pos=GK}}');
  });
});

describe('parseSection — nation squad', () => {
  const parsed = parseSection(fixture('nation-current-squad'));

  it('parses birth dates out of the nested age template', () => {
    expect(parsed.rows.map((r) => r.birth)).toEqual(['1997-06-11', '1996-06-22', '2007-07-13']);
  });

  it('takes the club display text, not the article title', () => {
    expect(parsed.rows.map((r) => r.club)).toEqual([
      'Athletic Bilbao',
      'Manchester City',
      'Barcelona',
    ]);
  });

  it('keeps a disambiguated name as its display form', () => {
    const rodri = parsed.rows[1];
    expect(rodri?.name).toBe('Rodri');
    expect(rodri?.title).toBe('Rodri (footballer, born 1996)');
    expect(rodri?.captain).toBe(true);
  });

  it('carries no nat parameter, since a nation squad has none per member', () => {
    expect(parsed.rows.every((r) => r.nat === null)).toBe(true);
  });
});

describe('parseSection — recent call-ups', () => {
  const parsed = parseSection(fixture('nation-recent-call-ups'));

  it('parses numberless call-up rows and their nested latest= template', () => {
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows.map((r) => r.no)).toEqual([null, null]);
    expect(parsed.rows.map((r) => r.name)).toEqual(['David Raya', 'Pau Torres']);
    expect(parsed.rows[0]?.club).toBe('Arsenal');
    expect(parsed.rows[0]?.birth).toBe('1995-09-15');
  });
});

describe('parseSection — anomalies', () => {
  it('surfaces a player-ish template it does not recognise', () => {
    const parsed = parseSection('{{squad list player|no=9|name=[[A B]]|pos=FW}}');
    expect(parsed.rows).toEqual([]);
    expect(parsed.unknownTemplates.map((t) => t.name)).toEqual(['squad list player']);
  });

  // `Fs player` is a redirect to Template:Football squad player, and
  // Nottingham Forest's article switched to the full name in October 2026.
  it('reads the full template name `Fs player` redirects to', () => {
    const parsed = parseSection(
      '{{football squad player|no=9|nat=NZL|pos=FW|name=[[Chris Wood (footballer, born 1991)|Chris Wood]]}}',
    );
    expect(parsed.unknownTemplates).toEqual([]);
    expect(parsed.rows.map((r) => [r.no, r.name, r.title])).toEqual([
      [9, 'Chris Wood', 'Chris Wood (footballer, born 1991)'],
    ]);
  });

  it('ignores non-player templates without recording them', () => {
    const parsed = parseSection('{{fs start}}{{fs end}}{{reflist}}');
    expect(parsed.rows).toEqual([]);
    expect(parsed.unknownTemplates).toEqual([]);
  });

  it('reports an unrecognised position as null while keeping the raw value', () => {
    const parsed = parseSection('{{fs player|no=3|nat=ENG|name=[[A B]]|pos=SW}}');
    expect(parsed.rows[0]?.position).toBeNull();
    expect(parsed.rows[0]?.positionRaw).toBe('SW');
  });

  // The United States and Australia articles write every single player this
  // way; without it 52 records landed as `sortnamemathewryan`.
  it('reads a name written as a sortname template', () => {
    const parsed = parseSection('{{nat fs g player|no=1|pos=GK|name={{sortname|Mathew|Ryan}}}}');
    expect(parsed.rows[0]?.name).toBe('Mathew Ryan');
    expect(parsed.rows[0]?.title).toBe('Mathew Ryan');
  });

  // Recorded rows from the Suriname, Colombia, Eritrea, Equatorial Guinea, Sri
  // Lanka, Bermuda, Palestine, Albania, Philippines and Benin articles: the 25
  // records of #230, one row per way a name or club was written.
  describe('on recorded rows that once stored wikitext', () => {
    const rows = parseSection(fixture('nation-ill-and-linked-clubs')).rows;
    const row = (name: string) => rows.find((r) => r.name === name);

    it('reads an {{ill}} name, and an {{ill}} with a language pair', () => {
      expect(row('Jonathan Fonkel')?.club).toBe('Robinhood');
      expect(row('Juan Manuel Rengifo')?.title).toBeNull();
    });

    it('reads a {{sortname ill}} name', () => {
      expect(row('Awet Alemseged')?.club).toBe('Grorud IL');
    });

    it('reads an {{ill}} club and an italicised linked club', () => {
      expect(row('Miguel Ángel Nkogo')?.club).toBe('Ebenezer');
      expect(row('Jason Thayaparan')?.club).toBe('Rot-Weiß Walldorf');
      expect(row('Jason Thayaparan')?.clubTitle).toBe('Rot-Weiß Walldorf');
    });

    // American Samoa's article puts a flag icon in front of one club.
    it('skips a flag icon in front of a linked club', () => {
      expect(row('Nicky Salapu')?.club).toBe('PanSa East F.C.');
      expect(row('Nicky Salapu')?.clubTitle).toBe('PanSa East F.C.');
    });

    it('reads every way of writing a free agent as no club', () => {
      for (const name of [
        'Milai Perott',
        'Abed Yassin',
        'Elseid Hysaj',
        'Angelo Brückner',
        'Mohamed Tijani',
        'Some Player',
      ]) {
        expect(row(name)?.club, name).toBeNull();
        expect(row(name)?.clubTitle, name).toBeNull();
      }
    });

    it('leaves no row holding a brace or a bracket', () => {
      for (const r of rows) {
        expect(`${r.name}${r.club ?? ''}${r.clubTitle ?? ''}`, r.name).not.toMatch(/\{\{|\[\[/);
      }
      expect(rows).toHaveLength(12);
    });
  });

  it('accepts the nat fs g player variant', () => {
    const parsed = parseSection('{{nat fs g player|no=1|pos=GK|name=[[A B]]}}');
    expect(parsed.rows).toHaveLength(1);
  });
});

describe('selectSquadSection', () => {
  it('takes the first match in priority order, not document order', () => {
    expect(
      selectSquadSection([
        { line: 'History', index: '3' },
        { line: 'Players', index: '11' },
        { line: 'Current squad', index: '12' },
      ]),
    ).toEqual({ index: '12', title: 'Current squad' });
  });

  it('falls down the list, which is normal for English club articles', () => {
    expect(
      selectSquadSection([
        { line: 'History', index: '3' },
        { line: 'First-team squad', index: '24' },
      ]),
    ).toEqual({ index: '24', title: 'First-team squad' });
  });

  it('returns null when the article has no squad section at all', () => {
    expect(selectSquadSection([{ line: 'History', index: '3' }])).toBeNull();
  });
});

describe('isOutOnLoan', () => {
  // Premier League and Serie A articles keep a loaned-away player INLINE in
  // the main squad table, so `trimToFirstSquadTable` has no heading to cut
  // at. `other=` is the only signal, and its two directions mean opposite
  // things: `from` is where the player plays, `to`/`at` is the club that
  // merely owns the registration.
  it('drops the "at [[club]] until <date>" form, the most common one', () => {
    expect(
      isOutOnLoan(
        '{{Fs player|no=19|nat=ENG|pos=MF|name=[[Harvey Elliott]]|other=at [[Valencia CF|Valencia]] until 30 June 2027}}',
      ),
    ).toBe(true);
  });

  it('drops the "on loan to [[club]]" form', () => {
    expect(
      isOutOnLoan(
        '{{Fs player|no=22|nat=ENG|pos=FW|name=[[Ethan Nwaneri]]|other=on loan to [[Borussia Dortmund]] until 30 June 2027}}',
      ),
    ).toBe(true);
  });

  it('KEEPS "on loan from", which means the player is at THIS club', () => {
    expect(
      isOutOnLoan(
        '{{Fs player|no=18|nat=ENG|pos=MF|name=[[Ethan Nwaneri]]|other=on loan from [[Arsenal F.C.|Arsenal]]}}',
      ),
    ).toBe(false);
  });

  it('keeps a captain row, where other= carries the armband instead', () => {
    expect(
      isOutOnLoan('{{Fs player|no=8|nat=NOR|pos=MF|name=[[Martin Ødegaard]]|other=captain}}'),
    ).toBe(false);
  });

  it('keeps a row with no other= at all', () => {
    expect(isOutOnLoan('{{Fs player|no=45|nat=ALG|pos=DF|name=[[Rafik Belghali]]}}')).toBe(false);
  });

  // Fail-safe direction. An unrecognised annotation leaves the player in both
  // squads, which dataIntegrity then fails loudly on — far better than
  // silently shortening a squad on a phrasing nobody has seen yet.
  it('keeps a row whose other= is an unrecognised phrasing', () => {
    expect(
      isOutOnLoan(
        '{{Fs player|no=7|nat=ESP|pos=FW|name=[[Someone]]|other=training with the squad}}',
      ),
    ).toBe(false);
  });

  it('anchors at the start, so a club whose name contains "at" is not dropped', () => {
    expect(
      isOutOnLoan(
        '{{Fs player|no=9|nat=ESP|pos=FW|name=[[Someone]]|other=on loan from [[Atlético Madrid]]}}',
      ),
    ).toBe(false);
  });
});
