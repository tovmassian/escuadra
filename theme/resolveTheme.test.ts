import { describe, expect, it } from 'vitest';
import { resolveThemeName } from './resolveTheme';

describe('resolveThemeName', () => {
  it('honours an explicit preference over the system scheme', () => {
    expect(resolveThemeName('dark', 'light')).toBe('dark');
    expect(resolveThemeName('light', 'dark')).toBe('light');
  });

  it('follows the system scheme when the preference is "system"', () => {
    expect(resolveThemeName('system', 'light')).toBe('light');
    expect(resolveThemeName('system', 'dark')).toBe('dark');
  });

  it('falls back to dark when the system scheme is unknown', () => {
    // useColorScheme() answers null or 'unspecified' when the device has no
    // preference to report. Dark is the app's original and only identity to
    // date, so it is the fallback for every such case.
    expect(resolveThemeName('system', null)).toBe('dark');
    expect(resolveThemeName('system', undefined)).toBe('dark');
    expect(resolveThemeName('system', 'unspecified')).toBe('dark');
  });
});
