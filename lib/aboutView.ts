// Pure model for the About screen's version line. Kept out of the screen so
// the update/embedded/disabled branching is unit-testable without a device,
// like the other lib/*View.ts modules.

import type { Manifest } from 'expo-updates';

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
 * The About screen's version line: see
 * docs/superpowers/specs/2026-09-24-about-update-line-design.md for the
 * table of cases this implements.
 */
export function versionLabel(version: string, update: UpdateState): string {
  if (!update.isEnabled) {
    return `Version ${version}`;
  }

  if (update.isEmbeddedLaunch) {
    return `Version ${version} (built-in)`;
  }

  const id = updateGroupFromManifest(update.manifest) ?? update.updateId;
  if (!id) {
    return `Version ${version}`;
  }

  const shortId = id.slice(0, GROUP_ID_LENGTH);
  const channelSuffix =
    update.channel && update.channel !== PRODUCTION_CHANNEL ? ` · ${update.channel}` : '';

  return `Version ${version} (${shortId}${channelSuffix})`;
}
