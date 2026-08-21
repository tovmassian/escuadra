import { describe, expect, it } from 'vitest';
import * as designBrand from './brand';
import * as designTokens from './tokens';
import * as themeBrand from '@/theme/brand';
import * as themeTokens from '@/theme/tokens';

// The handoff folder must re-export, never copy. A copy drifts from the app
// the moment either side changes, which is the precise failure the design
// loop exists to prevent — so identity is asserted, not just equality.
describe('design handoff surface', () => {
  it('re-exports the very same token objects', () => {
    expect(designTokens.colors).toBe(themeTokens.colors);
    expect(designTokens.typography).toBe(themeTokens.typography);
    expect(designTokens.spacing).toBe(themeTokens.spacing);
    expect(designTokens.gradients).toBe(themeTokens.gradients);
  });

  it('re-exports the very same mark geometry', () => {
    expect(designBrand.markGeometry).toBe(themeBrand.markGeometry);
    expect(designBrand.MARK_VIEWBOX).toBe(themeBrand.MARK_VIEWBOX);
  });
});
