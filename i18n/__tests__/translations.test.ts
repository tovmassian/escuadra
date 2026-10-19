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

interface Facts {
  /** `formats.date` for 21 August 2026. */
  date: string;
  /** `study.players` for 0, 1 and 2. French treats 0 as singular. */
  players: readonly [string, string, string];
  positionCodes: Readonly<Record<Position, string>>;
  /** The hand-written names (the four home nations, FIFA-style ones) and the language's own country. */
  countries: Readonly<Partial<Record<FlagCode, string>>>;
  /** A phone set to this tag resolves to the language on first launch. */
  phoneTag: string;
  /** A no-break space before ? ! : ; and inside « ». */
  frenchSpacing: boolean;
}

const FACTS: Record<Language, Facts> = {
  en: {
    date: '21 Aug 2026',
    players: ['0 players', '1 player', '2 players'],
    positionCodes: { GK: 'GK', DF: 'DF', MF: 'MF', FW: 'FW' },
    countries: { ENG: 'England', ESP: 'Spain' },
    phoneTag: 'en-GB',
    frenchSpacing: false,
  },
  de: {
    date: '21. Aug. 2026',
    players: ['0 Spieler', '1 Spieler', '2 Spieler'],
    positionCodes: { GK: 'TW', DF: 'AB', MF: 'MF', FW: 'ST' },
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
    },
    phoneTag: 'de-AT',
    frenchSpacing: false,
  },
  fr: {
    date: '21 août 2026',
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
    },
    phoneTag: 'fr-CA',
    frenchSpacing: true,
  },
  es: {
    date: '21 ago 2026',
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
    },
    phoneTag: 'es-MX',
    frenchSpacing: false,
  },
  it: {
    date: '21 ago 2026',
    players: ['0 giocatori', '1 giocatore', '2 giocatori'],
    positionCodes: { GK: 'POR', DF: 'DIF', MF: 'CEN', FW: 'ATT' },
    countries: {
      ITA: 'Italia',
      ENG: 'Inghilterra',
      SCO: 'Scozia',
      WAL: 'Galles',
      NIR: 'Irlanda del Nord',
      COD: 'RD del Congo',
      CGO: 'Congo',
      CZE: 'Repubblica Ceca',
    },
    phoneTag: 'it-CH',
    frenchSpacing: false,
  },
};

describe.each(SUPPORTED_LANGUAGES)('%s', (language) => {
  const facts = FACTS[language];
  const messages = CATALOGS[language];

  it('writes the date its own way', () => {
    expect(messages.formats.date({ day: 21, month: 8, year: 2026 })).toBe(facts.date);
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

  it('is what a phone set to it opens in, on first launch', () => {
    expect(resolveLanguage('system', [facts.phoneTag, 'en-US'], SUPPORTED_LANGUAGES)).toBe(
      language,
    );
  });

  it.runIf(facts.frenchSpacing)('puts a no-break space before ? ! : ; and inside « »', () => {
    const wrong = catalogLeaves(messages).filter(
      (leaf) =>
        !isLater(leaf.path) && (/[^\u00A0][?!:;»]/.test(leaf.text) || /«[^\u00A0]/.test(leaf.text)),
    );
    expect(wrong.map((leaf) => `${leaf.path}: ${leaf.text}`)).toEqual([]);
  });
});
