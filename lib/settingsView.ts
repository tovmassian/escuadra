// Pure model for the Settings screen's version line. Kept out of the screen so
// the update/embedded/disabled branching is unit-testable without a device,
// like the other lib/*View.ts modules.

import type { Manifest } from 'expo-updates';
import type { Messages } from '@/i18n/en';

export type UpdateState = {
  isEnabled: boolean;
  isEmbeddedLaunch: boolean;
  updateId: string | null;
  channel: string | null;
  manifest: Partial<Manifest>;
};

const GROUP_ID_LENGTH = 8;
const PRODUCTION_CHANNEL = 'production';

/**
 * EAS sets `metadata.updateGroup` on a published update's manifest, but
 * `expo-manifests` types `metadata` as a bare `object` — and an embedded
 * manifest has no `metadata` field at all — so this is read defensively
 * rather than assumed.
 */
function updateGroupFromManifest(manifest: Partial<Manifest>): string | null {
  const metadata = (manifest as { metadata?: unknown }).metadata;
  if (metadata === null || typeof metadata !== 'object') return null;
  const updateGroup = (metadata as { updateGroup?: unknown }).updateGroup;
  return typeof updateGroup === 'string' && updateGroup.length > 0 ? updateGroup : null;
}

/**
 * Settings' version line: see
 * docs/superpowers/specs/2026-09-24-about-update-line-design.md for the
 * table of cases this implements.
 */
export function versionLabel(version: string, update: UpdateState, messages: Messages): string {
  const label = messages.settings.version(version);
  const tag = updateTag(update);
  if (tag === null) return label;
  if (tag === EMBEDDED) return `${label} (${messages.settings.builtIn})`;

  const channelSuffix =
    update.channel && update.channel !== PRODUCTION_CHANNEL ? ` · ${update.channel}` : '';

  return `${label} (${tag}${channelSuffix})`;
}

const EMBEDDED = 'embedded';

/**
 * The running update as Settings names it, without the label or the channel:
 * the first 8 characters of its group id (or update id), `embedded` for the
 * build's own bundle, and null when updates are off or nothing names it. Usage
 * statistics carry it too (#221), so a signal can be matched to the update a
 * player sees in Settings.
 */
export function updateTag(update: UpdateState): string | null {
  if (!update.isEnabled) return null;
  if (update.isEmbeddedLaunch) return EMBEDDED;
  const id = updateGroupFromManifest(update.manifest ?? {}) ?? update.updateId;
  return id ? id.slice(0, GROUP_ID_LENGTH) : null;
}
