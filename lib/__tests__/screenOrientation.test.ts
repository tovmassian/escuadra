import { describe, expect, it } from 'vitest';
import { screenOrientation } from '../screenOrientation';

describe('screenOrientation', () => {
  it('keeps a phone in portrait', () => {
    expect(screenOrientation({ width: 393, height: 852 })).toBe('portrait_up');
  });

  it('keeps a phone in portrait when it is held sideways', () => {
    expect(screenOrientation({ width: 852, height: 393 })).toBe('portrait_up');
  });

  it('lets a tablet rotate', () => {
    expect(screenOrientation({ width: 800, height: 1280 })).toBe('default');
  });

  it('lets an unfolded foldable rotate', () => {
    expect(screenOrientation({ width: 884, height: 838 })).toBe('default');
  });

  it('counts 600 dp on the shorter side as a large screen', () => {
    expect(screenOrientation({ width: 600, height: 960 })).toBe('default');
    expect(screenOrientation({ width: 599, height: 960 })).toBe('portrait_up');
  });
});
