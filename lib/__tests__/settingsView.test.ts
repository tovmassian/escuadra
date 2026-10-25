import { describe, expect, it } from 'vitest';
import { en } from '@/i18n/en';
import { updateTag, versionLabel, type UpdateState } from '../settingsView';

function updateState(overrides: Partial<UpdateState> = {}): UpdateState {
  return {
    isEnabled: true,
    isEmbeddedLaunch: false,
    updateId: null,
    channel: 'production',
    manifest: {},
    ...overrides,
  };
}

describe('versionLabel', () => {
  it('shows the update group for an update on the production channel', () => {
    const update = updateState({
      manifest: { metadata: { updateGroup: 'e43368a2-1111-2222-3333-444455556666' } },
    });
    expect(versionLabel('1.0.0', update, en)).toBe('Version 1.0.0 (e43368a2)');
  });

  it('names the channel for an update from a non-production channel', () => {
    const update = updateState({
      channel: 'preview',
      manifest: { metadata: { updateGroup: 'e43368a2-1111-2222-3333-444455556666' } },
    });
    expect(versionLabel('1.0.0', update, en)).toBe('Version 1.0.0 (e43368a2 · preview)');
  });

  it('shows built-in for the embedded launch, ignoring any update id it carries', () => {
    // The embedded bundle has an update ID too, but it matches nothing on EAS,
    // so isEmbeddedLaunch wins outright over the id lookup below.
    const update = updateState({
      isEmbeddedLaunch: true,
      updateId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      manifest: { metadata: { updateGroup: 'ffffffff-1111-2222-3333-444455556666' } },
    });
    expect(versionLabel('1.0.0', update, en)).toBe('Version 1.0.0 (built-in)');
  });

  it('drops the parentheses when updates are disabled, e.g. running from Metro', () => {
    const update = updateState({ isEnabled: false });
    expect(versionLabel('1.0.0', update, en)).toBe('Version 1.0.0');
  });

  it('drops the parentheses on web, where there is no id to show', () => {
    // expo-updates on web reports isEnabled: true, isEmbeddedLaunch: false, an
    // empty channel, and no manifest metadata or update id.
    const update = updateState({ channel: '', updateId: null, manifest: {} });
    expect(versionLabel('1.0.0', update, en)).toBe('Version 1.0.0');
  });

  it('falls back to Updates.updateId when the manifest carries no metadata', () => {
    const update = updateState({
      updateId: 'bbbbbbbb-1111-2222-3333-444455556666',
      manifest: {},
    });
    expect(versionLabel('1.0.0', update, en)).toBe('Version 1.0.0 (bbbbbbbb)');
  });

  it('falls back to Updates.updateId when the metadata has no updateGroup field', () => {
    const update = updateState({
      updateId: 'bbbbbbbb-1111-2222-3333-444455556666',
      manifest: { metadata: {} },
    });
    expect(versionLabel('1.0.0', update, en)).toBe('Version 1.0.0 (bbbbbbbb)');
  });

  it('cuts the id to 8 characters, matching the pipeline comment format', () => {
    const update = updateState({
      manifest: { metadata: { updateGroup: '0123456789abcdef' } },
    });
    expect(versionLabel('1.0.0', update, en)).toBe('Version 1.0.0 (01234567)');
  });
});

// The same update, as usage statistics name it (#221): what Settings shows, without
// the label or the channel.
describe('updateTag', () => {
  it('is the update group, cut to 8 characters', () => {
    const update = updateState({
      manifest: { metadata: { updateGroup: 'e43368a2-1111-2222-3333-444455556666' } },
    });
    expect(updateTag(update)).toBe('e43368a2');
  });

  it('falls back to the update id', () => {
    expect(updateTag(updateState({ updateId: 'abcdef12-0000' }))).toBe('abcdef12');
  });

  it('is embedded for the build’s own bundle', () => {
    expect(updateTag(updateState({ isEmbeddedLaunch: true, updateId: 'abcdef12-0000' }))).toBe(
      'embedded',
    );
  });

  it('is null when updates are off, or nothing names the update', () => {
    expect(updateTag(updateState({ isEnabled: false, updateId: 'abcdef12' }))).toBeNull();
    expect(updateTag(updateState())).toBeNull();
  });
});
