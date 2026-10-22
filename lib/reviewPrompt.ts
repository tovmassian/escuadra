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

// Settings' Rate button (#175) opens the store's own page rather than asking the OS for
// its rationed dialog, so it always does something. The App Store id is the listing's
// (README.md); the Play id is the app's package in app.json.
const APP_STORE_REVIEW = 'https://apps.apple.com/app/id6810705505?action=write-review';
const PLAY_LISTING = 'https://play.google.com/store/apps/details?id=com.tovmassian.escuadra';

/** The store page Rate opens on this OS (`Platform.OS`), or null where there is none. */
export function storePageUrl(os: string): string | null {
  if (os === 'ios') return APP_STORE_REVIEW;
  if (os === 'android') return PLAY_LISTING;
  return null;
}
