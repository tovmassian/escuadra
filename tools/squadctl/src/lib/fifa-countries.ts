// `nat=` code -> country name. Squad wikitext identifies a player's
// nationality by a FIFA trigram (`nat=ESP`), but `players.json` stores a full
// country name, so every club-squad parse goes through this table.
//
// Seeded with the complete 211-member FIFA set up front rather than derived
// from the nationalities already in the data. A data-derived table would stop
// onboarding dead on an unmapped code over and over: 23 clubs surface 65
// nationalities, but 100 big-5 clubs will surface roughly 110-130. With the
// full set seeded, an unmapped code is a genuine exception worth failing on.
//
// The four non-FIFA entries are the French overseas departments, which are
// not FIFA members but do appear as `nat=` in big-5 club squads because
// players born there are tagged with them. Guadeloupe is already in
// `players.json`.
//
// SPELLINGS ARE NOT FREE TO CHANGE. Where a country is already represented in
// `players.json`, this table must use that exact spelling — `Ivory Coast` not
// `Côte d'Ivoire`, `Czech Republic` not `Czechia`, `South Korea` not `Korea
// Republic`, `DR Congo` not `Congo DR`. A second spelling of one country
// forks the nationality string, leaving level-3 distractors comparing two
// names for the same place. `fifa-countries.test.ts` enforces this.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TABLE_PATH = path.resolve(HERE, '../../../../data/fifa-countries.json');

export const FIFA_COUNTRIES: Readonly<Record<string, string>> = Object.freeze(
  JSON.parse(readFileSync(TABLE_PATH, 'utf8')) as Record<string, string>,
);

/** The country name for a `nat=` code, or null when the code is unmapped.
 *  Callers treat null as a hard failure naming the code to add — never as a
 *  reason to pass the raw code through as a nationality. */
export function countryForCode(code: string): string | null {
  return FIFA_COUNTRIES[code.trim().toUpperCase()] ?? null;
}
