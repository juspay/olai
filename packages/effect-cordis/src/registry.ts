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
 *
 * ## ...AND THE HALF UNDERNEATH BOTH OF THEM
 *
 * {@link roster} is what is left of the paragraph above when the key stops
 * meaning anything: *an entry held for as long as the scope that made it*. That
 * is the whole of what a bus's handler list and a waterfall's chain are, and
 * this module's own argument — that the registration half was written three
 * times before it had a name — was still true one level down, inside the
 * package that made it. It is not on the door: {@link ./broadcast.ts} and
 * {@link ./waterfall.ts} are what a host holds, and this is what they are built
 * from.
 *
 * The one rule of the three that a roster does NOT have is the first, and it is
 * the definition rather than an omission: there is no key, so there is nothing
 * to claim twice, and a plugin holding two entries is two entries. The other two
 * are the same rule word for word wherever a `changed` is passed — which is the
 * asymmetry the roster's own header used to argue it would never need, and no
 * longer does.
 *
 * ## THE COPY A READ HANDS BACK IS MADE ONCE PER CHANGE, not once per read
 *
 * Both `read`s answer with a copy, and the reason is unchanged: a reader that
 * could write into the table would be a second writer. What changed is when the
 * copy is MADE. It used to be on every call, which was free while both tables
 * were read a handful of times per revision — the siblings on a re-compose, the
 * vocabulary once at boot.
 *
 * The vocabulary stopped being read once at boot. It follows the fibers now
 * (`@olai/server`'s `propKinds.ts`), so `kinds()` is asked wherever a value is
 * held to its declared kind — which is per property drawn, on the path a page
 * is rendered from. A fresh `Map` per property is a real cost for a table that
 * moves when somebody presses a switch.
 *
 * So the copy is cached and dropped whenever the table moves, which is every
 * claim, every release and the delete on the way out of a refusal. Between two
 * changes a reader gets the SAME value back, which is stronger than what was
 * promised before and is what a downstream `equals` wants; across one it gets a
 * new one, which is the whole of what the caching may not break.
 */

import { Effect, Scope } from "effect"

/** AN APPEND-ONLY TABLE OF SCOPE-HELD ENTRIES, read in registration order. */
export interface Roster<V> {
  /** Hold this entry for as long as the calling plugin's scope is open. Nothing
   *  comes back, because there is no key worth naming: an entry is identified by
   *  the scope that made it. */
  readonly hold: (value: V) => Effect.Effect<void, never, Scope.Scope>
  /** Every entry held right now, in the order they were made. A COPY, which is
   *  what makes it safe to walk while a plugin unloading underneath removes one
   *  — and what a dispatch wants anyway, since what a dispatch is ABOUT is the
   *  set of plugins that were mounted when it started. The copy is remade when
   *  the table moves and not per read (see the header), which does not weaken
   *  that: a walk that began before a change is still walking the list the
   *  dispatch started on. */
  readonly read: () => ReadonlyArray<V>
}

/**
 * Open one.
 *
 * Keyed by a fresh symbol rather than held in an array, so a release is a delete
 * rather than an `indexOf` and a `splice` — two plugins holding the same entry
 * VALUE are two entries, and dropping one leaves the other.
 *
 * ## `changed` IS A PARAMETER NOW, and this paragraph said it never would be
 *
 * It said: *no `changed`, unlike its keyed sibling, and the asymmetry is real
 * rather than an omission — nothing is SERVED from a roster. Its two readers ask
 * it fresh at the moment they need an answer, once per conversation opening for
 * the session-start probes and once per dispatch for a bus, so there is no
 * derived value sitting downstream that could go stale between reads.*
 *
 * Every clause of that is true of the two readers this package had, and none of
 * it is a property of the SHAPE. The tab's list slots
 * (`@olai/plugin-api`'s `SLOTS`) are a roster a PAGE DRAWS FROM, and a drawing
 * is precisely the derived value sitting downstream: a section whose plugin
 * unloaded stays on screen until something says the table moved. The keyed
 * sibling has been telling its host that since it was written; a list slot needs
 * the same sentence for the same reason, and the alternative — a synthetic
 * `plugin#2` key so that a list could ride on {@link registry} — buys the
 * notification by giving up the one rule the key was for, and leaves a
 * claim-once refusal message that can no longer be true.
 *
 * So it is a PARAMETER: absent for the two readers that ask fresh, which pay
 * nothing and are told nothing, and present for a table something is served
 * from. What it brings with it is the other two rules verbatim — THE ENTRY GOES
 * BEFORE THE FAILURE DOES, and no re-notification on the way out of a refusal —
 * because a host that refuses a re-read throws out of `changed` here exactly as
 * it does one function down, and an `acquire` that failed never runs its
 * release.
 */
export const roster = <V>(changed?: () => void): Roster<V> => {
  const held = new Map<symbol, V>()
  // THE COPY, HELD UNTIL THE TABLE MOVES — see the header's last paragraph.
  let copy: ReadonlyArray<V> | null = null
  return {
    hold: (value) =>
      Effect.acquireRelease(
        // SUSPENDED for its sibling's reason: the entry is made at the moment
        // the hold TAKES rather than where `hold` was called, so a plugin that
        // unloaded and came back is holding again rather than holding twice.
        Effect.suspend(() => {
          const at = Symbol()
          held.set(at, value)
          copy = null
          try {
            changed?.()
          } catch (refused) {
            held.delete(at)
            copy = null
            return Effect.die(refused)
          }
          return Effect.succeed(at)
        }),
        (at) =>
          Effect.sync(() => {
            held.delete(at)
            copy = null
            changed?.()
          }),
      ).pipe(Effect.asVoid),
    read: () => copy ??= [...held.values()],
  }
}

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
   *  write into the table would be a second writer — and the SAME copy until
   *  the table next moves, which is what makes reading it per property draw
   *  affordable (see the header). */
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
  // THE COPY, HELD UNTIL THE TABLE MOVES — see the header's last paragraph.
  // This is the one the vocabulary is read out of, and the reason the caching
  // exists at all.
  let copy: ReadonlyMap<K, V> | null = null
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
          copy = null
          try {
            changed?.()
          } catch (refused) {
            // THE ENTRY GOES BEFORE THE FAILURE DOES — see the header.
            table.delete(key)
            copy = null
            return Effect.die(refused)
          }
          return Effect.succeed(key)
        }),
        (key) =>
          Effect.sync(() => {
            table.delete(key)
            copy = null
            changed?.()
          }),
      ).pipe(Effect.asVoid),
    read: () => copy ??= new Map(table),
  }
}
