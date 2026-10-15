// The only module that imports expo-haptics (spec §7). Screens call
// `feedback(moment)`. It checks the Vibration setting, then plays the moment's
// plan (lib/hapticPlan.ts) for this platform and API level. A rejected call
// is dropped: a missed buzz is never worth an error. The iOS system setting
// and Low Power Mode still apply on top. Haptics never leave the device.
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import {
  hapticPlan,
  type AndroidHapticType,
  type HapticMoment,
  type HapticStep,
} from './hapticPlan';
import { useProgress } from '@/stores/progress';

const IMPACT = {
  light: Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
  soft: Haptics.ImpactFeedbackStyle.Soft,
} as const;

const NOTIFICATION = {
  success: Haptics.NotificationFeedbackType.Success,
  warning: Haptics.NotificationFeedbackType.Warning,
} as const;

const ANDROID: Record<AndroidHapticType, Haptics.AndroidHaptics> = {
  confirm: Haptics.AndroidHaptics.Confirm,
  reject: Haptics.AndroidHaptics.Reject,
  'virtual-key': Haptics.AndroidHaptics.Virtual_Key,
  'segment-tick': Haptics.AndroidHaptics.Segment_Tick,
};

function play(step: HapticStep): Promise<void> {
  switch (step.kind) {
    case 'impact':
      return Haptics.impactAsync(IMPACT[step.style]);
    case 'notification':
      return Haptics.notificationAsync(NOTIFICATION[step.type]);
    case 'android':
      return Haptics.performAndroidHapticsAsync(ANDROID[step.type]);
  }
}

export type { HapticMoment };

export function feedback(moment: HapticMoment): void {
  if (!useProgress.getState().haptics) return;
  const apiLevel = Platform.OS === 'android' ? Number(Platform.Version) : 0;
  for (const step of hapticPlan(moment, Platform.OS, apiLevel)) {
    const fire = () => {
      play(step).catch(() => {});
    };
    if (step.delayMs > 0) setTimeout(fire, step.delayMs);
    else fire();
  }
}
