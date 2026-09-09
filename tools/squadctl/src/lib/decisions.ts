// Decisions a person has taken that squadctl cannot re-derive.
//
// `possible-rename` asks one question: is this a player renamed, or two
// different people? The first answer is `squadctl rename`, which changes the
// stored record and makes the conflict disappear on its own. The second has
// nothing to change — the split is already what the source says — so without
// a record of the answer the same question comes back every sweep. At 150
// teams that is the difference between a decision and a chore.
//
// Checked in, because it is repo knowledge rather than a local preference.
import type { AcceptedAlias, AcceptedSplit, TitleAlias } from './reconcile.ts';

export interface DecisionFile {
  /** Departure/arrival pairs confirmed to be two different people. */
  splits: AcceptedSplit[];
  /** Extra names one player is known by. Two articles can name the same
   *  person differently and both be right — Atlético writes "Alejandro
   *  Grimaldo", Spain writes "Álex Grimaldo". Renaming just moves the
   *  conflict to the other squad and splitting asserts something false, so
   *  the only truthful answer is that both names are his. */
  /** Optional because every reader already treats it so — `validateDecisions`
   *  accepts its absence, and `addAlias`, `apply` and `alias` all read it as
   *  `?? []`. Older decision files predate aliases and carry only splits. */
  aliases?: AcceptedAlias[];
  /** Extra article titles a player is known by. Optional for the same reason
   *  `aliases` is: every decision file on disk predates it. */
  titleAliases?: TitleAlias[];
}

export const EMPTY_DECISIONS: DecisionFile = { splits: [], aliases: [], titleAliases: [] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function validateDecisions(value: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) return ['decisions.json must be a JSON object'];
  if (!Array.isArray(value.splits)) return ['decisions.json must carry a "splits" array'];
  if (value.aliases !== undefined && !Array.isArray(value.aliases)) {
    return ['decisions.json "aliases" must be an array when present'];
  }
  for (const [index, entry] of (value.aliases ?? []).entries()) {
    if (!isRecord(entry)) {
      errors.push(`aliases[${index}] must be an object`);
      continue;
    }
    for (const field of ['player', 'name'] as const) {
      if (typeof entry[field] !== 'string' || entry[field] === '') {
        errors.push(`aliases[${index}].${field} must be a non-empty string`);
      }
    }
  }
  if (value.titleAliases !== undefined && !Array.isArray(value.titleAliases)) {
    return ['decisions.json "titleAliases" must be an array when present'];
  }
  for (const [index, entry] of (value.titleAliases ?? []).entries()) {
    if (!isRecord(entry)) {
      errors.push(`titleAliases[${index}] must be an object`);
      continue;
    }
    for (const field of ['player', 'title'] as const) {
      if (typeof entry[field] !== 'string' || entry[field] === '') {
        errors.push(`titleAliases[${index}].${field} must be a non-empty string`);
      }
    }
  }
  value.splits.forEach((entry, index) => {
    if (!isRecord(entry)) {
      errors.push(`splits[${index}] must be an object`);
      return;
    }
    for (const field of ['team', 'departed', 'arrived'] as const) {
      if (typeof entry[field] !== 'string' || entry[field] === '') {
        errors.push(`splits[${index}].${field} must be a non-empty string`);
      }
    }
  });
  return errors;
}

function sameSplit(a: AcceptedSplit, b: AcceptedSplit): boolean {
  return a.team === b.team && a.departed === b.departed && a.arrived === b.arrived;
}

/** Idempotent: recording the same decision twice is a no-op, so re-running the
 *  command after a failed apply cannot pile up entries. Returns null when the
 *  decision was already present. */
export function addSplit(file: DecisionFile, split: AcceptedSplit): DecisionFile | null {
  if (file.splits.some((existing) => sameSplit(existing, split))) return null;
  return {
    ...file,
    splits: [...file.splits, split].sort(
      (a, b) =>
        a.team.localeCompare(b.team) ||
        a.departed.localeCompare(b.departed) ||
        a.arrived.localeCompare(b.arrived),
    ),
  };
}

/** Idempotent, like `addSplit`. Returns null when already recorded. */
export function addAlias(file: DecisionFile, alias: AcceptedAlias): DecisionFile | null {
  const existing = file.aliases ?? [];
  if (existing.some((a) => a.player === alias.player && a.name === alias.name)) return null;
  return {
    ...file,
    aliases: [...existing, alias].sort(
      (a, b) => a.player.localeCompare(b.player) || a.name.localeCompare(b.name),
    ),
  };
}

/** Idempotent, like `addAlias`. Returns null when already recorded. */
export function addTitleAlias(file: DecisionFile, alias: TitleAlias): DecisionFile | null {
  const existing = file.titleAliases ?? [];
  if (existing.some((t) => t.player === alias.player && t.title === alias.title)) return null;
  return {
    ...file,
    titleAliases: [...existing, alias].sort(
      (a, b) => a.player.localeCompare(b.player) || a.title.localeCompare(b.title),
    ),
  };
}
