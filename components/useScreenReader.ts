import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** Whether VoiceOver or TalkBack is on. The question screen never moves on
 *  by itself while it is (spec §2.4). False on web, and until the first
 *  answer arrives. */
export function useScreenReader(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isScreenReaderEnabled()
      .then((enabled) => {
        if (live) setOn(enabled);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', setOn);
    return () => {
      live = false;
      subscription.remove();
    };
  }, []);
  return on;
}
