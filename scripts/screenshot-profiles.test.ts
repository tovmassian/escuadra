import { describe, expect, it } from 'vitest';
import { PROFILES, resolveProfile } from './screenshot-profiles';

describe('resolveProfile', () => {
  it('defaults to the design profile with no flag', () => {
    expect(resolveProfile([])).toBe(PROFILES.design);
  });

  it('resolves --profile=store to the store profile', () => {
    expect(resolveProfile(['--profile=store'])).toBe(PROFILES.store);
  });

  it('resolves --profile=design explicitly', () => {
    expect(resolveProfile(['--profile=design'])).toBe(PROFILES.design);
  });

  it('throws on an unknown profile name, naming the known ones', () => {
    expect(() => resolveProfile(['--profile=ipad'])).toThrow(/unknown --profile "ipad"/);
    expect(() => resolveProfile(['--profile=ipad'])).toThrow(/design, store/);
  });

  it('ignores unrelated argv entries', () => {
    expect(resolveProfile(['--headless', '--profile=store', '--foo=bar'])).toBe(PROFILES.store);
  });
});

describe('PROFILES', () => {
  it('design profile has no dimension constraint — it is a handoff aid, not a store asset', () => {
    expect(PROFILES.design.expectedDimensions).toBeNull();
  });

  it('store profile targets exactly Apple 6.9" class dimensions', () => {
    expect(PROFILES.store.viewport).toEqual({ width: 440, height: 956 });
    expect(PROFILES.store.deviceScaleFactor).toBe(3);
    expect(PROFILES.store.expectedDimensions).toEqual({ width: 1320, height: 2868 });
    expect(PROFILES.store.outDir).toBe('design/store');
  });

  it('design profile keeps its current viewport and output directory', () => {
    expect(PROFILES.design.viewport).toEqual({ width: 390, height: 844 });
    expect(PROFILES.design.deviceScaleFactor).toBe(2);
    expect(PROFILES.design.outDir).toBe('design/screens');
  });
});
