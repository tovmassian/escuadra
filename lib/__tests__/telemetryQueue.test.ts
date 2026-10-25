import { describe, expect, it } from 'vitest';
import {
  QUEUE_LIMIT,
  QUEUE_MAX_AGE_MS,
  flushOutcome,
  trimQueue,
  withoutSent,
  type QueuedSignal,
} from '../telemetryQueue';

const NOW = Date.parse('2026-10-26T12:00:00.000Z');
const at = (ms: number, n = 0): QueuedSignal => ({
  type: 'round.completed',
  n,
  receivedAt: new Date(ms).toISOString(),
});

describe('trimQueue', () => {
  it('keeps the newest signals up to the limit', () => {
    const queue = Array.from({ length: QUEUE_LIMIT + 2 }, (_, n) => at(NOW, n));
    const kept = trimQueue(queue, NOW);
    expect(kept).toHaveLength(QUEUE_LIMIT);
    expect(kept[0]?.n).toBe(2);
    expect(kept.at(-1)?.n).toBe(QUEUE_LIMIT + 1);
  });

  it('drops a signal older than the age limit, and keeps one just inside it', () => {
    const old = at(NOW - QUEUE_MAX_AGE_MS - 1, 1);
    const edge = at(NOW - QUEUE_MAX_AGE_MS, 2);
    expect(trimQueue([old, edge], NOW)).toEqual([edge]);
  });

  it('drops a signal whose time cannot be read', () => {
    expect(trimQueue([{ type: 'x' }, { type: 'y', receivedAt: 'soon' }], NOW)).toEqual([]);
  });
});

describe('flushOutcome', () => {
  it.each([200, 202, 204])('counts %i as sent', (status) => {
    expect(flushOutcome(status)).toBe('sent');
  });

  it.each([null, 408, 429, 500, 503])('keeps the batch on %s, to try again', (status) => {
    expect(flushOutcome(status)).toBe('kept');
  });

  it.each([400, 401, 404, 413])(
    'drops a batch refused with %i, which would never succeed',
    (status) => {
      expect(flushOutcome(status)).toBe('dropped');
    },
  );
});

describe('withoutSent', () => {
  it('removes exactly the signals handed over, even when an equal copy remains', () => {
    const a = at(NOW, 1);
    const b = at(NOW, 2);
    const copyOfA = { ...a };
    expect(withoutSent([a, b, copyOfA], [a])).toEqual([b, copyOfA]);
    expect(withoutSent([a, b, copyOfA], [a])[1]).toBe(copyOfA);
  });
});
