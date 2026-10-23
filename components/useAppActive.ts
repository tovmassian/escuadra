import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/** True while the app is in the foreground. The wall's drift stops otherwise (#181). */
export function useAppActive(): boolean {
  const [active, setActive] = useState(() => AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    // A change between the initial state and this subscription would be lost.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActive(AppState.currentState === 'active');
    return () => sub.remove();
  }, []);
  return active;
}
