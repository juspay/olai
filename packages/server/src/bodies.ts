/**
 * The bodies nobody keeps: a `.html` read when somebody opens it, and let go.
 *
 * The set holds every served file's PATH and the text of the ones it has to
 * judge — an outline's records, a document's text — and it deliberately does
 * not hold a saved page's bytes (`@olai/format`'s `kinds.ts`, which owns that
 * decision and says why). What is left over is one job, and this module is it:
 * the reader who OPENS such a file still has to be handed its content.
 *
 * Two moments ask for a body, and they are the only two:
 *
 *   - {@link Bodies.opened} — a per-key `get` snapshot, which is the wire's own
 *     word for "somebody is showing this file". The collection's entry says
 *     `text: null` while the read is in flight, and the body arrives on that
 *     key's next frame (`@olai/surface`'s `DocumentEntry`).
 *   - {@link Bodies.moved} — a published revision naming files that changed. A
 *     body is re-read only for a file somebody is WATCHING, so a `git pull`
 *     that rewrites four hundred saved pages nobody has open reads none of
 *     them, and the one page somebody does have open updates as it always did.
 *
 * WHAT IS HELD is a bounded set of PATHS and nothing else — never a body. The
 * bodies themselves are read one at a time and handed straight to the
 * publisher, so what this costs at any instant is one file, and what it costs
 * at rest is nothing. That is the whole of the memory claim: a served
 * directory's saved pages stop being resident, and stay non-resident however
 * many of them a reader visits.
 *
 * The bound on the watched paths is what makes "no eviction" untrue rather than
 * merely unlikely ({@link WATCHING}). Losing the oldest costs live updates on a
 * page somebody stopped looking at; it never costs a body, because opening one
 * asks again.
 *
 * It is a bound rather than a lifetime because there is no socket for the
 * lifetime to come out of: the wire says when a reader OPENS a key and nothing
 * says when the last one lets go — the framework owns subscription lifetime and
 * does not publish it. So "who is watching" is inferred from opens and aged
 * out, which is the honest approximation of a fact this process cannot see. A
 * `keys`-style member for "who holds this key" upstream is what would replace
 * it, and until one exists the bound is the whole of the eviction story.
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
  /** A reader has opened this file — read its body and publish it. */
  readonly opened: (path: string) => void
  /** These files moved on the revision just published. The ones somebody is
   *  watching are re-read; the rest are not touched. */
  readonly moved: (changed: Iterable<string>) => void
}

export interface Options {
  /** One file's text, read now and kept by nobody — `@olai/store`'s `body`,
   *  which is the only reader of the disk this module is allowed. */
  readonly read: (path: string) => Effect.Effect<string | null, PlatformFailure>
  /** Hand a body to whoever is reading that key. Called on the reading fiber,
   *  once per read that found something. */
  readonly publish: (path: string, text: string) => void
  /** How many paths to keep watching. Tests set it; nothing else does. */
  readonly watching?: number
}

/**
 * How many paths a server goes on refreshing bodies for.
 *
 * It bounds a set of STRINGS, so the number is not about memory — it is about
 * work: a path stays here after the tab that opened it has gone, and every
 * change to that file would otherwise be re-read forever. Comfortably more than
 * the pages one person reads at once, and small enough that a session spent
 * browsing a vault of saved pages does not accumulate.
 */
export const WATCHING = 16

export const make = (
  options: Options,
): Effect.Effect<Bodies, never, Scope.Scope> =>
  Effect.gen(function*() {
    const limit = options.watching ?? WATCHING
    /** Insertion-ordered, oldest first — a `Set` is the whole LRU, since the
     *  only two operations are "touch this path" and "drop the stalest". */
    const watching = new Set<string>()
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
    // and reading sixteen of them at once to hand them over one frame at a time
    // would be the residency this exists to remove, spent all at once.
    yield* Effect.forever(
      Effect.gen(function*() {
        const path = yield* Queue.take(queue)
        asked.delete(path)
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
      opened: (path) => {
        watching.delete(path)
        watching.add(path)
        if (watching.size > limit) {
          const [stalest] = watching
          if (stalest !== undefined) watching.delete(stalest)
        }
        ask(path)
      },
      moved: (changed) => {
        for (const path of changed) if (watching.has(path)) ask(path)
      },
    }
  })
