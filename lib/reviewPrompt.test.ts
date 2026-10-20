import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { shouldAskForReview, type ReviewPromptInput } from './reviewPrompt';

// A round that should ask: flawless, the store has a review flow, this app
// version has not asked yet, the user had finished a round before, and the
// app is in the foreground.
const due: ReviewPromptInput = {
  flawless: true,
  hasAction: true,
  appVersion: '2.0.0',
  askedVersion: null,
  earlierRounds: true,
  appActive: true,
};

describe('shouldAskForReview', () => {
  it('asks after an a la escuadra round that meets every condition', () => {
    expect(shouldAskForReview(due)).toBe(true);
  });

  it('asks again once the app version has changed', () => {
    expect(shouldAskForReview({ ...due, askedVersion: '1.9.0' })).toBe(true);
  });

  it('never asks after a round that was not flawless', () => {
    expect(shouldAskForReview({ ...due, flawless: false })).toBe(false);
  });

  it('never asks when the store offers no review flow', () => {
    expect(shouldAskForReview({ ...due, hasAction: false })).toBe(false);
  });

  it('never asks without a known app version', () => {
    // An earlier version asked, so only the missing version stops it.
    expect(shouldAskForReview({ ...due, appVersion: null, askedVersion: '1.9.0' })).toBe(false);
  });

  it('never asks without a known app version, even when none has asked', () => {
    // null === null must not read as "this version has not asked" either way.
    expect(shouldAskForReview({ ...due, appVersion: null, askedVersion: null })).toBe(false);
  });

  it('asks at most once per app version', () => {
    expect(shouldAskForReview({ ...due, askedVersion: '2.0.0' })).toBe(false);
  });

  it('never asks on the first round ever', () => {
    expect(shouldAskForReview({ ...due, earlierRounds: false })).toBe(false);
  });

  it('never asks while the app is not in the foreground', () => {
    // A backgrounded app has no window for the dialog, and must not use up
    // this version's one ask on it.
    expect(shouldAskForReview({ ...due, appActive: false })).toBe(false);
  });
});

// lib/storeReview.ts is the only module that imports expo-store-review, so
// every request goes through `shouldAskForReview` and its throttle.
describe('expo-store-review importers', () => {
  const ROOT = path.join(import.meta.dirname, '..');
  const SKIPPED_DIRS = new Set(['node_modules', 'dist', '__tests__']);
  // Any import form: `from 'expo-store-review'`, a bare side-effect import,
  // `require(...)`, a dynamic `import(...)`, or a deep path.
  const EXPO_STORE_REVIEW = /['"]expo-store-review(\/[^'"]*)?['"]/;

  function sources(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) {
        return name.startsWith('.') || SKIPPED_DIRS.has(name) ? [] : sources(full);
      }
      // lib/licences.generated.ts names every bundled package as data; it imports none.
      return /\.(ts|tsx)$/.test(name) && !/\.(test|generated)\.tsx?$/.test(name) ? [full] : [];
    });
  }

  it('is lib/storeReview.ts alone', () => {
    const importers = sources(ROOT)
      .filter((file) => EXPO_STORE_REVIEW.test(readFileSync(file, 'utf8')))
      .map((file) => path.relative(ROOT, file));
    expect(importers).toEqual(['lib/storeReview.ts']);
  });
});
