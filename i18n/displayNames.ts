// How a team or a country is named on screen (#144). Pure, like
// ./resolveLanguage.ts. The data keeps the English string ("Spain",
// "Ivory Coast"); this turns it into the language's name through the FIFA code
// lib/flags.ts already maps it to. Club names are proper nouns and pass
// through untouched.
import type { FlagCode } from '@/assets/flags/generated';
import { flagFor } from '@/lib/flags';
import type { Squad } from '@/types/squad';
import { COUNTRY_NAMES } from './countries';
import type { SupportedLanguage } from './resolveLanguage';

/** A country's name by FIFA code. */
export function countryName(code: FlagCode, language: SupportedLanguage): string {
  return COUNTRY_NAMES[language][code];
}

/** A player's nationality (the data's English string) in a language. A name
 *  the flag table does not know is shown as it is: a screen must never fail
 *  on one. */
export function nationalityName(nationality: string, language: SupportedLanguage): string {
  const code = flagFor(nationality);
  return code === null ? nationality : countryName(code, language);
}

/** The one way any screen shows a team name: a nation by its country name, a
 *  club as `squad.name`. A nation squad's `name` is its nationality string. */
export function squadDisplayName(
  squad: Pick<Squad, 'kind' | 'name'>,
  language: SupportedLanguage,
): string {
  return squad.kind === 'nation' ? nationalityName(squad.name, language) : squad.name;
}
