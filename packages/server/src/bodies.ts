/**
 * The bodies nobody keeps: a `.html` read when somebody opens it, and let go.
 *
 * The set holds every served file's PATH and the text of the ones it has to
 * judge — an outline's records, a document's text — and it deliberately does
 * not hold a saved page's bytes (`@olai/format`'s `kinds.ts`, which owns that
 * decision and says why). What is left over is one job, and this module is it:
 * the reader who OPENS such a file still has to be handed its content.
 *
 * Two facts drive it, and they are the only two:
 *
 *   - {@link Bodies.held} — a reader HAS this key open, for as long as the
 *     release it answers with is uncalled. That is the wire's own subscription
 *     lifetime, wrapped around the per-key `get` (`@olai/surface`'s
 *     `holding.ts`): the hold is taken when the subscription starts and dropped
 *     when it ends, whether it ends by a tab navigating, a socket dropping or a
 *     one-shot reader taking its frame and leaving.
 *   - {@link Bodies.unread} — paths whose body is not on the wire
 *     (`./published.ts`'s `unread`), from the two moments that produce them: a
 *     reader that has just subscribed to a key the set holds a path and no text
 *     for, and a published revision naming the bodied files that changed. The
 *     ones somebody HOLDS are read; the rest are not touched, so a `git pull`
 *     that rewrites four hundred saved pages nobody has open reads none of
 *     them.
 *
 * WHAT IS HELD is a count of readers per PATH and nothing else — never a body.
 * The bodies themselves are read one at a time and handed straight to the
 * publisher, so what this costs at any instant is one file, and what it costs at
 * rest is nothing. That is the whole of the memory claim: a served directory's
 * saved pages stop being resident, and stay non-resident however many of them a
 * reader visits.
 *
 * NOTHING IS EVICTED AND THERE IS NO BOUND, because there is no longer anything
 * to guess. A path is here while a reader holds it and gone the moment the last
 * one lets go, so the live set is exactly the pages somebody has open — one
 * entry per file being shown, across every reader at once. It was a bounded LRU
 * of the sixteen most recently opened paths for as long as the wire said when a
 * reader arrived and never when one left; that made "no eviction" untrue rather
 * than merely unlikely (sixteen newer opens anywhere silenced a still-visible
 * page, which then held what the file said when it was asked for), and it made a
 * closed tab leave a path behind that was re-read on every revision touching it
 * until sixteen newer opens pushed it out. Both were the cost of not knowing
 * when a reader leaves. The wire says now.
 *
 * A RELEASE IS IDEMPOTENT and holds do not merge: two readers of one file are
 * two holds, and the first to leave takes its own hold and nobody else's — the
 * shape kolu's refcounted watchers landed on (`refcounted-dir-watcher.ts`:
 * first subscribe installs, all consumers share, last unsubscribe tears down).
 * The teardown half is here too: a path asked for and then released before the
 * reader got to it is DROPPED rather than read, so a page opened and closed in
 * one frame costs no disk at all.
 *
 * ONE failure is quieter than it used to be, and it is a trade rather than an
 * oversight: a `.html` that cannot be READ (not gone — unreadable) reaches the
 * log, and the reader sees the page it already had, with no body under the
 * heading. Before this, the probe read every `.html` on every pass, so one
 * unreadable saved page failed the whole probe and put a banner over the WHOLE
 * directory. The banner is the louder answer and it was also the wrong blast
 * radius; naming this one on its own page needs a way for an entry to say
 * "refused", which the wire has no field for yet.
 */

import type { PlatformFailure } from "@olai/store"
import { Effect, Queue, type Scope } from "effect"

export interface Bodies {
  /**
   * A reader has this file OPEN — read its body for them, and go on re-reading
   * it on every revision that moves the file until they let go.
   *
   * What comes back is that ONE reader leaving, and calling it twice is calling
   * it once. It reads nothing by itself: whether this reader is owed a body now
   * is a question about the SET, which is answered where the set is read
   * ({@link Bodies.unread}, and `../runtime.ts`'s `readOne` is the caller).
   */
  readonly held: (path: string) => () => void
  /** These files' bodies are not on the wire. The ones somebody is holding are
   *  read and published; the rest are not touched. */
  readonly unread: (paths: Iterable<string>) => void
}

export interface Options {
  /** One file's text, read now and kept by nobody — `@olai/store`'s `body`,
   *  which is the only reader of the disk this module is allowed. */
  readonly read: (path: string) => Effect.Effect<string | null, PlatformFailure>
  /** Hand a body to whoever is reading that key. Called on the reading fiber,
   *  once per read that found something. */
  readonly publish: (path: string, text: string) => void
}

export const make = (
  options: Options,
): Effect.Effect<Bodies, never, Scope.Scope> =>
  Effect.gen(function*() {
    /** How many readers hold each path. A path with none is ABSENT rather than
     *  zero, so the map is the set of files somebody is showing and nothing
     *  else — which is the same thing as "what to re-read", and one
     *  representation of it cannot disagree with itself. */
    const holders = new Map<string, number>()
    /** What is on the queue and not yet taken, so a burst of asks about one
     *  file is one read. A path is forgotten the moment the reader TAKES it,
     *  which is what keeps a change arriving mid-read from being swallowed. */
    const asked = new Set<string>()
    const queue = yield* Queue.unbounded<string>()

    const ask = (path: string): void => {
      if (asked.has(path)) return
      asked.add(path)
      Queue.offerUnsafe(queue, path)
    }

    // ONE at a time, on purpose: the peak this module can be responsible for is
    // one body, whatever a burst of readers asks for. They are megabyte files,
    // and reading a dozen of them at once to hand them over one frame at a time
    // would be the residency this exists to remove, spent all at once.
    yield* Effect.forever(
      Effect.gen(function*() {
        const path = yield* Queue.take(queue)
        asked.delete(path)
        // The reader LEFT while this sat on the queue. Reading now would be a
        // disk read for a page nobody is showing, and publishing it would be a
        // frame to a subscription that has gone — the late callback kolu's
        // watchers clear their timers to prevent.
        if (!holders.has(path)) return
        const text = yield* Effect.catch(
          options.read(path),
          (failure: PlatformFailure) =>
            Effect.as(
              Effect.logWarning(`olai server: ${failure.message}`),
              // Nothing is published, so the reader keeps the entry it has —
              // which says the body is not here. See the header.
              null,
            ),
        )
        // `null` is a file that has GONE between the listing and now, which is
        // not this module's news to break: the next probe drops the key, the
        // sidebar loses the file, and the page says there is no such file.
        if (text !== null) options.publish(path, text)
      }),
    ).pipe(Effect.forkScoped)

    return {
      held: (path) => {
        holders.set(path, (holders.get(path) ?? 0) + 1)
        let holding = true
        return () => {
          if (!holding) return
          holding = false
          const count = holders.get(path)
          if (count === undefined || count <= 1) holders.delete(path)
          else holders.set(path, count - 1)
        }
      },
      unread: (paths) => {
        for (const path of paths) if (holders.has(path)) ask(path)
      },
    }
  })
