import { createRng } from '@/lib/prng';
import { durations, sizes, spotlightMotion } from '@/theme/tokens';

// The shot when a question is decided (#129, spec §6): a ball struck from the
// tapped tile. A goal slows into the escuadra corner through its open,
// lower-left side; a miss keeps its pace, goes wide and leaves the screen,
// never near the corner. Pure: given the tap point, the corner, the verdict
// and a seed, `planShot` returns where the ball is, how big and how opaque, at
// equal steps of time, and when the corner reacts. The question screen
// samples those steps on the UI thread (`sampleShot`).
// The shapes are the design prototype's generator, with its fixed 390 × 844
// positions made relative to the corner, the tap and the screen.

export interface Point {
  x: number;
  y: number;
}

export interface Box extends Point {
  width: number;
  height: number;
}

export type ShotVerdict = 'goal' | 'miss';
export const GOAL_SHOTS = ['Curler', 'Driven', 'Dipping lob', 'Trivela'] as const;
export const MISS_SHOTS = ['Wide right', 'Wide left', 'Sliced right', 'Dragged left'] as const;
export type GoalShot = (typeof GOAL_SHOTS)[number];
export type MissShot = (typeof MISS_SHOTS)[number];
export type ShotName = GoalShot | MissShot;

/** The ball at equal steps of time over its flight: its centre in the
 *  overlay's coordinates, its size × `sizes.corner.question.ball`, and its
 *  opacity. */
export interface ShotFrames {
  flight: number;
  x: number[];
  y: number[];
  scale: number[];
  opacity: number[];
}

export interface ShotPlan {
  name: ShotName;
  verdict: ShotVerdict;
  frames: ShotFrames;
  /** ms after the strike when the corner reacts: a goal landing, a miss going by. */
  impact: number;
  /** ms after the strike when the ball, its trail and the corner are all still. */
  end: number;
}

export interface ShotInput {
  verdict: ShotVerdict;
  /** Where the ball is struck from (`shotOrigin`). */
  from: Point;
  /** The top-left of the corner's arm × arm box. */
  corner: Point;
  /** The overlay's size: a miss leaves past its edges. */
  bounds: { width: number; height: number };
  seed: number;
  /** The last shot with the same verdict: never played twice running. */
  previous: ShotName | null;
}

/** The shot as the corner and the overlay read it on the UI thread. `frames`
 *  is null when nothing flies (Reduce Motion): the corner only turns. */
export interface LiveShot {
  question: number;
  verdict: ShotVerdict;
  impact: number;
  frames: ShotFrames | null;
}

export interface ShotSample {
  x: number;
  y: number;
  scale: number;
  opacity: number;
}

const { arm, bar, ball } = sizes.corner.question;

/** The ball's centre at rest, from the corner box's top-left: just under the
 *  crossbar, centred in the space left of the post. */
export const CORNER_BALL: Point = { x: (arm - bar) / 2, y: bar + ball / 2 };

type Rng = () => number;
type Segment = readonly [Point, Point, Point, Point];

// Steps per flight: a 300 ms flight at 120 Hz draws 36 frames.
const STEPS = 48;
// Control points stay this far inside the screen's sides and above its
// bottom, and no further than `CEILING` above its top.
const EDGE = 14;
const FLOOR = 44;
const CEILING = 200;
// A miss leaves this far past the screen's side.
const OFF = 120;
// Tries at one miss shape before the next is tried.
const REROLLS = 8;
// A goal leaves the boot fast and slows into the net.
const GOAL_EASE = 2.1;
// The ball fades in over the first 8 % of its flight; a miss fades out over
// the last 12 % of its path.
const FADE_IN = 0.08;
const FADE_OUT = 0.88;
// A miss keeps its pace, a little slower than the average goal.
const MISS_SPEED = 1.15;

interface Path {
  name: ShotName;
  segs: readonly Segment[];
  /** × `durations.shotFlight`. */
  speed: number;
  /** The share of the path at which the corner reacts. */
  mark: number;
  /** Time (0–1) to the share of the path covered. */
  ease: (t: number) => number;
  /** The share of the path to the ball's size and opacity. */
  scale: (f: number) => number;
  fade: (f: number) => number;
}

interface GoalShape {
  name: GoalShot;
  /** How far the path bows out near the tile, and near the corner, × its length. */
  bend1: number;
  bend2: number;
  /** How much the last stretch comes up from the lower left rather than
   *  straight on from the tile. */
  approach: number;
  /** How much bigger the ball grows at the top of its arc. */
  swell: number;
  /** × `durations.shotFlight`. */
  speed: number;
}

const GOALS: readonly GoalShape[] = [
  // Bends wide, then curls back in through the corner's open side.
  { name: 'Curler', bend1: 0.34, bend2: 0.12, approach: 1, swell: 0.9, speed: 1 },
  // Near-straight and the quickest; it barely leaves the ground.
  { name: 'Driven', bend1: 0.05, bend2: 0, approach: 0.35, swell: 0.3, speed: 0.82 },
  // Rises highest, so it swells most at the top of its arc.
  { name: 'Dipping lob', bend1: 0.12, bend2: 0.04, approach: 0.75, swell: 1.7, speed: 1.12 },
  // Outside of the boot: an S-curve that swerves late.
  { name: 'Trivela', bend1: -0.24, bend2: 0.2, approach: 0.9, swell: 0.6, speed: 0.95 },
];

interface MissContext {
  from: Point;
  corner: Point;
  width: number;
}

interface MissShape {
  name: MissShot;
  /** The direction it comes into its aim point from. */
  approach: Point;
  /** How much it grows after the aim point, coming off the screen. */
  grow: number;
  /** Where it turns, wide of the corner. */
  aim: (c: MissContext, r: Rng) => Point;
  /** Off the screen. */
  exit: (c: MissContext, aim: Point, r: Rng) => Point;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const MISSES: readonly MissShape[] = [
  // Rises well right of the post, then curls off the right edge.
  {
    name: 'Wide right',
    approach: { x: -0.35, y: 0.94 },
    grow: 1.4,
    aim: (c, r) => ({ x: c.corner.x + arm + 46 + r() * 34, y: c.corner.y + 12 - r() * 44 }),
    exit: (c, aim, r) => ({ x: c.width + OFF, y: aim.y - 60 - r() * 160 }),
  },
  // Rises up the left side, clear of the corner, and leaves the left edge.
  {
    name: 'Wide left',
    approach: { x: 0.35, y: 0.94 },
    grow: 1.4,
    aim: (c, r) => ({ x: c.corner.x - 50 - r() * 26, y: c.corner.y + 12 - r() * 44 }),
    exit: (_c, aim, r) => ({ x: -OFF, y: aim.y - 60 - r() * 160 }),
  },
  // Slices right early; gone before it reaches the corner's height.
  {
    name: 'Sliced right',
    approach: { x: -0.8, y: 0.6 },
    grow: 0.8,
    aim: (c, r) => ({
      x: c.width * (0.64 + r() * 0.18),
      y: lerp(c.corner.y + arm, c.from.y, 0.24 + r() * 0.28),
    }),
    exit: (c, aim, r) => ({ x: c.width + OFF, y: aim.y - 40 - r() * 120 }),
  },
  // Dragged left across the screen and out the left edge.
  {
    name: 'Dragged left',
    approach: { x: 0.8, y: 0.6 },
    grow: 0.8,
    aim: (c, r) => ({
      x: c.width * (0.18 - r() * 0.13),
      y: lerp(c.corner.y + arm, c.from.y, 0.47 + r() * 0.27),
    }),
    exit: (_c, aim, r) => ({ x: -OFF, y: aim.y - 40 - r() * 120 }),
  },
];

const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const mul = (a: Point, k: number): Point => ({ x: a.x * k, y: a.y * k });
const len = (a: Point) => Math.hypot(a.x, a.y);
const norm = (a: Point): Point => mul(a, 1 / (len(a) || 1));
function rot(a: Point, deg: number): Point {
  const q = (deg * Math.PI) / 180;
  return { x: a.x * Math.cos(q) - a.y * Math.sin(q), y: a.x * Math.sin(q) + a.y * Math.cos(q) };
}

function cubic([p0, p1, p2, p3]: Segment, t: number): Point {
  const u = 1 - t;
  const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t] as const;
  return {
    x: w[0] * p0.x + w[1] * p1.x + w[2] * p2.x + w[3] * p3.x,
    y: w[0] * p0.y + w[1] * p1.y + w[2] * p2.y + w[3] * p3.y,
  };
}

interface Trace {
  pts: Point[];
  cum: number[];
  total: number;
}

// The path as points close together, with the distance along it to each.
function trace(segs: readonly Segment[]): Trace {
  const pts: Point[] = [];
  segs.forEach((seg, si) => {
    for (let j = si === 0 ? 0 : 1; j <= 48; j++) pts.push(cubic(seg, j / 48));
  });
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    cum.push((cum[i - 1] ?? 0) + (a && b ? len(sub(b, a)) : 0));
  }
  return { pts, cum, total: cum[cum.length - 1] || 1 };
}

// The point a share `f` of the way along the path.
function along(tr: Trace, f: number): Point {
  const d = f * tr.total;
  let lo = 0;
  let hi = tr.cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if ((tr.cum[mid] ?? 0) < d) lo = mid;
    else hi = mid;
  }
  const a = tr.pts[lo] ?? { x: 0, y: 0 };
  const b = tr.pts[hi] ?? a;
  const from = tr.cum[lo] ?? 0;
  const span = (tr.cum[hi] ?? from) - from || 1;
  const t = Math.min(1, Math.max(0, (d - from) / span));
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

function framesOf(path: Path, flight: number): ShotFrames {
  const tr = trace(path.segs);
  const frames: ShotFrames = { flight, x: [], y: [], scale: [], opacity: [] };
  for (let i = 0; i <= STEPS; i++) {
    const tau = i / STEPS;
    const f = path.ease(tau);
    const at = along(tr, f);
    frames.x.push(at.x);
    frames.y.push(at.y);
    frames.scale.push(path.scale(f));
    frames.opacity.push(Math.min(1, tau / FADE_IN) * path.fade(f));
  }
  return frames;
}

// A goal's random draws, kept while it is steered (`STEER`).
interface GoalDraw {
  side: number;
  jitter: number;
  /** In from the lower left, give or take 15°. */
  open: Point;
}

// How far a goal is steered toward the open side, a step at a time, until it
// clears the frame: its last stretch comes more from the lower left and bends
// less. Fully steered, it comes up from the lower left, where nothing is in
// the way. Most goals clear at 0, the prototype's shape.
const STEER = [0, 0.25, 0.5, 0.75, 1] as const;

function goalPath(
  input: ShotInput,
  shape: GoalShape,
  draw: GoalDraw,
  steer: number,
  clamp: (p: Point) => Point,
): Path {
  const { from, corner } = input;
  const { side, jitter, open } = draw;
  const rest = add(corner, CORNER_BALL);
  const v = sub(rest, from);
  const L = len(v);
  const u = norm(v);
  const n = { x: -u.y, y: u.x };
  const approach = lerp(shape.approach, 1, steer);
  const bend2 = shape.bend2 * (1 - steer);
  const a = norm(add(mul(u, -(1 - approach)), mul(open, approach)));
  const p1 = clamp(add(add(from, mul(u, 0.35 * L)), mul(n, side * shape.bend1 * L * jitter)));
  const p2 = clamp(add(add(rest, mul(a, 0.3 * L)), mul(n, side * bend2 * L * jitter)));
  p2.y = Math.max(p2.y, rest.y + 8);
  const swell = shape.swell * jitter;
  const { startScale } = spotlightMotion.shot;
  return {
    name: shape.name,
    segs: [[from, p1, p2, rest]],
    speed: shape.speed,
    mark: 1,
    ease: (t) => 1 - Math.pow(1 - t, GOAL_EASE),
    // Lob swell: from the start scale down to the corner's ball, bigger at
    // the top of the arc.
    scale: (f) => startScale - (startScale - 1) * f + swell * Math.sin(Math.PI * f),
    fade: () => 1,
  };
}

function missOf(name: MissShot, segs: readonly Segment[], mark: number, grow: number): Path {
  const { startScale } = spotlightMotion.shot;
  return {
    name,
    segs,
    speed: MISS_SPEED,
    mark,
    ease: (t) => t,
    // It rises to its aim point, then grows as it comes off the screen.
    scale: (f) => {
      const g = f <= mark ? f / mark : 1;
      const h = f <= mark ? 0 : (f - mark) / (1 - mark);
      return startScale - 0.5 * g + 0.6 * Math.sin(Math.PI * g) + grow * Math.pow(h, 1.3);
    },
    fade: (f) => (f > FADE_OUT ? Math.max(0, (1 - f) / (1 - FADE_OUT)) : 1),
  };
}

function missPath(input: ShotInput, shape: MissShape, r: Rng, clamp: (p: Point) => Point): Path {
  const { from } = input;
  const c: MissContext = { from, corner: input.corner, width: input.bounds.width };
  const aim = shape.aim(c, r);
  const exit = shape.exit(c, aim, r);
  const side = r() < 0.5 ? -1 : 1;
  const v = sub(aim, from);
  const L1 = len(v);
  const u = norm(v);
  const n = { x: -u.y, y: u.x };
  const a = rot(norm(shape.approach), (r() - 0.5) * 16);
  const p1 = clamp(add(add(from, mul(u, 0.35 * L1)), mul(n, side * 0.1 * L1)));
  const p2 = add(aim, mul(a, 0.3 * L1));
  const dIn = norm(sub(aim, p2));
  const L2 = len(sub(exit, aim));
  const q1 = add(aim, mul(dIn, 0.35 * L2));
  const q2 = add(exit, mul(norm(sub(exit, q1)), -0.25 * L2));
  const rise: Segment = [from, p1, p2, aim];
  const off: Segment = [aim, q1, q2, exit];
  const mark = trace([rise]).total / trace([rise, off]).total;
  return missOf(shape.name, [rise, off], mark, shape.grow);
}

// The last resort, never needed on a real layout: level across the screen
// from the tap, which sits well below the corner.
function flatMiss(input: ShotInput, toRight: boolean): Path {
  const { from } = input;
  const exit = { x: toRight ? input.bounds.width + OFF : -OFF, y: from.y };
  const third = mul(sub(exit, from), 1 / 3);
  const seg: Segment = [from, add(from, third), add(from, mul(third, 2)), exit];
  return missOf(toRight ? 'Sliced right' : 'Dragged left', [seg], 0.5, 0.8);
}

// How close the ball's edge comes to a box, as drawn (negative: it overlaps).
function closest(frames: ShotFrames, box: Box): number {
  let best = Infinity;
  for (let ms = 0; ms < frames.flight; ms += 1) {
    const at = sampleShot(frames, ms);
    if (!at) continue;
    const dx = Math.max(box.x - at.x, 0, at.x - (box.x + box.width));
    const dy = Math.max(box.y - at.y, 0, at.y - (box.y + box.height));
    best = Math.min(best, Math.hypot(dx, dy) - (ball / 2) * at.scale);
  }
  return best;
}

// At rest the ball touches the crossbar; a goal may come that close to a bar,
// give or take a quarter point, and no closer.
const TOUCH = -0.25;

function clearsFrame(frames: ShotFrames, corner: Point): boolean {
  const crossbar = { ...corner, width: arm, height: bar };
  const post = { x: corner.x + arm - bar, y: corner.y, width: bar, height: arm };
  return closest(frames, crossbar) >= TOUCH && closest(frames, post) >= TOUCH;
}

function item<T>(list: readonly T[], k: number): T {
  const found = list[k];
  if (found === undefined) throw new Error(`No shot at ${k}`);
  return found;
}

// A shape at random, never the previous one.
function pick(names: readonly ShotName[], previous: ShotName | null, r: Rng): number {
  let k = Math.floor(r() * names.length);
  if (names[k] === previous) k = (k + 1 + Math.floor(r() * (names.length - 1))) % names.length;
  return k;
}

const TRAIL_END = Math.max(...spotlightMotion.shot.trail.map((ghost) => ghost.delay));

export function planShot(input: ShotInput): ShotPlan {
  const r = createRng(input.seed);
  const { width, height } = input.bounds;
  const clamp = (p: Point): Point => ({
    x: Math.min(width - EDGE, Math.max(EDGE, p.x)),
    y: Math.min(height - FLOOR, Math.max(-CEILING, p.y)),
  });

  if (input.verdict === 'goal') {
    const shape = item(GOALS, pick(GOAL_SHOTS, input.previous, r));
    const draw: GoalDraw = {
      side: r() < 0.5 ? -1 : 1,
      jitter: 0.85 + r() * 0.3,
      open: rot(norm({ x: -0.6, y: 0.8 }), (r() - 0.5) * 30),
    };
    const flight = Math.round(durations.shotFlight * shape.speed);
    const after = Math.max(durations.shotSettle, durations.cornerShake, durations.ring, TRAIL_END);
    const goal = (steer: number): ShotPlan => ({
      name: shape.name,
      verdict: 'goal',
      frames: framesOf(goalPath(input, shape, draw, steer, clamp), flight),
      impact: flight,
      end: flight + after,
    });
    for (const steer of STEER) {
      const plan = goal(steer);
      if (clearsFrame(plan.frames, input.corner)) return plan;
    }
    return goal(1);
  }

  const flight = Math.round(durations.shotFlight * MISS_SPEED);
  const miss = (path: Path): ShotPlan => ({
    name: path.name,
    verdict: 'miss',
    frames: framesOf(path, flight),
    impact: Math.round(flight * path.mark),
    end: flight + TRAIL_END,
  });
  // The shape picked first, then the others; each re-rolled until it stays
  // clear of the corner.
  const first = pick(MISS_SHOTS, input.previous, r);
  const order = [
    first,
    ...MISSES.map((_, k) => k).filter((k) => k !== first && MISS_SHOTS[k] !== input.previous),
  ];
  for (const k of order) {
    for (let i = 0; i < REROLLS; i++) {
      const plan = miss(missPath(input, item(MISSES, k), r, clamp));
      const box = { ...input.corner, width: arm, height: arm };
      if (closest(plan.frames, box) >= spotlightMotion.shot.clearance) return plan;
    }
  }
  const away = input.corner.x + arm / 2 < width / 2;
  const right = away ? input.previous !== 'Sliced right' : input.previous === 'Dragged left';
  return miss(flatMiss(input, right));
}

function mix(values: number[], i: number, t: number): number {
  'worklet';
  const a = values[i] ?? 0;
  const b = values[i + 1] ?? a;
  return a + (b - a) * t;
}

/** The ball `ms` after the strike, blended between the planned steps; null
 *  before the strike and from the end of the flight on. A worklet: the
 *  overlay calls it on the UI thread every frame. */
export function sampleShot(frames: ShotFrames, ms: number): ShotSample | null {
  'worklet';
  const steps = frames.x.length - 1;
  if (steps < 1 || !(ms >= 0) || ms >= frames.flight) return null;
  const at = (ms / frames.flight) * steps;
  const i = Math.floor(at);
  const t = at - i;
  return {
    x: mix(frames.x, i, t),
    y: mix(frames.y, i, t),
    scale: mix(frames.scale, i, t),
    opacity: mix(frames.opacity, i, t),
  };
}

/** Where the ball is struck from: the tap, when the press carried one on the
 *  tile, else the tile's centre (a screen reader's activation carries none). */
export function shotOrigin(tap: Point | null, tile: Box | null): Point | null {
  if (!tile) return tap;
  const onTile =
    tap !== null &&
    tap.x >= tile.x &&
    tap.x <= tile.x + tile.width &&
    tap.y >= tile.y &&
    tap.y <= tile.y + tile.height;
  return onTile ? tap : { x: tile.x + tile.width / 2, y: tile.y + tile.height / 2 };
}
