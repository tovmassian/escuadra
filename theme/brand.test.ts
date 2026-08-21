import { describe, expect, it } from 'vitest';
import { MARK_VIEWBOX, markGeometry } from './brand';

// The 2a mark's value is a clean silhouette in a single colour: the ball must
// not collide with either bar, or the shape muddies when everything is one
// fill (the monochrome Android layer, a tinted mark on a coloured plate).
// These tests pin that property so a later nudge to the geometry fails here
// rather than silently degrading the icon.
describe('Escuadra mark geometry', () => {
  const { crossbar, post, ball, trail } = markGeometry;

  it('keeps every shape inside the viewBox', () => {
    expect(crossbar.x + crossbar.w).toBeLessThanOrEqual(MARK_VIEWBOX);
    expect(crossbar.y + crossbar.h).toBeLessThanOrEqual(MARK_VIEWBOX);
    expect(post.x + post.w).toBeLessThanOrEqual(MARK_VIEWBOX);
    expect(post.y + post.h).toBeLessThanOrEqual(MARK_VIEWBOX);
    expect(ball.cx + ball.r).toBeLessThanOrEqual(MARK_VIEWBOX);
    expect(ball.cy + ball.r).toBeLessThanOrEqual(MARK_VIEWBOX);
    expect(ball.cx - ball.r).toBeGreaterThanOrEqual(0);
    expect(ball.cy - ball.r).toBeGreaterThanOrEqual(0);
    for (const t of trail) {
      expect(t.x + t.size).toBeLessThanOrEqual(MARK_VIEWBOX);
      expect(t.y + t.size).toBeLessThanOrEqual(MARK_VIEWBOX);
    }
  });

  it('leaves a gap between the ball and the crossbar', () => {
    const crossbarBottom = crossbar.y + crossbar.h;
    const ballTop = ball.cy - ball.r;
    expect(ballTop).toBeGreaterThan(crossbarBottom);
  });

  it('keeps the ball tangent to the post rather than overlapping it', () => {
    const ballRight = ball.cx + ball.r;
    expect(ballRight).toBeLessThanOrEqual(post.x);
  });

  it('forms a right angle: the post starts where the crossbar ends', () => {
    expect(post.x + post.w).toBe(crossbar.x + crossbar.w);
    expect(post.y).toBe(crossbar.y);
  });

  it('fades the trail progressively', () => {
    for (let i = 1; i < trail.length; i++) {
      const prev = trail[i - 1];
      const curr = trail[i];
      if (!prev || !curr) throw new Error('trail entries must exist');
      expect(curr.opacity).toBeLessThan(prev.opacity);
      expect(curr.size).toBeLessThan(prev.size);
    }
  });
});
