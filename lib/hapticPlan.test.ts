import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ANDROID_MIN_API, hapticPlan, type HapticMoment } from './hapticPlan';

const MOMENTS: HapticMoment[] = [
  'tap',
  'correct',
  'wrong',
  'streak',
  'passed',
  'escuadra',
  'reveal',
];

describe('hapticPlan on iOS (spec §7)', () => {
  it('maps each moment to its call', () => {
    expect(hapticPlan('tap', 'ios', 0)).toEqual([{ kind: 'impact', style: 'light', delayMs: 0 }]);
    expect(hapticPlan('correct', 'ios', 0)).toEqual([
      { kind: 'impact', style: 'medium', delayMs: 0 },
    ]);
    expect(hapticPlan('wrong', 'ios', 0)).toEqual([
      { kind: 'notification', type: 'warning', delayMs: 0 },
    ]);
    expect(hapticPlan('streak', 'ios', 0)).toEqual([{ kind: 'impact', style: 'soft', delayMs: 0 }]);
    expect(hapticPlan('passed', 'ios', 0)).toEqual([{ kind: 'impact', style: 'soft', delayMs: 0 }]);
    expect(hapticPlan('reveal', 'ios', 0)).toEqual([
      { kind: 'impact', style: 'light', delayMs: 0 },
    ]);
  });

  it('plays a la escuadra as a success, then two light taps 60 ms apart', () => {
    expect(hapticPlan('escuadra', 'ios', 0)).toEqual([
      { kind: 'notification', type: 'success', delayMs: 0 },
      { kind: 'impact', style: 'light', delayMs: 60 },
      { kind: 'impact', style: 'light', delayMs: 120 },
    ]);
  });
});

describe('hapticPlan on Android', () => {
  it("uses the platform's haptic constants on a current device", () => {
    const api = 34;
    expect(hapticPlan('tap', 'android', api)).toEqual([
      { kind: 'android', type: 'virtual-key', delayMs: 0 },
    ]);
    expect(hapticPlan('correct', 'android', api)).toEqual([
      { kind: 'android', type: 'confirm', delayMs: 0 },
    ]);
    expect(hapticPlan('wrong', 'android', api)).toEqual([
      { kind: 'android', type: 'reject', delayMs: 0 },
    ]);
    expect(hapticPlan('streak', 'android', api)).toEqual([
      { kind: 'android', type: 'segment-tick', delayMs: 0 },
    ]);
    expect(hapticPlan('escuadra', 'android', api)).toEqual([
      { kind: 'android', type: 'confirm', delayMs: 0 },
      { kind: 'android', type: 'segment-tick', delayMs: 60 },
      { kind: 'android', type: 'segment-tick', delayMs: 120 },
    ]);
  });

  // expo-haptics rejects a constant the device's API level lacks, so the plan
  // falls back to the iOS column's call, which goes through the vibrator.
  it("falls back to the iOS call below a constant's API level", () => {
    expect(hapticPlan('correct', 'android', ANDROID_MIN_API.confirm - 1)).toEqual(
      hapticPlan('correct', 'ios', 0),
    );
    expect(hapticPlan('streak', 'android', ANDROID_MIN_API['segment-tick'] - 1)).toEqual(
      hapticPlan('streak', 'ios', 0),
    );
    expect(hapticPlan('escuadra', 'android', 31)).toEqual([
      { kind: 'android', type: 'confirm', delayMs: 0 },
      { kind: 'impact', style: 'light', delayMs: 60 },
      { kind: 'impact', style: 'light', delayMs: 120 },
    ]);
  });

  it('keeps the tap on every API level', () => {
    expect(hapticPlan('tap', 'android', 21)).toEqual([
      { kind: 'android', type: 'virtual-key', delayMs: 0 },
    ]);
  });
});

describe('hapticPlan elsewhere', () => {
  it('does nothing on web', () => {
    for (const moment of MOMENTS) expect(hapticPlan(moment, 'web', 0)).toEqual([]);
  });
});

// Spec §7: lib/haptics.ts is the only module that imports expo-haptics, so the
// Vibration switch silences every haptic.
describe('expo-haptics importers', () => {
  const ROOT = path.join(import.meta.dirname, '..');
  function sources(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) return name === '__tests__' ? [] : sources(full);
      return /\.(ts|tsx)$/.test(name) ? [full] : [];
    });
  }

  it('is lib/haptics.ts alone', () => {
    const importers = ['app', 'components', 'lib', 'stores']
      .flatMap((dir) => sources(path.join(ROOT, dir)))
      .filter((file) => /from ['"]expo-haptics['"]/.test(readFileSync(file, 'utf8')))
      .map((file) => path.relative(ROOT, file));
    expect(importers).toEqual(['lib/haptics.ts']);
  });
});
