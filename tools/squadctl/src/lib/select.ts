// Lifted from Fetch's private `select()`. A pure function cannot call
// `this.error()` on an unknown --only id the way the command could, so the
// unknown ids are handed back to the caller instead; fetch.ts raises exactly
// the error the inline version used to.
import type { TeamRegistry } from './registry.ts';

export function selectTeams(
  registry: TeamRegistry,
  flags: { only?: string | undefined; league?: string | undefined; kind?: string | undefined },
): { selected: TeamRegistry; missing: string[] } {
  let selected = registry;
  let missing: string[] = [];
  if (flags.only !== undefined) {
    const wanted = new Set(
      flags.only
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id !== ''),
    );
    const known = new Set(registry.map((e) => e.id));
    missing = [...wanted].filter((id) => !known.has(id));
    selected = selected.filter((e) => wanted.has(e.id));
  }
  if (flags.league !== undefined) selected = selected.filter((e) => e.league === flags.league);
  if (flags.kind !== undefined) selected = selected.filter((e) => e.kind === flags.kind);
  return { selected, missing };
}
