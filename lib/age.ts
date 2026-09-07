/** Age in whole years as of `at` (defaults to now). Pure date math, no I/O —
 *  shared by `lib/squads.ts` and `lib/questionEngine.ts`, which must stay
 *  free of each other's concerns (the engine takes data as input, it never
 *  imports the JSON accessor layer).
 *
 *  Returns null for a player with no stored birth date, so the absence
 *  propagates as a value callers must handle rather than surfacing as a NaN
 *  in the UI. `Player.birth` is nullable because club-squad wikitext never
 *  carries a birth date. */
export function getAge(birthISO: string | null, at: Date = new Date()): number | null {
  if (birthISO === null) return null;
  const birth = new Date(birthISO);
  let age = at.getFullYear() - birth.getFullYear();
  const monthDiff = at.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && at.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}
