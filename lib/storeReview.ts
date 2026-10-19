// The only module that imports expo-store-review (#57). Results calls
// `askForReview` after an a la escuadra round; `shouldAskForReview`
// (lib/reviewPrompt.ts) decides whether to ask, and the OS decides whether its
// rating dialog actually shows (it rations them, and shows none on
// TestFlight). Fire and forget: never awaited, never throws, and it sets no
// React state, so the screen never waits on it or re-renders for it. Skipped
// on web, where there is no store, so `npm run shots` never asks, and while
// the app is in the background.
import { useProgress } from '@/stores/progress';
import Constants from 'expo-constants';
import * as StoreReview from 'expo-store-review';
import { AppState, Platform } from 'react-native';
import { shouldAskForReview } from './reviewPrompt';

/**
 * Asks the OS for its store-rating dialog if this round earns it.
 * `stillShown` is checked once `hasAction()` answers, so a user who has
 * already left Results is never interrupted on the next screen.
 */
export function askForReview(
  round: { flawless: boolean; earlierRounds: boolean },
  stillShown: () => boolean,
): void {
  if (Platform.OS === 'web' || !round.flawless) return;
  const appVersion = Constants.expoConfig?.version ?? null;
  StoreReview.hasAction()
    .then((hasAction) => {
      if (!stillShown()) return;
      const { reviewAskedVersion, setReviewAskedVersion } = useProgress.getState();
      const ask = shouldAskForReview({
        ...round,
        hasAction,
        appVersion,
        askedVersion: reviewAskedVersion,
        // Read as the decision is made, just before the request.
        appActive: AppState.currentState === 'active',
      });
      // `appVersion` is never null when `ask` holds; checked to narrow it.
      if (!ask || appVersion === null) return;
      // Noted before the request, which on Android resolves only once the
      // dialog closes: a request that fails still counts as this version's.
      setReviewAskedVersion(appVersion);
      StoreReview.requestReview().catch(() => {});
    })
    .catch(() => {});
}
