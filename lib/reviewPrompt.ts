// When to ask for a store rating (#57): right after an a la escuadra round, at
// most once per app version, never on the user's first round ever, and only
// while the app is in the foreground. Pure, so
// the throttle is unit-tested; lib/storeReview.ts gathers the inputs and makes
// the request. Whether the OS then shows its dialog is the OS's decision.

export interface ReviewPromptInput {
  /** The round was a la escuadra: every question right. */
  flawless: boolean;
  /** `StoreReview.hasAction()`: the store has a review flow to offer. */
  hasAction: boolean;
  /** The running app's version, or null when it cannot be read. */
  appVersion: string | null;
  /** `reviewAskedVersion`: the app version that last asked, or null. */
  askedVersion: string | null;
  /** The user had completed a round before this one. */
  earlierRounds: boolean;
  /** `AppState.currentState === 'active'`: in the background there is no
   *  window for the dialog, and asking would use up this version's ask. */
  appActive: boolean;
}

export function shouldAskForReview({
  flawless,
  hasAction,
  appVersion,
  askedVersion,
  earlierRounds,
  appActive,
}: ReviewPromptInput): boolean {
  return (
    flawless &&
    hasAction &&
    appVersion !== null &&
    askedVersion !== appVersion &&
    earlierRounds &&
    appActive
  );
}
