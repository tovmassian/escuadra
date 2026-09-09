// Nationality name -> FIFA three-letter flag code. Pure: no React, no I/O,
// and deliberately no import of assets/flags/generated.ts, whose require()s
// of PNGs only Metro can resolve.
//
// Hand-authored because it is knowledge, not derivable — "Republic of
// Ireland" is IRL, "Ivory Coast" is CIV, "Saudi Arabia" is KSA. The design
// chose this over a `flag` field on squad JSON: a field would need a data
// migration, gen-squads changes, and squadctl learning to emit it, while
// player nationalities would still need a table regardless. See
// docs/superpowers/specs/2026-09-09-png-flags-design.md.
//
// Drift is the risk this trades for, and lib/flags.test.ts is the guard: it
// fails `npm run check` if any nationality in players.json or any nation
// squad name is missing here.
import type { FlagCode } from '@/assets/flags/generated';

export const FLAG_BY_NATIONALITY: Record<string, FlagCode> = {
  Albania: 'ALB',
  Algeria: 'ALG',
  Angola: 'ANG',
  Argentina: 'ARG',
  Armenia: 'ARM',
  Australia: 'AUS',
  Austria: 'AUT',
  Belgium: 'BEL',
  Benin: 'BEN',
  'Bosnia and Herzegovina': 'BIH',
  Brazil: 'BRA',
  Bulgaria: 'BUL',
  'Burkina Faso': 'BFA',
  Burundi: 'BDI',
  Cameroon: 'CMR',
  Canada: 'CAN',
  'Cape Verde': 'CPV',
  'Central African Republic': 'CTA',
  Chile: 'CHI',
  'China PR': 'CHN',
  Colombia: 'COL',
  Comoros: 'COM',
  Congo: 'CGO',
  'Costa Rica': 'CRC',
  Croatia: 'CRO',
  'Czech Republic': 'CZE',
  'DR Congo': 'COD',
  Denmark: 'DEN',
  'Dominican Republic': 'DOM',
  Ecuador: 'ECU',
  Egypt: 'EGY',
  England: 'ENG',
  Estonia: 'EST',
  Finland: 'FIN',
  France: 'FRA',
  Gabon: 'GAB',
  Gambia: 'GAM',
  Georgia: 'GEO',
  Germany: 'GER',
  Ghana: 'GHA',
  Greece: 'GRE',
  Guadeloupe: 'GLP',
  Guinea: 'GUI',
  'Guinea-Bissau': 'GNB',
  Haiti: 'HAI',
  Hungary: 'HUN',
  Iceland: 'ISL',
  Indonesia: 'IDN',
  Israel: 'ISR',
  Italy: 'ITA',
  'Ivory Coast': 'CIV',
  Jamaica: 'JAM',
  Japan: 'JPN',
  Jordan: 'JOR',
  Kenya: 'KEN',
  Kosovo: 'KOS',
  Luxembourg: 'LUX',
  Mali: 'MLI',
  Mauritania: 'MTN',
  Mexico: 'MEX',
  Montenegro: 'MNE',
  Morocco: 'MAR',
  Netherlands: 'NED',
  Nigeria: 'NGA',
  'North Macedonia': 'MKD',
  'Northern Ireland': 'NIR',
  Norway: 'NOR',
  Paraguay: 'PAR',
  Peru: 'PER',
  Poland: 'POL',
  Portugal: 'POR',
  'Republic of Ireland': 'IRL',
  Romania: 'ROU',
  Russia: 'RUS',
  'Saudi Arabia': 'KSA',
  Scotland: 'SCO',
  Senegal: 'SEN',
  Serbia: 'SRB',
  'Sierra Leone': 'SLE',
  Slovakia: 'SVK',
  Slovenia: 'SVN',
  'South Korea': 'KOR',
  Spain: 'ESP',
  Suriname: 'SUR',
  Sweden: 'SWE',
  Switzerland: 'SUI',
  Tanzania: 'TAN',
  Togo: 'TOG',
  Tunisia: 'TUN',
  Türkiye: 'TUR',
  Ukraine: 'UKR',
  'United States': 'USA',
  Uruguay: 'URU',
  Venezuela: 'VEN',
  Wales: 'WAL',
  Zambia: 'ZAM',
};

/** The flag code for a nationality, or null when the name isn't mapped.
 *  Null rather than a throw: a call site renders text only, and an unknown
 *  nationality must never crash a round mid-question. */
export function flagFor(nationality: string): FlagCode | null {
  return FLAG_BY_NATIONALITY[nationality] ?? null;
}
