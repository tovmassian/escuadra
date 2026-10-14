// The inverse of `apply`'s registry-to-squad-file write: reconstructs the
// registry entry each squad file on disk implies, and compares that against
// the checked-in `data/teams.json`. `registry init` uses `deriveRegistry` to
// bootstrap the file from scratch; `registry check` uses both to catch the
// registry and the squad files drifting apart — an edited colour or name in
// `data/teams.json` with no re-run of `apply`, or a squad file with no
// registry entry at all.
import { isDeepStrictEqual } from 'node:util';
import type { TeamRegistryEntry } from './registry.ts';
import { readSquad, squadFiles } from './squad-files.ts';

/** Walks every squad file under `squadsDir` and derives the registry entry
 *  each one implies. Order: `nation/*.json` first, then each `LEAGUES`
 *  folder under `club/` in that order; filenames sorted within each. Every
 *  field the registry needs — `id`, `kind`, `name`, `source`, `league` (from
 *  the folder), and `identity` — is already stored on the squad file, so
 *  this is reconstruction, not derivation in the "invented" sense. */
export function deriveRegistry(squadsDir: string): TeamRegistryEntry[] {
  return squadFiles(squadsDir).map((file) => {
    const squad = readSquad(file.path);
    return {
      id: squad.id,
      kind: file.kind,
      ...(file.kind === 'club' ? { league: file.league } : {}),
      name: squad.name,
      source: squad.source,
      identity: {
        primaryColor: squad.primaryColor,
        secondaryColor: squad.secondaryColor,
        marker: squad.marker,
      },
    };
  });
}

/** Renders `undefined` as a readable placeholder rather than the bare word
 *  `undefined` JSON.stringify would otherwise leave unquoted. */
function describe(value: unknown): string {
  return value === undefined ? '(absent)' : JSON.stringify(value);
}

function mismatch(id: string, field: string, derivedValue: unknown, storedValue: unknown): string {
  return `${id}.${field}: squad file has ${describe(derivedValue)}, data/teams.json has ${describe(storedValue)}`;
}

/** Human-readable disagreements between what the squad files imply
 *  (`derived`, from `deriveRegistry`) and the checked-in registry
 *  (`stored`) — empty when they agree. A **subset** check in one
 *  direction: a stored entry with no matching derived entry is a
 *  legitimate not-yet-fetched new team, not a problem. Only flags a squad
 *  file with no stored entry, or a stored entry whose fields disagree with
 *  what its squad file says. */
export function diffRegistry(derived: TeamRegistryEntry[], stored: TeamRegistryEntry[]): string[] {
  const problems: string[] = [];
  const byId = new Map(stored.map((entry) => [entry.id, entry]));

  for (const entry of derived) {
    const match = byId.get(entry.id);
    if (match === undefined) {
      problems.push(`${entry.id}: squad file exists but data/teams.json has no entry for it`);
      continue;
    }

    if (entry.name !== match.name)
      problems.push(mismatch(entry.id, 'name', entry.name, match.name));
    if (entry.kind !== match.kind)
      problems.push(mismatch(entry.id, 'kind', entry.kind, match.kind));
    if (entry.source !== match.source) {
      problems.push(mismatch(entry.id, 'source', entry.source, match.source));
    }
    if (entry.league !== match.league) {
      problems.push(mismatch(entry.id, 'league', entry.league, match.league));
    }
    if (entry.identity.primaryColor !== match.identity.primaryColor) {
      problems.push(
        mismatch(
          entry.id,
          'identity.primaryColor',
          entry.identity.primaryColor,
          match.identity.primaryColor,
        ),
      );
    }
    if (entry.identity.secondaryColor !== match.identity.secondaryColor) {
      problems.push(
        mismatch(
          entry.id,
          'identity.secondaryColor',
          entry.identity.secondaryColor,
          match.identity.secondaryColor,
        ),
      );
    }
    if (!isDeepStrictEqual(entry.identity.marker, match.identity.marker)) {
      problems.push(
        mismatch(entry.id, 'identity.marker', entry.identity.marker, match.identity.marker),
      );
    }
  }

  return problems;
}
