import { describe, expect, it } from 'vitest';
import { introPlan } from '@/lib/launchIntro';

const fresh = { alreadyShown: false, screenReader: false, reduceMotion: false };

describe('introPlan', () => {
  it('plays the strike on a fresh launch', () => {
    expect(introPlan(fresh)).toBe('play');
  });

  it('shows only the end frame under Reduce Motion', () => {
    expect(introPlan({ ...fresh, reduceMotion: true })).toBe('still');
  });

  it('never shows twice in one launch, so a warm resume goes straight on', () => {
    expect(introPlan({ ...fresh, alreadyShown: true })).toBe('none');
    expect(introPlan({ ...fresh, alreadyShown: true, reduceMotion: true })).toBe('none');
  });

  it('shows nothing with a screen reader on', () => {
    expect(introPlan({ ...fresh, screenReader: true })).toBe('none');
    expect(introPlan({ ...fresh, screenReader: true, reduceMotion: true })).toBe('none');
  });
});
