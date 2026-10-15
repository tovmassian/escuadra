// Which device call each feedback moment makes, per platform (spec §7). Pure,
// so it is tested in node: lib/haptics.ts plays the plan, and this file is
// what the tests pin.

export type HapticMoment =
  'tap' | 'correct' | 'wrong' | 'streak' | 'passed' | 'escuadra' | 'reveal';

export type AndroidHapticType = 'confirm' | 'reject' | 'virtual-key' | 'segment-tick';

export type HapticStep =
  | { kind: 'impact'; style: 'light' | 'medium' | 'soft'; delayMs: number }
  | { kind: 'notification'; type: 'success' | 'warning'; delayMs: number }
  | { kind: 'android'; type: AndroidHapticType; delayMs: number };

/**
 * The Android API level each constant needs (`HapticFeedbackConstants`):
 * - CONFIRM and REJECT: 30
 * - SEGMENT_TICK: 34
 * - VIRTUAL_KEY: always present
 *
 * Below the level, expo-haptics rejects the call. Android's own docs
 * recommend these constants over the vibrator API.
 */
export const ANDROID_MIN_API: Record<AndroidHapticType, number> = {
  confirm: 30,
  reject: 30,
  'virtual-key': 1,
  'segment-tick': 34,
};

/** a la escuadra's two trailing taps follow the trail, 60 ms apart. */
const TRAIL_STEP_MS = 60;

const IOS: Record<HapticMoment, HapticStep[]> = {
  tap: [{ kind: 'impact', style: 'light', delayMs: 0 }],
  correct: [{ kind: 'impact', style: 'medium', delayMs: 0 }],
  wrong: [{ kind: 'notification', type: 'warning', delayMs: 0 }],
  streak: [{ kind: 'impact', style: 'soft', delayMs: 0 }],
  passed: [{ kind: 'impact', style: 'soft', delayMs: 0 }],
  escuadra: [
    { kind: 'notification', type: 'success', delayMs: 0 },
    { kind: 'impact', style: 'light', delayMs: TRAIL_STEP_MS },
    { kind: 'impact', style: 'light', delayMs: TRAIL_STEP_MS * 2 },
  ],
  reveal: [{ kind: 'impact', style: 'light', delayMs: 0 }],
};

/** One Android constant per iOS step, in the same order. */
const ANDROID: Record<HapticMoment, AndroidHapticType[]> = {
  tap: ['virtual-key'],
  correct: ['confirm'],
  wrong: ['reject'],
  streak: ['segment-tick'],
  passed: ['confirm'],
  escuadra: ['confirm', 'segment-tick', 'segment-tick'],
  reveal: ['virtual-key'],
};

/**
 * The calls for one moment:
 * - Vibration off (`enabled` false): nothing, on every platform.
 * - iOS: the iOS column.
 * - Android: each step's constant where the device's API level has it,
 *   otherwise the iOS step it stands for (which plays through the vibrator).
 * - Anywhere else (web): nothing.
 */
export function hapticPlan(
  enabled: boolean,
  moment: HapticMoment,
  os: string,
  androidApiLevel: number,
): HapticStep[] {
  if (!enabled) return [];
  if (os === 'ios') return IOS[moment];
  if (os !== 'android') return [];
  const ios = IOS[moment];
  return ANDROID[moment].flatMap((type, i): HapticStep[] => {
    const fallback = ios[i];
    if (fallback === undefined) return [];
    return androidApiLevel >= ANDROID_MIN_API[type]
      ? [{ kind: 'android', type, delayMs: fallback.delayMs }]
      : [fallback];
  });
}
