import { describe, expect, it } from 'vitest';
import { shouldAskForReview, type ReviewPromptInput } from './reviewPrompt';

// A round that should ask: flawless, the store has a review flow, this app
// version has not asked yet, and the user had finished a round before.
const due: ReviewPromptInput = {
  flawless: true,
  hasAction: true,
  appVersion: '2.0.0',
  askedVersion: null,
  earlierRounds: true,
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
});
