/** Age in whole years as of `at` (defaults to now). Pure date math, no I/O —
 *  shared by `lib/squads.ts` and `lib/questionEngine.ts`, which must stay
 *  free of each other's concerns (the engine takes data as input, it never
 *  imports the JSON accessor layer). */
export function getAge(birthISO: string, at: Date = new Date()): number {
  const birth = new Date(birthISO);
  let age = at.getFullYear() - birth.getFullYear();
  const monthDiff = at.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && at.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}
