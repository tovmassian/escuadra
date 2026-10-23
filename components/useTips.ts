import { useState } from 'react';
import { shouldShowTips, type TipScreen } from '@/lib/tips';
import { useProgress, useProgressHydrated } from '@/stores/progress';

export interface Tips {
  open: boolean;
  close: () => void;
  skip: () => void;
  /** `TipsLayer`'s `onShown`: marks the screen seen as its first tip shows. */
  onShown: () => void;
  /** Spread on the screen's content while the tips show: Android's screen
   *  readers then reach only the tip. iOS uses the layer's own modal flag. */
  contentA11y: {
    importantForAccessibility?: 'no-hide-descendants';
    accessibilityElementsHidden?: boolean;
  };
}

// Whether a screen opens with its How to play tips (#183). Decided once, after
// the store has hydrated (and, for the round and Results, once the screen says it
// is ready, #184), so a returning player never sees a flash of them. The
// screen is marked seen as its first tip shows (the layer's `onShown`), not as
// the tips open: leaving mid-way never brings them back, and a screen whose
// targets never mount keeps them for next time.
export function useTips(screen: TipScreen, ready = true): Tips {
  const hydrated = useProgressHydrated();
  const seen = useProgress((s) => s.tipsSeen);
  const skipped = useProgress((s) => s.tipsSkipped);
  const [state, setState] = useState<'pending' | 'open' | 'closed'>('pending');

  // Decided while rendering, once, so the tips open in the same frame as the
  // hydrated screen; marking the screen seen later changes `seen`, but the
  // decision is already made.
  if (state === 'pending' && hydrated && ready) {
    setState(shouldShowTips(screen, seen, skipped) ? 'open' : 'closed');
  }

  const open = state === 'open';
  return {
    open,
    close: () => setState('closed'),
    skip: () => {
      useProgress.getState().skipTips();
      setState('closed');
    },
    onShown: () => useProgress.getState().markTipsSeen(screen),
    contentA11y: open
      ? { importantForAccessibility: 'no-hide-descendants', accessibilityElementsHidden: true }
      : {},
  };
}
