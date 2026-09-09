import type { CollectionFoldOptions } from "@kolu/surface/solid"

/** Observability must never become a writer of the state it observes. This
 * includes synchronous failures (withdrawn services, console hooks) as well
 * as rejected sends. The caller owns any asynchronous work and its lifetime. */
export const diagnostic = <A>(report: (event: A) => void): ((event: A) => void) =>
  (event) => {
    try { report(event) }
    catch {
      // Even a replaced console can throw. There is no second failure channel
      // here that is allowed to invalidate a fold or break a render effect.
      try { console.warn("chat diagnostic unavailable") } catch { /* best effort */ }
    }
  }

/** A failed projection still follows the surface's invalidation policy, but
 * reports independently of its accumulator. A failed observer never affects it. */
export const observedFold = <K, V, A>(
  fold: CollectionFoldOptions<K, V, A>,
  observe: (rows: ReadonlyArray<readonly [K, V]>, snapshot: boolean) => void,
  failed: () => void,
): CollectionFoldOptions<K, V, A> => {
  const seen = diagnostic<{ rows: ReadonlyArray<readonly [K, V]>; snapshot: boolean }>(observeEvent => observe(observeEvent.rows, observeEvent.snapshot))
  const failure = diagnostic(failed)
  return {
    init: (entries) => {
      try {
        const result = fold.init(entries)
        seen({ rows: entries, snapshot: true })
        return result
      } catch (cause) { failure(undefined); throw cause }
    },
    step: (held, frame) => {
      try {
        const result = fold.step(held, frame)
        seen({ rows: frame.upserts, snapshot: false })
        return result
      } catch (cause) { failure(undefined); throw cause }
    },
  }
}
