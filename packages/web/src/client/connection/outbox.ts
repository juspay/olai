/**
 * WHAT WAITS FOR THE SERVER — the diary's entries, in a bounded ring, until a
 * post the server took has carried them.
 *
 * The diary (`./diary.ts`) puts every entry it says here; the relay
 * (`./relay.ts`) reads what is pending, posts it, and acknowledges what the
 * server took. Neither needs the other: this is the one thing they share. When
 * the ring is full the oldest entry goes, and the count of what went is posted
 * with the next batch, so the server can say so.
 */
import type { Entry } from "@olai/log/link"

/** How many entries wait for the server before the oldest are dropped. */
export const RING_LIMIT = 200

export interface Outbox {
  /** Keep an entry for the server, and tell whoever listens. */
  put(entry: Entry): void
  /** What waits, oldest first, and how many were dropped. */
  pending(): { readonly entries: ReadonlyArray<Entry>; readonly lost: number }
  /** The server took everything through `seq`, and `lost` dropped entries. */
  acknowledge(seq: number, lost: number): void
  /** Hear each entry as it is put; the returned function stops hearing. */
  onEntry(listener: (entry: Entry) => void): () => void
}

export const createOutbox = (): Outbox => {
  const ring: Array<Entry> = []
  const listeners = new Set<(entry: Entry) => void>()
  let lost = 0
  return {
    put: (entry) => {
      if (ring.length >= RING_LIMIT) {
        ring.shift()
        lost += 1
      }
      ring.push(entry)
      for (const listener of listeners) listener(entry)
    },
    pending: () => ({ entries: [...ring], lost }),
    acknowledge: (through, taken) => {
      while (ring.length > 0 && ring[0]!.seq <= through) ring.shift()
      lost = Math.max(0, lost - taken)
    },
    onEntry: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
