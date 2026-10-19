// Seeds one language's country names for i18n/countries.ts (#145): CLDR's
// names through Node's Intl.DisplayNames, with the hand-written ones laid
// over them. Run it once per language and paste the output into
// COUNTRY_NAMES. From then on the committed table is the truth, and a
// reviewer's change goes there. The app never calls Intl for names (#141):
// Hermes may not carry the data.
//
//   node scripts/seed-country-names.ts de
import type { FlagCode } from '../assets/flags/generated.ts';
import type { Language } from '../i18n/resolveLanguage.ts';

/** FIFA members that are not ISO countries, so CLDR has no name for them. */
const HOME_NATIONS = ['ENG', 'SCO', 'WAL', 'NIR'] as const;
type HomeNation = (typeof HOME_NATIONS)[number];
type SeedLanguage = Exclude<Language, 'en'>;

/** FIFA code → ISO 3166-1 alpha-2 region, the key CLDR names countries by. Kosovo is CLDR's XK. */
const ISO_REGION: Record<Exclude<FlagCode, HomeNation>, string> = {
  ALB: 'AL',
  ALG: 'DZ',
  ANG: 'AO',
  ARG: 'AR',
  ARM: 'AM',
  AUS: 'AU',
  AUT: 'AT',
  BDI: 'BI',
  BEL: 'BE',
  BEN: 'BJ',
  BFA: 'BF',
  BIH: 'BA',
  BRA: 'BR',
  BUL: 'BG',
  CAN: 'CA',
  CGO: 'CG',
  CHI: 'CL',
  CHN: 'CN',
  CIV: 'CI',
  CMR: 'CM',
  COD: 'CD',
  COL: 'CO',
  COM: 'KM',
  CPV: 'CV',
  CRC: 'CR',
  CRO: 'HR',
  CTA: 'CF',
  CYP: 'CY',
  CZE: 'CZ',
  DEN: 'DK',
  DOM: 'DO',
  ECU: 'EC',
  EGY: 'EG',
  EQG: 'GQ',
  ESP: 'ES',
  EST: 'EE',
  FIN: 'FI',
  FRA: 'FR',
  FRO: 'FO',
  GAB: 'GA',
  GAM: 'GM',
  GEO: 'GE',
  GER: 'DE',
  GHA: 'GH',
  GLP: 'GP',
  GNB: 'GW',
  GRE: 'GR',
  GUI: 'GN',
  HAI: 'HT',
  HUN: 'HU',
  IDN: 'ID',
  IRL: 'IE',
  IRN: 'IR',
  ISL: 'IS',
  ISR: 'IL',
  ITA: 'IT',
  JAM: 'JM',
  JOR: 'JO',
  JPN: 'JP',
  KAZ: 'KZ',
  KEN: 'KE',
  KOR: 'KR',
  KOS: 'XK',
  KSA: 'SA',
  LTU: 'LT',
  LUX: 'LU',
  MAR: 'MA',
  MEX: 'MX',
  MKD: 'MK',
  MLI: 'ML',
  MNE: 'ME',
  MOZ: 'MZ',
  MTN: 'MR',
  NED: 'NL',
  NGA: 'NG',
  NIG: 'NE',
  NOR: 'NO',
  NZL: 'NZ',
  PAN: 'PA',
  PAR: 'PY',
  PER: 'PE',
  POL: 'PL',
  POR: 'PT',
  ROU: 'RO',
  RUS: 'RU',
  SEN: 'SN',
  SLE: 'SL',
  SRB: 'RS',
  SUI: 'CH',
  SUR: 'SR',
  SVK: 'SK',
  SVN: 'SI',
  SWE: 'SE',
  TAN: 'TZ',
  TOG: 'TG',
  TUN: 'TN',
  TUR: 'TR',
  UKR: 'UA',
  URU: 'UY',
  USA: 'US',
  UZB: 'UZ',
  VEN: 'VE',
  ZAM: 'ZM',
  ZIM: 'ZW',
};

/**
 * Names CLDR cannot give, or gives in a form football does not use: the four
 * home nations, and the FIFA-style names fans read ("RD Congo", not
 * "Congo-Kinshasa"). Drafts for the native reviewer, who has the last word.
 */
const HAND_WRITTEN: Record<
  SeedLanguage,
  Record<HomeNation, string> & Partial<Record<FlagCode, string>>
> = {
  es: {
    ENG: 'Inglaterra',
    SCO: 'Escocia',
    WAL: 'Gales',
    NIR: 'Irlanda del Norte',
    CIV: 'Costa de Marfil',
    COD: 'RD Congo',
    MLI: 'Malí',
  },
  fr: {
    ENG: 'Angleterre',
    SCO: 'Écosse',
    WAL: 'Pays de Galles',
    NIR: 'Irlande du Nord',
    CGO: 'Congo',
    COD: 'RD Congo',
  },
  it: {
    ENG: 'Inghilterra',
    SCO: 'Scozia',
    WAL: 'Galles',
    NIR: 'Irlanda del Nord',
    CGO: 'Congo',
    COD: 'RD Congo',
    CZE: 'Repubblica Ceca',
    FRO: 'Isole Far Oer',
  },
  de: {
    ENG: 'England',
    SCO: 'Schottland',
    WAL: 'Wales',
    NIR: 'Nordirland',
    CGO: 'Kongo',
    COD: 'DR Kongo',
    CIV: 'Elfenbeinküste',
    CPV: 'Kap Verde',
    USA: 'USA',
  },
};

const language = process.argv[2];
if (language !== 'es' && language !== 'fr' && language !== 'it' && language !== 'de') {
  throw new Error('usage: node scripts/seed-country-names.ts <es|fr|it|de>');
}

const regions = new Intl.DisplayNames([language], { type: 'region', fallback: 'none' });
const hand: Partial<Record<FlagCode, string>> = HAND_WRITTEN[language];
const isoRegion: Partial<Record<FlagCode, string>> = ISO_REGION;
// Object.keys widens to string. ISO_REGION's Record type makes its keys exactly the non-home FlagCodes, so the cast only narrows to that set.
const isoCodes = Object.keys(ISO_REGION) as (keyof typeof ISO_REGION)[];
const codes = [...isoCodes, ...HOME_NATIONS].sort();

const lines = codes.map((code) => {
  const iso = isoRegion[code];
  const name = hand[code] ?? (iso === undefined ? undefined : regions.of(iso));
  if (name === undefined) throw new Error(`${code}: no CLDR name and no hand-written one`);
  return `    ${code}: '${name.replaceAll("'", "\\'")}',`;
});

process.stdout.write(`  ${language}: {\n${lines.join('\n')}\n  },\n`);
