// What each language must say, written down before its catalog exists (#145).
// Only supported languages run, so a language's facts wait here until its PR
// adds it. A native reviewer's correction changes the table in the same commit.
import { describe, expect, it } from 'vitest';
import type { FlagCode } from '@/assets/flags/generated';
import type { Position } from '@/types/squad';
import { CATALOGS } from '../catalogs';
import { countryName } from '../displayNames';
import { catalogLeaves, isLater } from '../leaves';
import { resolveLanguage, SUPPORTED_LANGUAGES, type Language } from '../resolveLanguage';
import { translationNotice } from '../translationNotice';

interface Facts {
  /** `formats.date` for 21 August 2026. */
  date: string;
  /** `formats.longDate`, the privacy pages' date, for 21 August 2026 and for
   *  1 October 2026: French and Italian write the 1st as an ordinal. */
  longDate: readonly [string, string];
  /** `study.players` for 0, 1 and 2. French treats 0 as singular. */
  players: readonly [string, string, string];
  positionCodes: Readonly<Record<Position, string>>;
  /** The hand-written names (the four home nations, FIFA-style ones) and the language's own country. */
  countries: Readonly<Partial<Record<FlagCode, string>>>;
  /** A phone set to this tag resolves to the language on first launch. */
  phoneTag: string;
  /** A no-break space before ? ! : ; and inside « ». */
  frenchSpacing: boolean;
  /** The last line of a translated privacy text (#141): the English text governs. */
  translationNotice: string | null;
}

const FACTS: Record<Language, Facts> = {
  en: {
    date: '21 Aug 2026',
    longDate: ['21 August 2026', '1 October 2026'],
    players: ['0 players', '1 player', '2 players'],
    positionCodes: { GK: 'GK', DF: 'DF', MF: 'MF', FW: 'FW' },
    countries: { ENG: 'England', ESP: 'Spain' },
    phoneTag: 'en-GB',
    frenchSpacing: false,
    translationNotice: null,
  },
  de: {
    date: '21. Aug. 2026',
    longDate: ['21. August 2026', '1. Oktober 2026'],
    players: ['0 Spieler', '1 Spieler', '2 Spieler'],
    positionCodes: { GK: 'TW', DF: 'ABW', MF: 'MF', FW: 'ST' },
    countries: {
      GER: 'Deutschland',
      ENG: 'England',
      SCO: 'Schottland',
      WAL: 'Wales',
      NIR: 'Nordirland',
      CIV: 'Elfenbeinküste',
      COD: 'DR Kongo',
      CGO: 'Kongo',
      CPV: 'Kap Verde',
      USA: 'USA',
      BOT: 'Botswana',
      BRU: 'Brunei',
      HKG: 'Hongkong',
      MAC: 'Macau',
      MDA: 'Moldau',
      PLE: 'Palästina',
      TAH: 'Tahiti',
      TLS: 'Osttimor',
    },
    phoneTag: 'de-AT',
    frenchSpacing: false,
    translationNotice:
      'Dies ist eine Übersetzung. Weicht sie vom englischen Text ab, gilt der englische Text.',
  },
  fr: {
    date: '21 août 2026',
    longDate: ['21 août 2026', '1er octobre 2026'],
    players: ['0 joueur', '1 joueur', '2 joueurs'],
    positionCodes: { GK: 'GB', DF: 'DÉF', MF: 'MIL', FW: 'ATT' },
    countries: {
      FRA: 'France',
      ENG: 'Angleterre',
      SCO: 'Écosse',
      WAL: 'Pays de Galles',
      NIR: 'Irlande du Nord',
      COD: 'RD Congo',
      CGO: 'Congo',
      HKG: 'Hong Kong',
      MAC: 'Macao',
      MYA: 'Birmanie',
      PLE: 'Palestine',
      SKN: 'Saint-Kitts-et-Nevis',
      TAH: 'Tahiti',
      VIE: 'Vietnam',
      VIN: 'Saint-Vincent-et-les-Grenadines',
      VIR: 'Îles Vierges américaines',
    },
    phoneTag: 'fr-CA',
    frenchSpacing: true,
    translationNotice:
      'Ceci est une traduction. En cas de divergence avec le texte anglais, c’est le texte anglais qui fait foi.',
  },
  es: {
    date: '21 ago 2026',
    longDate: ['21 de agosto de 2026', '1 de octubre de 2026'],
    players: ['0 jugadores', '1 jugador', '2 jugadores'],
    positionCodes: { GK: 'POR', DF: 'DEF', MF: 'MED', FW: 'DEL' },
    countries: {
      ESP: 'España',
      ENG: 'Inglaterra',
      SCO: 'Escocia',
      WAL: 'Gales',
      NIR: 'Irlanda del Norte',
      CIV: 'Costa de Marfil',
      COD: 'RD Congo',
      MLI: 'Malí',
      HKG: 'Hong Kong',
      MAC: 'Macao',
      MYA: 'Birmania',
      PLE: 'Palestina',
      TAH: 'Tahití',
      TLS: 'Timor Oriental',
    },
    phoneTag: 'es-MX',
    frenchSpacing: false,
    translationNotice:
      'Esta es una traducción. Si difiere del texto en inglés, prevalece el texto en inglés.',
  },
  it: {
    date: '21 ago 2026',
    longDate: ['21 agosto 2026', '1º ottobre 2026'],
    players: ['0 giocatori', '1 giocatore', '2 giocatori'],
    positionCodes: { GK: 'POR', DF: 'DIF', MF: 'CEN', FW: 'ATT' },
    countries: {
      ITA: 'Italia',
      ENG: 'Inghilterra',
      SCO: 'Scozia',
      WAL: 'Galles',
      NIR: 'Irlanda del Nord',
      COD: 'RD Congo',
      CGO: 'Congo',
      CZE: 'Repubblica Ceca',
      FRO: 'Isole Far Oer',
      HKG: 'Hong Kong',
      MAC: 'Macao',
      MYA: 'Birmania',
      PLE: 'Palestina',
      TAH: 'Tahiti',
    },
    phoneTag: 'it-CH',
    frenchSpacing: false,
    translationNotice:
      'Questa è una traduzione. In caso di differenze rispetto al testo inglese, prevale il testo inglese.',
  },
};

describe.each(SUPPORTED_LANGUAGES)('%s', (language) => {
  const facts = FACTS[language];
  const messages = CATALOGS[language];

  it('writes the date its own way', () => {
    expect(messages.formats.date({ day: 21, month: 8, year: 2026 })).toBe(facts.date);
  });

  it('writes the date in full its own way', () => {
    expect([
      messages.formats.longDate({ day: 21, month: 8, year: 2026 }),
      messages.formats.longDate({ day: 1, month: 10, year: 2026 }),
    ]).toEqual(facts.longDate);
  });

  it('writes its own singular and plural', () => {
    expect([0, 1, 2].map((n) => messages.study.players(n))).toEqual(facts.players);
  });

  it('uses the position codes its fans use', () => {
    expect(messages.positionCodes).toEqual(facts.positionCodes);
  });

  it('names the hand-written countries as decided', () => {
    for (const [code, name] of Object.entries(facts.countries)) {
      // Object.entries widens the key to string; the keys come from a
      // Partial<Record<FlagCode, string>>, so each is a FlagCode.
      expect(countryName(code as FlagCode, language)).toBe(name);
    }
  });

  it('ends a translated privacy text with the notice that English governs', () => {
    expect(translationNotice(language)).toBe(facts.translationNotice);
  });

  it('is what a phone set to it opens in, on first launch', () => {
    expect(resolveLanguage('system', [facts.phoneTag, 'en-US'], SUPPORTED_LANGUAGES)).toBe(
      language,
    );
  });

  it.runIf(facts.frenchSpacing)('puts a no-break space before ? ! : ; and inside « »', () => {
    const wrong = catalogLeaves(messages).filter(
      (leaf) =>
        !isLater(leaf.path, language) &&
        (/[^\u00A0][?!:;»]/.test(leaf.text) || /«[^\u00A0]/.test(leaf.text)),
    );
    expect(wrong.map((leaf) => `${leaf.path}: ${leaf.text}`)).toEqual([]);
  });
});
