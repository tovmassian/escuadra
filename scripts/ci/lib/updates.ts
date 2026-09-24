// EAS Update history, as `eas update:list --json` and `update:view --json` report it,
// and the two choices made from it: what a rollback returns to, and whether a commit
// is already the newest production update. Pure.
import type { Platform } from './release.ts';

/** One group in `eas update:list --json` → `currentPage`, newest first. */
export interface UpdateGroupSummary {
  group: string;
  runtimeVersion: string;
  platforms: string;
  isRollBackToEmbedded: boolean;
  message: string;
}

/** One update in `eas update --json`, `update:view --json` or `update:roll-back-to-embedded --json`. */
export interface UpdateInfo {
  id: string;
  group: string;
  platform: string;
  runtimeVersion: string;
  gitCommitHash?: string | null;
  isRollBackToEmbedded: boolean;
  message?: string | null;
  createdAt?: string;
}

export type RollbackMode = 'previous' | 'group' | 'embedded';

export type RollbackTarget =
  | { kind: 'republish'; from: UpdateGroupSummary; to: UpdateGroupSummary }
  | { kind: 'embedded'; from: UpdateGroupSummary | null }
  | { kind: 'error'; message: string };

/** `update:list` shows `"message" (2 days ago by someone)`; keep the message. */
export function cleanMessage(message: string): string {
  const match = /^"(.*)" \([^()]*\)$/s.exec(message);
  return match?.[1] ?? message;
}

/**
 * What a rollback returns to. `groups` is `update:list` for one channel, newest first;
 * only this platform and runtime count. Refuses rather than guesses.
 */
export function rollbackTarget(
  groups: UpdateGroupSummary[],
  platform: Platform,
  runtime: string,
  mode: RollbackMode,
  groupId: string | null,
): RollbackTarget {
  const history = groups.filter(
    (group) =>
      group.runtimeVersion === runtime &&
      group.platforms
        .split(',')
        .map((name) => name.trim())
        .includes(platform),
  );
  const [newest, previous] = history;
  if (mode === 'embedded') return { kind: 'embedded', from: newest ?? null };
  if (!newest) {
    return {
      kind: 'error',
      message: `No ${platform} update on runtime ${runtime.slice(0, 8)}: nothing to roll back.`,
    };
  }
  if (mode === 'previous') {
    if (!previous)
      return { kind: 'error', message: 'No earlier update to return to. Use mode: embedded.' };
    return { kind: 'republish', from: newest, to: previous };
  }
  const chosen = history.find((group) => group.group === groupId);
  if (!chosen) {
    return {
      kind: 'error',
      message: `Group ${groupId ?? '(none)'} isn't a ${platform} update on runtime ${runtime.slice(0, 8)}.`,
    };
  }
  if (chosen === newest)
    return { kind: 'error', message: `Group ${chosen.group} is already the newest update.` };
  return { kind: 'republish', from: newest, to: chosen };
}

/** Whether the newest update group for a platform already came from `sha`. */
export function alreadyPublished(updates: UpdateInfo[], platform: Platform, sha: string): boolean {
  return updates.some(
    (update) =>
      update.platform === platform && update.gitCommitHash === sha && !update.isRollBackToEmbedded,
  );
}
