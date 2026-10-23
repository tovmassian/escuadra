import { describe, expect, it } from 'vitest';
import { dockTransform, introPlan, isDockable, withinTime } from '@/lib/launchIntro';

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

describe('dockTransform', () => {
  // A box of the given size centred at (cx, cy), as `measureInWindow` reports it.
  const centred = (cx: number, cy: number, width: number, height = width) => ({
    x: cx - width / 2,
    y: cy - height / 2,
    width,
    height,
  });

  it('leaves a box where it is when the target is the same box', () => {
    const box = centred(100, 200, 50);
    expect(dockTransform(box, box)).toEqual({ translateX: 0, translateY: 0, scale: 1 });
  });

  it('moves centre to centre and scales by the ratio of the widths', () => {
    const { translateX, translateY, scale } = dockTransform(
      centred(195, 350, 200),
      centred(40, 44, 28),
    );
    expect(translateX).toBeCloseTo(-155);
    expect(translateY).toBeCloseTo(-306);
    expect(scale).toBeCloseTo(0.14);
  });

  it('moves right and down to a target to the right and below', () => {
    const { translateX, translateY } = dockTransform(centred(50, 50, 40), centred(300, 600, 20));
    expect(translateX).toBeGreaterThan(0);
    expect(translateY).toBeGreaterThan(0);
  });

  it('scales by width alone, so a word set wider or narrower keeps its own line height', () => {
    const word = { x: 0, y: 0, width: 200, height: 56 };
    const target = { x: 0, y: 0, width: 100, height: 26 };
    expect(dockTransform(word, target).scale).toBeCloseTo(0.5);
  });
});

describe('isDockable', () => {
  it('takes a measured box with a size', () => {
    expect(isDockable({ x: 0, y: 0, width: 28, height: 28 })).toBe(true);
  });

  it('refuses a view that was not there to measure', () => {
    expect(isDockable(null)).toBe(false);
  });

  it('refuses a box with no size, which would scale to nothing or infinity', () => {
    expect(isDockable({ x: 10, y: 10, width: 0, height: 22 })).toBe(false);
    expect(isDockable({ x: 10, y: 10, width: 106, height: 0 })).toBe(false);
    expect(isDockable({ x: 10, y: 10, width: -4, height: 22 })).toBe(false);
  });

  it('refuses a box that is not a number', () => {
    expect(isDockable({ x: Number.NaN, y: 0, width: 28, height: 28 })).toBe(false);
    expect(isDockable({ x: 0, y: 0, width: Number.POSITIVE_INFINITY, height: 28 })).toBe(false);
  });
});

describe('withinTime', () => {
  // A timer the test fires by hand, so nothing waits on a clock.
  function fakeTimer() {
    const pending = new Map<number, () => void>();
    let next = 0;
    return {
      timer: {
        set: (fire: () => void) => {
          next += 1;
          pending.set(next, fire);
          return next;
        },
        clear: (id: number) => {
          pending.delete(id);
        },
      },
      fire: () => {
        for (const [id, fire] of pending) {
          pending.delete(id);
          fire();
        }
      },
      pending: () => pending.size,
    };
  }
  // A promise the test settles by hand.
  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => {
      resolve = r;
    });
    return { promise, resolve };
  }
  const settled = async <T>(promise: Promise<T>) => {
    let out: { value: T } | null = null;
    void promise.then((value) => {
      out = { value };
    });
    await new Promise((r) => setImmediate(r));
    return out;
  };

  it('gives the work its result when it comes in time, and stops the timer', async () => {
    const clock = fakeTimer();
    const work = deferred<string>();
    const { result } = withinTime(work.promise, 100, clock.timer);
    work.resolve('measured');
    expect(await settled(result)).toEqual({ value: 'measured' });
    expect(clock.pending()).toBe(0);
  });

  it('gives null when the time runs out first, and ignores the work when it comes late', async () => {
    const clock = fakeTimer();
    const work = deferred<string>();
    const { result } = withinTime(work.promise, 100, clock.timer);
    clock.fire();
    work.resolve('late');
    expect(await settled(result)).toEqual({ value: null });
  });

  it('settles neither way once cancelled, as on unmount', async () => {
    const clock = fakeTimer();
    const work = deferred<string>();
    const { result, cancel } = withinTime(work.promise, 100, clock.timer);
    cancel();
    expect(clock.pending()).toBe(0);
    work.resolve('after unmount');
    expect(await settled(result)).toBeNull();
  });
});
