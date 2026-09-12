import assert from 'node:assert/strict';
import test from 'node:test';
import {
  THEME_STORAGE_KEY,
  isTheme,
  nextTheme,
  resolveTheme,
} from '../theme.mjs';

test('uses a valid saved preference ahead of the system setting', () => {
  assert.equal(resolveTheme('light', true), 'light');
  assert.equal(resolveTheme('dark', false), 'dark');
});

test('uses the system setting when no valid preference is stored', () => {
  assert.equal(resolveTheme(null, true), 'dark');
  assert.equal(resolveTheme(undefined, false), 'light');
  assert.equal(resolveTheme('sepia', true), 'dark');
});

test('exposes the supported theme vocabulary and toggle direction', () => {
  assert.equal(THEME_STORAGE_KEY, 'escuadra-site-theme');
  assert.equal(isTheme('light'), true);
  assert.equal(isTheme('dark'), true);
  assert.equal(isTheme('system'), false);
  assert.equal(nextTheme('light'), 'dark');
  assert.equal(nextTheme('dark'), 'light');
});

test('never returns an unsupported theme', () => {
  for (const stored of [null, undefined, '', 'light', 'dark', 'auto', 'sepia']) {
    assert.equal(isTheme(resolveTheme(stored, false)), true);
    assert.equal(isTheme(resolveTheme(stored, true)), true);
  }
});
