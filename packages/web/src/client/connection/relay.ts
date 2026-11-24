/**
 * THE DIARY'S WAY TO THE SERVER — what the tab has said about its connection,
 * posted to the server so its log is the one place to read it.
 *
 * Over plain HTTP, not the socket the diary is about: a socket that will not
 * open cannot carry the news that it will not open. But only while the server
 * is known to be answering this tab — its latest socket is open, or it has
 * just retired the tab, which is an answer too. A post to a server that is not
 * there fails in the browser's console as well as here, and says nothing the
 * next open will not carry: what the tab saw while it could not reach the
 * server waits in the ring, and the next `Opened` sends it at once.
 *
 * Entries leave the diary's ring only when the server answered 2xx; anything
 * else leaves them there for the next try, which is the next entry (a second
 * after it, so a burst is one post) or the next `Opened`. A 404 means this
 * serve has no diary route (its `ws` row is off): the relay stops until the
 * page is reloaded. On `pagehide`, if the server was answering, whatever is
 * left goes in one beacon.
 *
 * `wire.ts`'s root owns the relay: its timer and its subscription to the diary
 * go with {@link DiaryRelay.dispose}.
 */
import type { Entry } from "@olai/log/link"
import type { Diary, Timers } from "./diary.ts"

/** The most one post carries: `keepalive` and `sendBeacon` both stop at 64 KiB,
 *  and the batch's own envelope needs a little of it. */
export const POST_BUDGET_BYTES = 60 * 1024
/** The most entries one post carries (the batch schema's own bound). */
export const POST_ENTRIES = 500
/** How long after an entry the relay waits, so a burst is one post. */
export const POST_AFTER_MS = 1_000

export interface DiaryRelay {
  /** The page is going away: send what is left, in one beacon, when the
   *  server was `reachable` a moment ago. */
  readonly leaving: (reachable: boolean) => void
  readonly dispose: () => void
}

export const relayDiary = (options: {
  readonly diary: Diary
  /** Post a body; resolves with the response's status. */
  readonly post: (body: string) => Promise<number>
  /** Hand a body to the browser to send after the page is gone. */
  readonly beacon: (body: string) => void
  readonly timers: Timers
}): DiaryRelay => {
  const { diary } = options
  const encoder = new TextEncoder()
  let stopped = false
  let posting = false
  let cancel: (() => void) | undefined

  /** The oldest entries that fit one post, and what acknowledging it means. */
  const batch = () => {
    const { entries, lost } = diary.pending()
    const taken: Array<Entry> = []
    let bytes = 0
    for (const entry of entries) {
      const size = encoder.encode(JSON.stringify(entry)).length + 1
      if (taken.length >= POST_ENTRIES || bytes + size > POST_BUDGET_BYTES) break
      taken.push(entry)
      bytes += size
    }
    return {
      body: JSON.stringify({ tab: diary.tab, entries: taken, lost }),
      through: taken.at(-1)?.seq ?? 0,
      lost,
      empty: taken.length === 0 && lost === 0,
      more: taken.length < entries.length,
    }
  }

  /** Post the oldest entries, when the server is answering — or `regardless`,
   *  when it has just answered in a way the socket cannot show. */
  const flush = (regardless = false): void => {
    if (stopped || posting || !(regardless || diary.open())) return
    const next = batch()
    if (next.empty) return
    posting = true
    options.post(next.body).then(
      (status) => {
        posting = false
        if (status === 404) {
          stopped = true
          return
        }
        if (status < 200 || status >= 300) return
        diary.acknowledge(next.through, next.lost)
        if (next.more) flush()
      },
      () => {
        posting = false
      },
    )
  }

  const after = (regardless: boolean) => {
    cancel = options.timers.set(() => {
      cancel = undefined
      flush(regardless)
    }, POST_AFTER_MS)
  }

  const unsubscribe = diary.onEntry((entry) => {
    switch (entry.event._tag) {
      case "Opened":
        cancel?.()
        cancel = undefined
        flush()
        return
      // The server answered the handshake by retiring this tab, so it is up;
      // wait out the settle so the socket's own drop goes in the same post.
      case "Retired":
        cancel?.()
        after(true)
        return
      default:
        if (cancel === undefined) after(false)
    }
  })

  return {
    leaving: (reachable) => {
      if (stopped || !reachable) return
      const last = batch()
      if (!last.empty) options.beacon(last.body)
    },
    dispose: () => {
      unsubscribe()
      cancel?.()
      cancel = undefined
    },
  }
}
