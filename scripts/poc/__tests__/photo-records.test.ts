import { describe, expect, it } from 'vitest';
import {
  BATCH_SIZE,
  chunk,
  creditsByFile,
  fileKey,
  isAcceptedLicence,
  leadImagesByTitle,
  renderReport,
  stripHtml,
  type ReportRow,
} from '../lib/photo-records.ts';
import imageInfo from './fixtures/imageinfo.json';
import pageImages from './fixtures/pageimages.json';

describe('chunk', () => {
  it('splits into MediaWiki-sized batches', () => {
    const titles = Array.from({ length: 120 }, (_, i) => `T${i}`);
    expect(chunk(titles, BATCH_SIZE).map((b) => b.length)).toEqual([50, 50, 20]);
  });

  it('returns no batches for no items', () => {
    expect(chunk([], BATCH_SIZE)).toEqual([]);
  });
});

describe('stripHtml', () => {
  it('reduces a Commons user link to its text', () => {
    expect(stripHtml('<a href="//commons.wikimedia.org/wiki/User:X">Jane  Doe</a>')).toBe(
      'Jane Doe',
    );
  });

  it('decodes the entities Commons emits', () => {
    expect(stripHtml('A &amp; B &quot;C&quot; &#39;D&#39;&nbsp;E')).toBe('A & B "C" \'D\' E');
  });
});

describe('fileKey', () => {
  it('gives pageimages and Commons spellings of one file the same key', () => {
    expect(fileKey('Pedri_2021.jpg')).toBe('Pedri 2021.jpg');
    expect(fileKey('File:Pedri 2021.jpg')).toBe('Pedri 2021.jpg');
  });
});

describe('isAcceptedLicence', () => {
  it.each(['CC BY-SA 4.0', 'CC BY 2.0', 'CC BY-SA 3.0 de', 'CC0', 'Public domain'])(
    'accepts %s',
    (licence) => {
      expect(isAcceptedLicence(licence)).toBe(true);
    },
  );

  it.each(['CC BY-NC 2.0', 'CC BY-NC-SA 4.0', 'GFDL', 'CC BY-SA', 'Fair use'])(
    'refuses %s',
    (licence) => {
      expect(isAcceptedLicence(licence)).toBe(false);
    },
  );
});

describe('leadImagesByTitle', () => {
  const titles = [
    'Pedri',
    'Rodri_(footballer,_born_1996)',
    'Ferran Torres García',
    'Víctor Muñoz (footballer, born 2003)',
    'Nobody Real',
    'Never Requested Back',
  ];
  const images = leadImagesByTitle(titles, pageImages);

  it('maps a plain title to its lead image', () => {
    expect(images.get('Pedri')).toBe('Fixture_Pedri.jpg');
  });

  it('follows title normalisation', () => {
    expect(images.get('Rodri_(footballer,_born_1996)')).toBe('Fixture_Rodri.jpg');
  });

  it('follows redirects', () => {
    expect(images.get('Ferran Torres García')).toBe('Fixture_Ferran.jpg');
  });

  it('returns null for an article without a free lead image, a missing page, or no answer', () => {
    expect(images.get('Víctor Muñoz (footballer, born 2003)')).toBeNull();
    expect(images.get('Nobody Real')).toBeNull();
    expect(images.get('Never Requested Back')).toBeNull();
  });
});

describe('creditsByFile', () => {
  const credits = creditsByFile(imageInfo);

  it('builds a complete credit with the author stripped to text', () => {
    expect(credits.get('Fixture Pedri.jpg')).toEqual({
      status: 'ok',
      credit: {
        url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Fixture_Pedri.jpg/512px-Fixture_Pedri.jpg',
        author: 'Example Photographer',
        licence: 'CC BY-SA 4.0',
        licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:Fixture_Pedri.jpg',
      },
    });
  });

  // Like Wikipedia, the credit can stand on the licence and a link to the
  // Commons page, which always names the author.
  it('accepts a photo with no author, crediting it to Commons', () => {
    const outcome = credits.get('Fixture Rodri.jpg');
    expect(outcome?.status).toBe('ok');
    if (outcome?.status === 'ok') expect(outcome.credit.author).toBeNull();
  });

  it('names every missing field when Commons sends no image info at all', () => {
    expect(credits.get('Fixture Bare.jpg')).toEqual({
      status: 'incomplete-licence',
      licence: null,
      missing: ['licence', 'thumbnail', 'commons-page'],
    });
  });

  it('drops a licence outside CC BY / BY-SA / CC0 / public domain', () => {
    expect(credits.get('Fixture Ferran.jpg')).toEqual({
      status: 'unexpected-licence',
      licence: 'CC BY-NC 2.0',
    });
  });

  it('accepts public domain without a licence URL', () => {
    const outcome = credits.get('Fixture Old.jpg');
    expect(outcome?.status).toBe('ok');
    if (outcome?.status === 'ok') {
      expect(outcome.credit.author).toBe('Unknown & anonymous');
      expect(outcome.credit.licenceUrl).toBeNull();
    }
  });

  // Commons serves scaled thumbnails from thumb.wikimedia.org, snaps the width
  // to a standard bucket, and appends utm_* tracking parameters.
  it('accepts a thumbnail on thumb.wikimedia.org, without tracking parameters', () => {
    const outcome = credits.get('Fixture Bucketed.jpg');
    expect(outcome?.status).toBe('ok');
    if (outcome?.status === 'ok') {
      expect(outcome.credit.url).toBe(
        'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1c/Fixture_Bucketed.jpg/960px-Fixture_Bucketed.jpg',
      );
    }
  });

  it('drops a thumbnail hosted anywhere but Wikimedia', () => {
    expect(credits.get('Fixture Elsewhere.jpg')).toEqual({
      status: 'incomplete-licence',
      licence: 'CC BY 4.0',
      missing: ['thumbnail'],
    });
  });

  // Commons often omits LicenseUrl for CC files; the credit links to the
  // Commons page instead, which carries the licence and its deed.
  it('accepts a CC licence that comes without its deed URL', () => {
    const outcome = credits.get('Fixture NoDeed.jpg');
    expect(outcome?.status).toBe('ok');
    if (outcome?.status === 'ok') expect(outcome.credit.licenceUrl).toBeNull();
  });
});

describe('renderReport', () => {
  const row = (no: number, status: ReportRow['status'], licence: string | null): ReportRow => ({
    playerId: `p${no}`,
    name: `Player ${no}`,
    no,
    wikiTitle: status === 'no-article' ? null : `Player ${no}`,
    status,
    file: status === 'ok' || status === 'incomplete-licence' ? `File ${no}.jpg` : null,
    licence,
    missing: status === 'incomplete-licence' ? ['thumbnail'] : [],
  });
  const report = renderReport('Spain', [
    row(1, 'ok', 'CC BY-SA 4.0'),
    row(2, 'ok', 'CC BY 2.0'),
    row(3, 'no-article', null),
    row(4, 'incomplete-licence', 'CC BY 2.0'),
  ]);

  it('reports coverage and usable share', () => {
    expect(report).toContain('| Members | 4 | 100% |');
    expect(report).toContain('| With a free lead image | 3 | 75% |');
    expect(report).toContain('| Usable (complete, accepted licence) | 2 | 50% |');
  });

  it('counts every status and lists the licence mix of usable photos only', () => {
    expect(report).toContain('| no-article | 1 |');
    expect(report).toContain('| lookup-failed | 0 |');
    expect(report).toContain('| CC BY 2.0 | 1 |');
    expect(report).toContain('| CC BY-SA 4.0 | 1 |');
  });

  it('lists each player, with what an incomplete credit is missing', () => {
    expect(report).toContain('| 3 | Player 3 | no-article | — | — | — |');
    expect(report).toContain(
      '| 4 | Player 4 | incomplete-licence | File 4.jpg | CC BY 2.0 | thumbnail |',
    );
  });
});
