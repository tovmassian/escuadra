import { describe, expect, it } from 'vitest';
import * as designBrand from './brand';
import * as designTokens from './tokens';
import * as themeBrand from '@/theme/brand';
import * as themeTokens from '@/theme/tokens';

// The handoff folder must re-export, never copy. A copy drifts from the app
// the moment either side changes, which is the precise failure the design
// loop exists to prevent — so identity is asserted, not just equality. Every
// token and brand export, without exception or hand-listing, is verified as
// an identical object; a missing or added export fails by key.
describe('design handoff surface', () => {
  it('re-exports the very same token objects', () => {
    const themeTokensKeys = Object.keys(themeTokens);
    const designTokensKeys = Object.keys(designTokens);

    // Assert both modules expose the same set of keys (no drift by omission or
    // hand-copying a value instead of re-exporting).
    expect(new Set(designTokensKeys)).toEqual(new Set(themeTokensKeys));

    // Iterate over each token and assert identity. Per-key assertions ensure
    // a failure names the offending export, not just "objects differ".
    themeTokensKeys.forEach((key) => {
      const designValue = (designTokens as Record<string, unknown>)[key];
      const themeValue = (themeTokens as Record<string, unknown>)[key];
      expect(designValue, `token export '${key}' is not identical`).toBe(themeValue);
    });
  });

  it('re-exports the very same brand exports', () => {
    const themeBrandKeys = Object.keys(themeBrand);
    const designBrandKeys = Object.keys(designBrand);

    // Assert both modules expose the same set of keys (no drift by omission or
    // hand-copying a value instead of re-exporting).
    expect(new Set(designBrandKeys)).toEqual(new Set(themeBrandKeys));

    // Iterate over each export and assert identity. Per-key assertions ensure
    // a failure names the offending export, not just "objects differ".
    themeBrandKeys.forEach((key) => {
      const designValue = (designBrand as Record<string, unknown>)[key];
      const themeValue = (themeBrand as Record<string, unknown>)[key];
      expect(designValue, `brand export '${key}' is not identical`).toBe(themeValue);
    });
  });
});
