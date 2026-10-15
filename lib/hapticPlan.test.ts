import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ANDROID_MIN_API, hapticPlan, type HapticMoment, type HapticStep } from './hapticPlan';

const MOMENTS: HapticMoment[] = [
  'tap',
  'correct',
  'wrong',
  'streak',
  'passed',
  'escuadra',
  'reveal',
];

// Android API levels, derived from the table the plan reads.
/** Every constant is available. */
const API_ALL = Math.max(...Object.values(ANDROID_MIN_API));
/** CONFIRM and REJECT are missing. */
const API_NO_CONFIRM = ANDROID_MIN_API.confirm - 1;
/** CONFIRM and REJECT are there; SEGMENT_TICK is not. */
const API_NO_TICK = ANDROID_MIN_API['segment-tick'] - 1;

const impact = (style: 'light' | 'medium' | 'soft', delayMs = 0): HapticStep => ({
  kind: 'impact',
  style,
  delayMs,
});
const notification = (type: 'success' | 'warning', delayMs = 0): HapticStep => ({
  kind: 'notification',
  type,
  delayMs,
});
const android = (
  type: 'confirm' | 'reject' | 'virtual-key' | 'segment-tick',
  delayMs = 0,
): HapticStep => ({ kind: 'android', type, delayMs });

// Spec §7, every moment on every platform column. `Record<HapticMoment, …>`
// makes a new moment a compile error here until it is pinned.
const PLANS: Record<
  HapticMoment,
  { ios: HapticStep[]; current: HapticStep[]; noTick: HapticStep[]; noConfirm: HapticStep[] }
> = {
  tap: {
    ios: [impact('light')],
    current: [android('virtual-key')],
    noTick: [android('virtual-key')],
    noConfirm: [android('virtual-key')],
  },
  correct: {
    ios: [impact('medium')],
    current: [android('confirm')],
    noTick: [android('confirm')],
    noConfirm: [impact('medium')],
  },
  wrong: {
    ios: [notification('warning')],
    current: [android('reject')],
    noTick: [android('reject')],
    noConfirm: [notification('warning')],
  },
  streak: {
    ios: [impact('soft')],
    current: [android('segment-tick')],
    noTick: [impact('soft')],
    noConfirm: [impact('soft')],
  },
  passed: {
    ios: [impact('soft')],
    current: [android('confirm')],
    noTick: [android('confirm')],
    noConfirm: [impact('soft')],
  },
  escuadra: {
    ios: [notification('success'), impact('light', 60), impact('light', 120)],
    current: [android('confirm'), android('segment-tick', 60), android('segment-tick', 120)],
    noTick: [android('confirm'), impact('light', 60), impact('light', 120)],
    noConfirm: [notification('success'), impact('light', 60), impact('light', 120)],
  },
  reveal: {
    ios: [impact('light')],
    current: [android('virtual-key')],
    noTick: [android('virtual-key')],
    noConfirm: [android('virtual-key')],
  },
};

describe('hapticPlan on iOS (spec §7)', () => {
  it('maps each moment to its call', () => {
    for (const moment of MOMENTS) {
      expect(hapticPlan(true, moment, 'ios', 0), moment).toEqual(PLANS[moment].ios);
    }
  });

  it('plays a la escuadra as a success, then two light taps 60 ms apart', () => {
    expect(hapticPlan(true, 'escuadra', 'ios', 0)).toEqual([
      notification('success'),
      impact('light', 60),
      impact('light', 120),
    ]);
  });
});

describe('hapticPlan on Android', () => {
  it("uses the platform's haptic constants on a current device", () => {
    for (const moment of MOMENTS) {
      expect(hapticPlan(true, moment, 'android', API_ALL), moment).toEqual(PLANS[moment].current);
    }
  });

  // expo-haptics rejects a constant the device's API level lacks, so the plan
  // falls back to the iOS column's call, which goes through the vibrator.
  it('falls back per step where SEGMENT_TICK is missing', () => {
    for (const moment of MOMENTS) {
      expect(hapticPlan(true, moment, 'android', API_NO_TICK), moment).toEqual(
        PLANS[moment].noTick,
      );
    }
  });

  it('falls back per step where CONFIRM and REJECT are missing', () => {
    for (const moment of MOMENTS) {
      expect(hapticPlan(true, moment, 'android', API_NO_CONFIRM), moment).toEqual(
        PLANS[moment].noConfirm,
      );
    }
  });

  it("falls back to the iOS call below a constant's API level", () => {
    expect(hapticPlan(true, 'correct', 'android', API_NO_CONFIRM)).toEqual(
      hapticPlan(true, 'correct', 'ios', 0),
    );
    expect(hapticPlan(true, 'wrong', 'android', API_NO_CONFIRM)).toEqual(
      hapticPlan(true, 'wrong', 'ios', 0),
    );
    expect(hapticPlan(true, 'streak', 'android', API_NO_TICK)).toEqual(
      hapticPlan(true, 'streak', 'ios', 0),
    );
  });

  it('keeps the tap on every API level', () => {
    expect(hapticPlan(true, 'tap', 'android', ANDROID_MIN_API['virtual-key'])).toEqual([
      android('virtual-key'),
    ]);
  });
});

describe('hapticPlan elsewhere', () => {
  it('does nothing on web', () => {
    for (const moment of MOMENTS) expect(hapticPlan(true, moment, 'web', 0)).toEqual([]);
  });
});

// The Vibration setting (lib/haptics.ts passes it in): off silences every
// moment on every platform.
describe('hapticPlan with Vibration off', () => {
  const PLATFORMS: [string, number][] = [
    ['ios', 0],
    ['android', API_ALL],
    ['android', API_NO_TICK],
    ['android', API_NO_CONFIRM],
    ['android', ANDROID_MIN_API['virtual-key']],
    ['web', 0],
  ];

  it('plays nothing for any moment on any platform', () => {
    for (const [os, api] of PLATFORMS) {
      for (const moment of MOMENTS) {
        expect(hapticPlan(false, moment, os, api), `${moment} on ${os} ${api}`).toEqual([]);
      }
    }
  });

  it('plays the same moments when it is on', () => {
    for (const moment of MOMENTS) {
      expect(hapticPlan(true, moment, 'ios', 0).length, moment).toBeGreaterThan(0);
    }
  });
});

// Spec §7: lib/haptics.ts is the only module that imports expo-haptics, so the
// Vibration switch silences every haptic.
describe('expo-haptics importers', () => {
  const ROOT = path.join(import.meta.dirname, '..');
  const SKIPPED_DIRS = new Set(['node_modules', 'dist', '__tests__']);
  // Any import form: `from 'expo-haptics'`, a bare side-effect import,
  // `require(...)`, a dynamic `import(...)`, or a deep path.
  const EXPO_HAPTICS = /['"]expo-haptics(\/[^'"]*)?['"]/;

  function sources(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) {
        return name.startsWith('.') || SKIPPED_DIRS.has(name) ? [] : sources(full);
      }
      return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
    });
  }

  it('is lib/haptics.ts alone', () => {
    const importers = sources(ROOT)
      .filter((file) => EXPO_HAPTICS.test(readFileSync(file, 'utf8')))
      .map((file) => path.relative(ROOT, file));
    expect(importers).toEqual(['lib/haptics.ts']);
  });
});
