import { describe, expect, it } from 'vitest';
import { createRng } from '@/lib/prng';
import {
  CORNER_BALL,
  GOAL_SHOTS,
  MISS_SHOTS,
  planShot,
  sampleShot,
  shotOrigin,
  type ShotInput,
  type ShotName,
  type ShotPlan,
  type ShotSample,
  type ShotVerdict,
} from '@/lib/shot';
import { durations, sizes, spotlightCues, spotlightMotion } from '@/theme/tokens';

const { arm, bar, ball } = sizes.corner.question;
const { clearance, drawScale, startScale } = spotlightMotion.shot;

// Layouts the question screen can produce: phones from 360 × 640 to 430 × 932;
// the corner after a one- or two-digit number, where the hero sits on a short
// or a tall screen; a tap anywhere on the answer grid under the slots and the
// prompt. Each case gets its own seed and, by turns, no previous shot or one
// of each.
function layouts(verdict: ShotVerdict, count = 400): ShotInput[] {
  const r = createRng(129);
  const names: (ShotName | null)[] = [null, ...(verdict === 'goal' ? GOAL_SHOTS : MISS_SHOTS)];
  return Array.from({ length: count }, (_, seed) => {
    const width = 360 + r() * 70;
    const height = 640 + r() * 292;
    const corner = { x: 56 + r() * 110, y: height * (0.3 + r() * 0.17) };
    const top = corner.y + arm + 150;
    const bottom = Math.min(top + 180, height - 60);
    const from = { x: 16 + r() * (width - 32), y: top + r() * (bottom - top) };
    return {
      verdict,
      from,
      corner,
      bounds: { width, height },
      seed,
      previous: names[seed % names.length] ?? null,
    };
  });
}

// What the screen draws: the plan sampled every millisecond of its flight.
function drawn(plan: ShotPlan): ShotSample[] {
  const out: ShotSample[] = [];
  for (let ms = 0; ms < plan.frames.flight; ms += 1) {
    const at = sampleShot(plan.frames, ms);
    if (at) out.push(at);
  }
  return out;
}

const radius = (at: ShotSample) => (ball / 2) * at.scale;

// How far apart a ball and a box are, edge to edge (negative: overlapping).
function gap(at: ShotSample, box: { x: number; y: number; w: number; h: number }): number {
  const dx = Math.max(box.x - at.x, 0, at.x - (box.x + box.w));
  const dy = Math.max(box.y - at.y, 0, at.y - (box.y + box.h));
  return Math.hypot(dx, dy) - radius(at);
}

const last = (values: number[]) => values[values.length - 1] ?? NaN;

describe('CORNER_BALL', () => {
  it('rests under the crossbar, centred in the space left of the post', () => {
    expect(CORNER_BALL.y - ball / 2).toBe(bar);
    const left = CORNER_BALL.x - ball / 2;
    const right = arm - bar - (CORNER_BALL.x + ball / 2);
    expect(left).toBe(right);
  });
});

describe('planShot: goals', () => {
  const cases = layouts('goal').map((input) => ({ input, plan: planShot(input) }));

  it('plays a goal shot', () => {
    for (const { plan } of cases) {
      expect(plan.verdict).toBe('goal');
      expect(GOAL_SHOTS).toContain(plan.name);
    }
  });

  it('leaves the tap point at the start scale, fading in', () => {
    for (const { input, plan } of cases) {
      expect(plan.frames.x[0]).toBeCloseTo(input.from.x, 6);
      expect(plan.frames.y[0]).toBeCloseTo(input.from.y, 6);
      expect(plan.frames.scale[0]).toBeCloseTo(startScale, 6);
      expect(plan.frames.opacity[0]).toBe(0);
    }
  });

  it("lands at the corner's rest point, at the corner's ball size", () => {
    for (const { input, plan } of cases) {
      expect(last(plan.frames.x)).toBeCloseTo(input.corner.x + CORNER_BALL.x, 6);
      expect(last(plan.frames.y)).toBeCloseTo(input.corner.y + CORNER_BALL.y, 6);
      expect(last(plan.frames.scale)).toBeCloseTo(1, 6);
      expect(last(plan.frames.opacity)).toBe(1);
    }
  });

  it('never passes through the frame: it comes in through the open, lower-left side', () => {
    for (const { input, plan } of cases) {
      const crossbar = { x: input.corner.x, y: input.corner.y, w: arm, h: bar };
      const post = { x: input.corner.x + arm - bar, y: input.corner.y, w: bar, h: arm };
      for (const at of drawn(plan)) {
        // At rest the ball just touches the crossbar; half a point allows for that.
        expect(gap(at, crossbar), `${plan.name}, seed ${input.seed}`).toBeGreaterThanOrEqual(-0.5);
        expect(gap(at, post), `${plan.name}, seed ${input.seed}`).toBeGreaterThanOrEqual(-0.5);
      }
    }
  });

  it('flies 213–291 ms, and the corner reacts as it lands', () => {
    for (const { plan } of cases) {
      expect(plan.frames.flight).toBeGreaterThanOrEqual(213);
      expect(plan.frames.flight).toBeLessThanOrEqual(291);
      expect(plan.impact).toBe(plan.frames.flight);
    }
  });
});

describe('planShot: misses', () => {
  const cases = layouts('miss').map((input) => ({ input, plan: planShot(input) }));

  it('plays a miss shot', () => {
    for (const { plan } of cases) {
      expect(plan.verdict).toBe('miss');
      expect(MISS_SHOTS).toContain(plan.name);
    }
  });

  it(`never comes within ${clearance} dp of the corner`, () => {
    for (const { input, plan } of cases) {
      const box = { x: input.corner.x, y: input.corner.y, w: arm, h: arm };
      for (const at of drawn(plan)) {
        expect(gap(at, box), `${plan.name}, seed ${input.seed}`).toBeGreaterThanOrEqual(clearance);
      }
    }
  });

  it('is lost off the screen', () => {
    for (const { input, plan } of cases) {
      const x = last(plan.frames.x);
      const y = last(plan.frames.y);
      const r = (ball / 2) * last(plan.frames.scale);
      const off = x < -r || x > input.bounds.width + r || y < -r;
      expect(off, `${plan.name}, seed ${input.seed}`).toBe(true);
      expect(last(plan.frames.opacity)).toBe(0);
    }
  });

  it('keeps its pace, and the corner turns as it goes by', () => {
    for (const { plan } of cases) {
      expect(plan.frames.flight).toBe(Math.round(durations.shotFlight * 1.15));
      expect(plan.impact).toBeGreaterThan(0);
      expect(plan.impact).toBeLessThan(plan.frames.flight);
    }
  });
});

describe('planShot', () => {
  const both = [...layouts('goal'), ...layouts('miss')];

  it('never plays the same shot twice running', () => {
    for (const input of both) {
      if (input.previous) expect(planShot(input).name).not.toBe(input.previous);
    }
  });

  it('gives the same shot for the same seed', () => {
    for (const input of both.slice(0, 40)) expect(planShot(input)).toEqual(planShot(input));
  });

  it('plays every shot', () => {
    const names = new Set(both.map((input) => planShot(input).name));
    for (const name of [...GOAL_SHOTS, ...MISS_SHOTS]) expect(names).toContain(name);
  });

  it('keeps every flight within 300 ms, and the goal inside the auto-advance pause', () => {
    for (const input of both) {
      const plan = planShot(input);
      expect(plan.frames.flight).toBeLessThanOrEqual(300);
      expect(plan.end).toBeGreaterThanOrEqual(plan.impact);
      expect(spotlightCues.ball + plan.end).toBeLessThan(durations.autoAdvance);
    }
  });

  it('never draws a ball bigger than it is drawn at', () => {
    for (const input of both) {
      for (const s of planShot(input).frames.scale) expect(s).toBeLessThanOrEqual(drawScale);
    }
  });
});

describe('sampleShot', () => {
  const frames = {
    flight: 100,
    x: [0, 10, 20],
    y: [0, -10, -20],
    scale: [2, 1, 1],
    opacity: [0, 1, 1],
  };

  it('draws nothing before the strike or once the flight is over', () => {
    expect(sampleShot(frames, -1)).toBeNull();
    expect(sampleShot(frames, 100)).toBeNull();
    expect(sampleShot(frames, 250)).toBeNull();
  });

  it('blends between the steps', () => {
    expect(sampleShot(frames, 0)).toEqual({ x: 0, y: 0, scale: 2, opacity: 0 });
    expect(sampleShot(frames, 25)).toEqual({ x: 5, y: -5, scale: 1.5, opacity: 0.5 });
    expect(sampleShot(frames, 75)).toEqual({ x: 15, y: -15, scale: 1, opacity: 1 });
  });
});

describe('shotOrigin', () => {
  const tile = { x: 16, y: 600, width: 170, height: 58 };

  it('strikes from the tap when it is on the tile', () => {
    expect(shotOrigin({ x: 40, y: 620 }, tile)).toEqual({ x: 40, y: 620 });
  });

  it("strikes from the tile's centre when the press carried no point, or one off the tile", () => {
    expect(shotOrigin(null, tile)).toEqual({ x: 101, y: 629 });
    expect(shotOrigin({ x: 0, y: 0 }, tile)).toEqual({ x: 101, y: 629 });
  });

  it('falls back to the tap, or nothing, without a tile', () => {
    expect(shotOrigin({ x: 40, y: 620 }, null)).toEqual({ x: 40, y: 620 });
    expect(shotOrigin(null, null)).toBeNull();
  });
});
