// The offline queue's rules (#221). Statistics are queued, not sent at once, so a
// round played without a connection is still counted when one comes back. What is
// kept, for how long, and what a response means for a batch, decided here, pure;
// `lib/telemetry.ts` does the sending and `stores/progress.ts` keeps the queue.

/** A signal as the TelemetryDeck SDK built it, ready to post. */
export type QueuedSignal = Record<string, unknown>;

/** The newest signals kept. */
export const QUEUE_LIMIT = 500;
/** The oldest a signal may be and still be sent: 30 days. */
export const QUEUE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** The queue, oldest first, without signals too old or past the limit. */
export function trimQueue(queue: readonly QueuedSignal[], now: number): QueuedSignal[] {
  const fresh = queue.filter((signal) => {
    const made = Date.parse(String(signal.receivedAt));
    return !Number.isNaN(made) && now - made <= QUEUE_MAX_AGE_MS;
  });
  return fresh.slice(-QUEUE_LIMIT);
}

export type FlushOutcome = 'sent' | 'kept' | 'dropped';

/**
 * What a flush's response means for the batch it carried. No response (offline,
 * a timeout) and the server's own trouble keep it for the next flush; any other
 * refusal drops it, since sending it again would only be refused again.
 */
export function flushOutcome(status: number | null): FlushOutcome {
  if (status === null) return 'kept';
  if (status >= 200 && status < 300) return 'sent';
  if (status === 408 || status === 429 || status >= 500) return 'kept';
  return 'dropped';
}

/** The queue without the signals handed to a flush, by identity, not by value. */
export function withoutSent(
  queue: readonly QueuedSignal[],
  sent: readonly QueuedSignal[],
): QueuedSignal[] {
  const handed = new Set(sent);
  return queue.filter((signal) => !handed.has(signal));
}
