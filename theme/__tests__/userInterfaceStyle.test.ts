// theme/__tests__/userInterfaceStyle.test.ts
// Pinning userInterfaceStyle to "dark" or "light" locks the app to that theme and makes
// useColorScheme() return it on every device, so the system-following default never
// fires, with no error to trace it by (.claude/rules/design-tokens.md).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('app.json', () => {
  it('lets the device choose the theme', () => {
    const app = JSON.parse(readFileSync(new URL('../../app.json', import.meta.url), 'utf8')) as {
      expo: { userInterfaceStyle?: string };
    };
    expect(app.expo.userInterfaceStyle).toBe('automatic');
  });
});
