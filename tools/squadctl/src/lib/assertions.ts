// Pure: a plan -> what is wrong with it and what that means for `verified`.
//
// The point of going deterministic. These are guarantees a model processing 26
// rows in one pass cannot give, and `verified` is their output rather than a
// flag anyone sets by hand.
import { BLAST_RADIUS_THRESHOLD } from '../../../../scripts/roster-envelope.ts';
import type { TeamPlan } from './reconcile.ts';

export type Conflict =
  | { kind: 'ambiguous-name'; name: string; candidateIds: string[] }
  | {
      kind: 'possible-rename';
      /** Squad the pair was seen on — the `split` command needs it. */
      team: string;
      /** The id to hand to `squadctl rename`. Carried on the conflict so the
       *  report is directly actionable without looking anything up. */
      departedId: string;
      departedName: string;
      arrivedName: string;
      arrivedId: string;
    }
  | { kind: 'name-variant'; playerId: string; storedName: string; sourceName: string }
  | { kind: 'omitted-row'; name: string; reason: string }
  | { kind: 'unknown-template'; detail: string }
  | { kind: 'blast-radius'; ratio: number }
  | { kind: 'call-ups-only'; sectionTitle: string }
  | {
      kind: 'title-mismatch';
      playerId: string;
      storedTitle: string;
      sourceTitle: string;
      rowName: string;
    };

export interface AssertionResult {
  /** Team is not written at all. The run continues with the other teams. */
  failures: string[];
  /** Team IS written, `verified: false`, reason named in the report. */
  conflicts: Conflict[];
  /** Written, `verified` stays true. */
  warnings: string[];
  /** Counted only. */
  informational: string[];
  verified: boolean;
}

const CLUB_MIN_MEMBERS = 14;
const CLUB_LOW_MEMBERS = 18;
const NATION_MIN_MEMBERS = 20;
const NATION_MAX_MEMBERS = 30;

export function assess(plan: TeamPlan): AssertionResult {
  const failures: string[] = [];
  const conflicts: Conflict[] = [];
  const warnings: string[] = [];
  const informational: string[] = [];

  const count = plan.squad.members.length;
  const isClub = plan.squad.kind === 'club';

  // --- Hard failures: the team is not written.
  if (count === 0) {
    failures.push('zero members after reconciliation');
  } else if (isClub && count < CLUB_MIN_MEMBERS) {
    failures.push(`club squad has only ${count} members (minimum ${CLUB_MIN_MEMBERS})`);
  }
  if (plan.captainCount > 1) {
    failures.push(`${plan.captainCount} captains; a squad tracks at most one`);
  }
  if (plan.squad.primaryColor === '' || plan.squad.secondaryColor === '') {
    failures.push('no identity: a team is never given an invented colour');
  }

  // --- Conflicts: written, but verified: false.
  for (const item of plan.ambiguous) {
    conflicts.push({
      kind: 'ambiguous-name',
      name: item.name,
      candidateIds: item.candidateIds,
    });
  }
  for (const rename of plan.possibleRenames) {
    conflicts.push({
      kind: 'possible-rename',
      team: plan.teamId,
      departedId: rename.departedId,
      departedName: rename.departedName,
      arrivedName: rename.arrivedName,
      arrivedId: rename.arrivedId,
    });
  }
  for (const variant of plan.nameVariants) {
    conflicts.push({
      kind: 'name-variant',
      playerId: variant.playerId,
      storedName: variant.storedName,
      sourceName: variant.sourceName,
    });
  }
  // Two different real people, or one whose article moved. Neither is provable
  // from the data, and merging the wrong pair is unrecoverable.
  for (const mismatch of plan.titleMismatches) {
    conflicts.push({ kind: 'title-mismatch', ...mismatch });
  }
  // A row that could not be placed is a conflict in its own right: the squad
  // is short a player and no member-count guard would notice 26 -> 25.
  for (const row of plan.omitted) {
    conflicts.push({ kind: 'omitted-row', name: row.name, reason: row.reason });
  }
  for (const detail of plan.unknownTemplates) {
    conflicts.push({ kind: 'unknown-template', detail });
  }
  // Skipped for a team with no stored squad — every new team would trip at 100%.
  if (plan.blastRadius !== null && plan.blastRadius > BLAST_RADIUS_THRESHOLD) {
    conflicts.push({ kind: 'blast-radius', ratio: plan.blastRadius });
  }
  if (plan.callUpsOnly) {
    conflicts.push({ kind: 'call-ups-only', sectionTitle: 'Recent call-ups' });
  }

  // --- Warnings: written, verified stays true.
  if (plan.departed.length > 0) {
    warnings.push(
      `${plan.departed.length} departed: ${plan.departed.map((d) => d.name).join(', ')}`,
    );
  }
  if (plan.generatedIds.length > 0) {
    warnings.push(`${plan.generatedIds.length} new player id(s): ${plan.generatedIds.join(', ')}`);
  }
  // A modelled, unambiguous state rather than missing information: the source
  // is known to list that player without a number.
  if (plan.numberlessCount > 0) {
    warnings.push(`${plan.numberlessCount} member(s) with no shirt number`);
  }
  if (isClub && count < CLUB_LOW_MEMBERS) {
    warnings.push(`club squad has only ${count} members`);
  }
  if (!isClub && (count < NATION_MIN_MEMBERS || count > NATION_MAX_MEMBERS)) {
    warnings.push(
      `nation squad has ${count} members, outside ${NATION_MIN_MEMBERS}-${NATION_MAX_MEMBERS}`,
    );
  }

  // --- Informational.
  if (plan.noBirthCount > 0) {
    // Club wikitext structurally never carries a birth date, so this is
    // normal. Blocking on it would leave every club permanently unverified.
    informational.push(`${plan.noBirthCount} new player(s) with no birth date`);
  }

  return {
    failures,
    conflicts,
    warnings,
    informational,
    verified: failures.length === 0 && conflicts.length === 0,
  };
}

export function describeConflict(conflict: Conflict): string {
  switch (conflict.kind) {
    case 'ambiguous-name':
      return `ambiguous name — "${conflict.name}" matches ${conflict.candidateIds.length} stored players: ${conflict.candidateIds.join(', ')}`;
    case 'possible-rename':
      return `possible rename — stored "${conflict.departedName}" (${conflict.departedId}) left the squad, source lists "${conflict.arrivedName}"`;
    case 'name-variant':
      return `spelling disagreement on ${conflict.playerId} — stored "${conflict.storedName}", source "${conflict.sourceName}"`;
    case 'title-mismatch':
      return `identity conflict on ${conflict.playerId} — stored "${conflict.storedTitle}", source lists "${conflict.sourceTitle}"`;
    case 'omitted-row':
      return `"${conflict.name}" could not be placed and is missing from the squad — ${conflict.reason}`;
    case 'unknown-template':
      return `unrecognised player-ish template {{${conflict.detail}}} — the parser needs teaching, and the squad is a player short`;
    case 'blast-radius':
      return `roster changed ${Math.round(conflict.ratio * 100)}% against the stored squad`;
    case 'call-ups-only':
      return `section matched "${conflict.sectionTitle}" — a call-up list, not a contract roster`;
  }
}

/** The command that hands the decision back, exactly as it has to be typed.
 *  There is no global `squadctl` binary, so this is the `npm run` form — a
 *  hint you cannot paste is not a hint. Null when no single command resolves
 *  the conflict, because a person has to look first. */
export function conflictCommand(conflict: Conflict): string | null {
  switch (conflict.kind) {
    // Three genuine answers, so offer all three rather than implying one.
    // "Both names are his" is not expressible as either of the other two:
    // rename moves the conflict to whichever squad uses the old spelling.
    case 'possible-rename':
      return (
        `same person, adopt new name:  npm run squadctl -- rename ${conflict.departedId} ${JSON.stringify(conflict.arrivedName)}\n` +
        `                same person, both names:      npm run squadctl -- alias ${conflict.departedId} ${JSON.stringify(conflict.arrivedName)}\n` +
        `                two different people:         npm run squadctl -- split ${conflict.team} ${conflict.departedId} ${JSON.stringify(conflict.arrivedName)}`
      );
    case 'name-variant':
      return `npm run squadctl -- rename ${conflict.playerId} ${JSON.stringify(conflict.sourceName)}`;
    // The same three answers as possible-rename, one level up. "Both titles
    // are his" is no more expressible as either of the others than "both
    // names are his" was.
    case 'title-mismatch':
      return (
        `same person, article moved:  npm run squadctl -- retitle ${conflict.playerId} ${JSON.stringify(conflict.sourceTitle)}\n` +
        `                same person, both titles:    npm run squadctl -- alias ${conflict.playerId} --title ${JSON.stringify(conflict.sourceTitle)}\n` +
        `                two different people:        npm run squadctl -- fork ${conflict.playerId} ${JSON.stringify(conflict.sourceTitle)}`
      );
    case 'ambiguous-name':
    case 'omitted-row':
    case 'unknown-template':
    case 'blast-radius':
    case 'call-ups-only':
      return null;
  }
}
