// Phones play in portrait; tablets and foldables rotate (#203). The manifest
// no longer locks the orientation (plugins/withAndroidRelease.js), because
// Android 16 ignores that lock on large screens and Play flags it; the root
// Stack locks phones instead. 600 dp on the shorter side is Android's line
// for a large screen. Pure, so it is unit-tested.

export type ScreenOrientation = 'portrait_up' | 'default';

const LARGE_SCREEN_DP = 600;

export function screenOrientation(window: { width: number; height: number }): ScreenOrientation {
  return Math.min(window.width, window.height) < LARGE_SCREEN_DP ? 'portrait_up' : 'default';
}
