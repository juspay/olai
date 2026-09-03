/**
 * A REGISTRY — a table plugins write into and a host reads, with the entry held
 * by the writing plugin's scope.
 *
 * ## What it is, beside {@link ./broadcast.ts}
 *
 * The two are the plugin runtime's two shapes and they are not the same one. A
 * BUS is told and forgets: nothing is kept, and a handler that leaves leaves no
 * hole. A REGISTRY holds a value for as long as the plugin that wrote it is
 * loaded, and the whole point of it is what a READER sees — the vocabulary a
 * validator judges with, the siblings a wire composes, the faces a page draws.
 *
 * ## The three rules, and every one of them was written per site
 *
 * **A key is claimed once.** A second claim on one key is refused rather than
 * resolved: the assembly underneath is a `Map.set`, so the loser would be
 * overwritten with nothing red anywhere — one plugin's `admits` quietly judging
 * another plugin's values, one plugin's face quietly replacing another's. The
 * MESSAGE is the calling site's, because only it knows what a collision means
 * there; the refusal is not.
 *
 * **The entry goes before the failure does.** {@link Registry.claim} tells the
 * host it changed, and a host that REFUSES throws out of that call. A failure in
 * `acquire` is a resource that was never acquired, so the release never runs and
 * a naive `set(); changed()` leaves the entry behind. What that cost, once: the
 * refusing plugin landed `failed` — which is what the containment claim says —
 * and its entry was still in the table, so the NEXT plugin to register re-ran
 * the host's re-compose, which retried the same refused mount and threw inside
 * THAT plugin's `apply`. One mis-shaped surface took down every plugin that
 * arrived after it, each failing on somebody else's refusal, and the table went
 * on reporting the refused one as present.
 *
 * That rule was enforced in one of the four hand-written copies and documented
 * at length there; the tab's slot table had the same reachable failure with no
 * comment anywhere near it. It is mechanical here.
 *
 * **NOT re-notified on the way out of a refusal.** The host never took the entry,
 * so deleting it puts the table back exactly where the last successful change
 * left it and there is nothing for a re-read to do. Telling it again would be
 * re-entering it from inside a failure.
 */

import { Effect, Scope } from "effect"

/** ONE TABLE. */
export interface Registry<K, V> {
  /**
   * Claim a key for as long as the calling plugin's scope is open.
   *
   * `refuse` is asked ONLY when the key is already held, and answers the whole
   * sentence — the value that holds it is passed in, because the two collisions
   * that matter say different things about it ("`kolu` and `odu` both
   * contribute…" needs the holder; "`kolu` registered a second…" does not).
   */
  readonly claim: (
    key: K,
    value: V,
    refuse: (held: V) => string,
  ) => Effect.Effect<void, never, Scope.Scope>
  /** Every entry held right now, in claim order. A COPY: a reader that could
   *  write into the table would be a second writer. */
  readonly read: () => ReadonlyMap<K, V>
}

/**
 * Open one.
 *
 * `changed` is told after every claim and every release — the host's re-read.
 * Absent on a table nobody is serving from, which is every bench that only wants
 * the entries.
 */
export const registry = <K, V>(changed?: () => void): Registry<K, V> => {
  const table = new Map<K, V>()
  return {
    claim: (key, value, refuse) =>
      Effect.acquireRelease(
        // SUSPENDED so the table is read at the moment the claim TAKES rather
        // than where `claim` was called. A plugin that unloads and comes back
        // re-runs its `apply` after its finalizers have taken the key back out;
        // a snapshot taken at the call would still say the key was held and
        // would refuse the plugin the entry it had just unwound.
        Effect.suspend(() => {
          const already = table.get(key)
          if (already !== undefined) return Effect.die(new Error(refuse(already)))
          table.set(key, value)
          try {
            changed?.()
          } catch (refused) {
            // THE ENTRY GOES BEFORE THE FAILURE DOES — see the header.
            table.delete(key)
            return Effect.die(refused)
          }
          return Effect.succeed(key)
        }),
        (key) =>
          Effect.sync(() => {
            table.delete(key)
            changed?.()
          }),
      ).pipe(Effect.asVoid),
    read: () => new Map(table),
  }
}
