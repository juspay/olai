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
 *     scope it is run in is. That scope is the wire's own subscription, wrapped
 *     around the per-key `get` (`@olai/surface`'s `holding.ts`): the hold is
 *     taken when the subscription starts and dropped when it ends, whether it
 *     ends by a tab navigating, a socket dropping or a one-shot reader taking
 *     its frame and leaving.
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
 * TWO READERS OF ONE FILE ARE TWO HOLDS, and the first to leave takes its own
 * and nobody else's — the shape kolu's refcounted watchers landed on
 * (`refcounted-dir-watcher.ts`: first subscribe installs, all consumers share,
 * last unsubscribe tears down, and the unsubscribe is idempotent). Here the
 * idempotence is not written at all: a hold is an `acquireRelease` on the
 * reader's own scope, and a scope does not run its finalizer twice. The teardown
 * lesson from those watchers does survive as a line of our own: a path asked for
 * and then released before the reader got to it is DROPPED rather than read, so
 * a page opened and closed in one frame costs no disk.
 *
 * THE OTHER END OF THIS COUNT IS THE BROWSER'S, and it has always been there:
 * `@olai/web`'s `documents.tsx` counts the components asking for each path so
 * that one page's unmount cannot cancel another's subscription. The client knew
 * when a reader arrived and left all along; what changed is that the server can
 * hear it, and the two ends now keep the same kind of book.
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
   * A reader has this file OPEN, for the lifetime of the SCOPE this is run in —
   * which is the subscription's own (`@olai/surface`'s `holding.ts`). While any
   * scope holding it is open, the body is re-read on every revision that moves
   * the file; when the last one closes, it is not.
   *
   * A scope rather than a returned release function, because a lifetime with two
   * ends a caller has to pair by hand is a lifetime one interrupted caller
   * leaks. It reads nothing by itself either: whether this reader is owed a body
   * NOW is a question about the SET, which is answered where the set is read
   * ({@link Bodies.unread}, and `../runtime.ts`'s `readOne` is the caller).
   */
  readonly held: (path: string) => Effect.Effect<void, never, Scope.Scope>
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
    /**
     * How many readers are showing each path — the ONE representation of "who
     * is reading", and a path with none is absent from it rather than zero, so
     * this map IS the set of files somebody has open and there is nothing to
     * keep in step with it.
     *
     * It has to be readable on the spot: {@link Bodies.unread} is called from
     * the middle of a revision, and its other caller is the framework's
     * `readOne`, which is a plain synchronous function. That is what decided
     * this against `effect`'s `RcMap`, which is the ecosystem's own
     * refcount-by-key and was tried here first: its count is private and its
     * keys are read through an `Effect`, so it left a second set beside it to
     * answer the synchronous question — two accounts of one fact, and a lookup
     * whose "resource" was that second set rather than anything of its own.
     * `RcMap` is for sharing a scoped resource that HAS a value (a connection,
     * a session); what is shared here is the fact of being watched.
     */
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
      // The scope is the whole of the lifetime: acquiring counts this reader
      // in and the finalizer counts it out, exactly once, whatever ends the
      // subscription. That is where a release function's idempotence went — a
      // scope cannot run its finalizer twice, so there is no flag to remember.
      held: (path) =>
        Effect.acquireRelease(
          Effect.sync(() => {
            holders.set(path, (holders.get(path) ?? 0) + 1)
          }),
          () =>
            Effect.sync(() => {
              const count = holders.get(path) ?? 0
              if (count > 1) holders.set(path, count - 1)
              else holders.delete(path)
            }),
        ),
      unread: (paths) => {
        for (const path of paths) if (holders.has(path)) ask(path)
      },
    }
  })
