/**
 * THE DIARY'S WAY TO THE SERVER — what waits in the outbox (`./outbox.ts`),
 * posted to the server so its log is the one place to read it.
 *
 * Over plain HTTP, not the socket the diary is about: a socket that will not
 * open cannot carry the news that it will not open. So the relay never asks
 * the socket whether to post. It posts when there is something to post: a
 * second after an entry (so a burst is one post), at once on `Opened`, and
 * every {@link RETRY_EVERY_MS} while anything is still waiting after a post
 * the server did not take. Entries leave the outbox only on a 2xx, and after
 * one the relay posts again whatever is waiting. A 404 means this serve has no
 * diary route (it predates one): the relay stops until the page is reloaded.
 * On `pagehide` whatever is left goes in one beacon.
 *
 * Two timers, on purpose: one gathers a burst of entries into a post a second
 * later, the other backs off after a refused post. Each answers to its own
 * reason, and an entry's post is never held back behind a retry's.
 *
 * `wire.ts`'s root owns the relay: its timers and its subscription to the
 * outbox go with `dispose`.
 */
import type { Entry } from "@olai/log/link"
import type { Timers } from "./diary.ts"
import type { Outbox } from "./outbox.ts"

/** The most one post carries: `keepalive` and `sendBeacon` both stop at 64 KiB,
 *  and the batch's own envelope needs a little of it. */
const POST_BUDGET_BYTES = 60 * 1024
/** The most entries one post carries (the batch schema's own bound). */
const POST_ENTRIES = 500
/** How long after an entry the relay waits, so a burst is one post. */
export const POST_AFTER_MS = 1_000
/** How often the relay tries again while a post the server did not take
 *  leaves entries waiting. */
export const RETRY_EVERY_MS = 10_000

export const relayDiary = (options: {
  readonly outbox: Outbox
  /** The tab the entries are from, named on every post. */
  readonly tab: string
  /** Post a body; resolves with the response's status. */
  readonly post: (body: string) => Promise<number>
  /** Hand a body to the browser to send after the page is gone. */
  readonly beacon: (body: string) => void
  readonly timers: Timers
}): { readonly leaving: () => void; readonly dispose: () => void } => {
  const { outbox } = options
  const encoder = new TextEncoder()
  let stopped = false
  let posting = false
  /** The post an entry asked for, a second out. */
  let soon: (() => void) | undefined
  /** The next try after a post the server did not take. */
  let retry: (() => void) | undefined

  /** The oldest entries that fit one post, and what acknowledging it means. */
  const batch = () => {
    const { entries, lost } = outbox.pending()
    const taken: Array<Entry> = []
    let bytes = 0
    for (const entry of entries) {
      const size = encoder.encode(JSON.stringify(entry)).length + 1
      if (taken.length >= POST_ENTRIES || bytes + size > POST_BUDGET_BYTES) break
      taken.push(entry)
      bytes += size
    }
    return {
      body: JSON.stringify({ tab: options.tab, entries: taken, lost }),
      through: taken.at(-1)?.seq ?? 0,
      lost,
      empty: taken.length === 0 && lost === 0,
    }
  }

  const tryAgain = (): void => {
    if (retry !== undefined || stopped) return
    retry = options.timers.set(() => {
      retry = undefined
      flush()
    }, RETRY_EVERY_MS)
  }

  const flush = (): void => {
    if (stopped || posting) return
    const next = batch()
    if (next.empty) return
    posting = true
    options.post(next.body).then(
      (status) => {
        posting = false
        if (status === 404) {
          stopped = true
          retry?.()
          retry = undefined
          return
        }
        if (status < 200 || status >= 300) {
          tryAgain()
          return
        }
        outbox.acknowledge(next.through, next.lost)
        // Whatever is waiting now: what this batch left out, and what was said
        // while it was in flight, whose own post found this one still going.
        flush()
      },
      () => {
        posting = false
        tryAgain()
      },
    )
  }

  const unsubscribe = outbox.onEntry((entry) => {
    if (entry.event._tag === "Opened") {
      soon?.()
      soon = undefined
      flush()
      return
    }
    if (soon !== undefined) return
    soon = options.timers.set(() => {
      soon = undefined
      flush()
    }, POST_AFTER_MS)
  })

  return {
    leaving: () => {
      if (stopped) return
      const last = batch()
      if (!last.empty) options.beacon(last.body)
    },
    dispose: () => {
      unsubscribe()
      soon?.()
      retry?.()
      soon = undefined
      retry = undefined
    },
  }
}
