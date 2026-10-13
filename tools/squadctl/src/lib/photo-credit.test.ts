import { describe, expect, it } from 'vitest';
import imageInfo from './__fixtures__/commons-imageinfo.json';
import { creditsByFile, fileKey, isAcceptedLicence, stripHtml } from './photo-credit.ts';

describe('stripHtml', () => {
  it('reduces a Commons user link to its text', () => {
    expect(stripHtml('<a href="//commons.wikimedia.org/wiki/User:X">Jane  Doe</a>')).toBe(
      'Jane Doe',
    );
  });

  it('decodes named entities', () => {
    expect(stripHtml('A &amp; B &quot;C&quot; &#39;D&#39;&nbsp;E')).toBe('A & B "C" \'D\' E');
  });

  // One malformed author must not fail its whole Commons batch.
  it('leaves an out-of-range numeric entity as written', () => {
    expect(stripHtml('A &#99999999; B &#x110000; C')).toBe('A &#99999999; B &#x110000; C');
  });

  it('decodes every numeric entity, decimal or hex', () => {
    expect(stripHtml('O&#039;Brien &#x00C9;lodie &#233;t&#xE9;')).toBe("O'Brien Élodie été");
  });

  // A derivative work credits both photographers as an HTML list.
  it('joins list items and line breaks with semicolons', () => {
    expect(
      stripHtml('<ul><li><b>Original: </b> A</li>\n<li><b>Derivative work: </b> B</li></ul>'),
    ).toBe('Original: A; Derivative work: B');
    expect(stripHtml('A<br>B<br />C')).toBe('A; B; C');
  });
});

describe('fileKey', () => {
  it('gives pageimages, Wikidata and Commons spellings of one file the same key', () => {
    expect(fileKey('Pedri_2021.jpg')).toBe('Pedri 2021.jpg');
    expect(fileKey('File:Pedri 2021.jpg')).toBe('Pedri 2021.jpg');
    expect(fileKey('Pedri 2021.jpg')).toBe('Pedri 2021.jpg');
  });
});

describe('isAcceptedLicence', () => {
  it.each([
    'CC BY-SA 4.0',
    'CC BY 2.0',
    'CC BY 2.5',
    'CC BY-SA 3.0 at',
    'CC BY-SA 3.0 IGO',
    'CC0',
    'Public domain',
  ])('accepts %s', (licence) => {
    expect(isAcceptedLicence(licence)).toBe(true);
  });

  // "Attribution" is Commons' attribution-only licence: free, but the spec
  // leaves accepting it to a person who has read its wording.
  it.each([
    'CC BY-NC 2.0',
    'CC BY-NC-SA 4.0',
    'GFDL',
    'GFDL 1.2',
    'CC BY-SA',
    'Attribution',
    'Copyrighted free use',
    'PDM-owner',
    'Public domain in the United States',
    'Fair use',
  ])('refuses %s', (licence) => {
    expect(isAcceptedLicence(licence)).toBe(false);
  });
});

describe('creditsByFile (recorded Commons response)', () => {
  const credits = creditsByFile([imageInfo]);

  it('builds a complete credit: file, tracking-free thumbnail, author as text, deed, page', () => {
    expect(credits.get('Pedri France v Spain 7.24.26-245.jpg')).toEqual({
      status: 'ok',
      credit: {
        file: 'Pedri France v Spain 7.24.26-245.jpg',
        url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1c/Pedri_France_v_Spain_7.24.26-245.jpg/500px-Pedri_France_v_Spain_7.24.26-245.jpg',
        author: 'Bryan Berlin',
        licence: 'CC BY-SA 4.0',
        licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:Pedri_France_v_Spain_7.24.26-245.jpg',
      },
    });
  });

  // Commons serves a small original unscaled from upload.wikimedia.org.
  it('accepts an unscaled original on upload.wikimedia.org', () => {
    const outcome = credits.get('20150328 1426 U19 AUTHRV 1333.jpg');
    expect(outcome?.status).toBe('ok');
    if (outcome?.status === 'ok') {
      expect(outcome.credit.url).toBe(
        'https://upload.wikimedia.org/wikipedia/commons/3/3d/20150328_1426_U19_AUTHRV_1333.jpg',
      );
      expect(outcome.credit.licence).toBe('CC BY-SA 3.0 at');
    }
  });

  it('upgrades an http deed link to https', () => {
    const outcome = credits.get('2024 Emirates Cup - Riccardo Calafiori (2) (cropped).jpg');
    expect(outcome?.status).toBe('ok');
    if (outcome?.status === 'ok') {
      expect(outcome.credit.licenceUrl).toBe(
        'https://creativecommons.org/publicdomain/zero/1.0/deed.en',
      );
    }
  });

  it('accepts public domain with no deed', () => {
    const outcome = credits.get('0K8A7853 (53451306071) (cropped).jpg');
    expect(outcome?.status).toBe('ok');
    if (outcome?.status === 'ok') {
      expect(outcome.credit.licence).toBe('Public domain');
      expect(outcome.credit.licenceUrl).toBeNull();
      expect(outcome.credit.author).toBe('Fédération Guinéenne Football');
    }
  });

  // Like Wikipedia, the credit can stand on the licence and a link to the
  // Commons page, which always names the author.
  it('accepts a photo with no author, crediting it to Commons', () => {
    const outcome = credits.get('Cher Ndour.jpg');
    expect(outcome?.status).toBe('ok');
    if (outcome?.status === 'ok') expect(outcome.credit.author).toBeNull();
  });

  it('credits both photographers of a derivative work', () => {
    const outcome = credits.get('20171114 AUT URU 4518 - Rodrigo Bentancur (cropped) 2.jpg');
    expect(outcome?.status).toBe('ok');
    if (outcome?.status === 'ok') {
      expect(outcome.credit.author).toBe('Original: Ailura; Derivative work: Danyele');
    }
  });

  it('refuses a licence outside CC BY / BY-SA / CC0 / public domain, naming it', () => {
    expect(
      credits.get('UEFA Europa Conference League CSKA Sofia - Roma, 2021-12-09 (Kumbulla).jpg'),
    ).toEqual({ status: 'refused-licence', licence: 'GFDL' });
    expect(credits.get('2021-07-28 FC Gossau - FC Wil 1900 02 (Nils Reichmuth).jpg')).toEqual({
      status: 'refused-licence',
      licence: 'Attribution',
    });
  });

  it('names every missing field when Commons has no such file', () => {
    expect(credits.get('Escuadra fixture file that does not exist.jpg')).toEqual({
      status: 'incomplete-credit',
      licence: null,
      missing: ['licence', 'thumbnail', 'commons-page'],
    });
  });

  it('answers only for files the response holds', () => {
    expect(credits.get('Never requested.jpg')).toBeUndefined();
  });
});

describe('creditsByFile (edge cases)', () => {
  const page = (title: string, thumburl: string, licence = 'CC BY 4.0') => ({
    title,
    imageinfo: [
      {
        thumburl,
        descriptionurl: `https://commons.wikimedia.org/wiki/${title.replace(/ /g, '_')}`,
        extmetadata: { LicenseShortName: { value: licence } },
      },
    ],
  });

  it('refuses a thumbnail hosted anywhere but Wikimedia, or over plain http', () => {
    const credits = creditsByFile([
      {
        query: {
          pages: [
            page('File:Elsewhere.jpg', 'https://example.org/x.jpg'),
            page('File:Plain.jpg', 'http://upload.wikimedia.org/wikipedia/commons/a/ab/Plain.jpg'),
          ],
        },
      },
    ]);
    expect(credits.get('Elsewhere.jpg')).toEqual({
      status: 'incomplete-credit',
      licence: 'CC BY 4.0',
      missing: ['thumbnail'],
    });
    expect(credits.get('Plain.jpg')?.status).toBe('incomplete-credit');
  });

  // A `continue`d query answers the same file across two responses; the one
  // carrying imageinfo wins over the one that does not.
  it('merges a file answered across continued responses', () => {
    const credits = creditsByFile([
      { query: { pages: [{ title: 'File:Split.jpg' }] } },
      {
        query: {
          pages: [page('File:Split.jpg', 'https://upload.wikimedia.org/wikipedia/commons/s.jpg')],
        },
      },
    ]);
    expect(credits.get('Split.jpg')?.status).toBe('ok');
  });

  it('keys a file by the name it was requested under when Commons normalises it', () => {
    const credits = creditsByFile([
      {
        query: {
          normalized: [{ from: 'File:lower.jpg', to: 'File:Lower.jpg' }],
          pages: [page('File:Lower.jpg', 'https://upload.wikimedia.org/wikipedia/commons/l.jpg')],
        },
      },
    ]);
    expect(credits.get('lower.jpg')?.status).toBe('ok');
    expect(credits.get('Lower.jpg')?.status).toBe('ok');
  });
});
