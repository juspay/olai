/**
 * SEARCH'S SERVER HALF — one table, one walk, and the door they stand behind.
 *
 * `@olai/index` was a general package and `@olai/ops` held the walk that spends
 * it. They are this row now. Core defines a `Search` door (`@olai/ops`'
 * `Search`); `search.nodes` and the `search_nodes` tool are the one member that
 * calls through it, and they refuse in words when nobody is mounted.
 *
 * ## What is on this side of the wall, and what is not
 *
 * Here: the trigram table ({@link ./table.ts}), the walk over it, the ranking,
 * the cap and the situating of a hit ({@link ./matcher.ts}).
 *
 * Not here, and deliberately: the GRAMMAR (`@olai/format`'s `filter.ts` — one
 * matcher, five doors, and a row holding a second reading of `is:done` is the
 * exact drift the whole seam exists against), the gated READ (`@olai/ops`, so
 * an answer and the write gate see one store), the CLOCK, and the kind
 * VOCABULARY this serve runs. All four arrive through the door, which is why
 * this file has no `Vault` in its `needs`: a row that read the vault for itself
 * would answer a revision of its own choosing, and the candidates a table hands
 * back are only ever right about the snapshot they were brought level with.
 *
 * ## The table's lifetime is this fiber's
 *
 * It used to be `@olai/ops`' `make`, opened where the store is named and never
 * closed — an `Ops` has no teardown, so the truthful sentence there was "the
 * process owns it". A row does have one: the table is acquired on this plugin's
 * scope and closed by its finalizer, so switching the row off from the
 * preferences panel gives the memory back, and switching it on again builds a
 * table that is level with the next reading it is handed.
 */

import { definePlugin, Offers, Search } from "@olai/plugin-api/services"
import type { KindVocabulary, Reading, SearchRequest } from "@olai/format"
import { Effect } from "effect"

import { name } from "./index.ts"
import { search } from "./matcher.ts"
import { open } from "./table.ts"

/** The plugin's word, re-exported for the reason every tenant's server door
 *  re-exports it: one entry per plugin, and one spelling of the key — and
 *  because `@olai/bundle` reads it off the module its ROW names to prove that a
 *  plugin answers to the id its fiber is bound under. */
export { name } from "./index.ts"

export default definePlugin({
  name,
  needs: [Offers],
  apply: Effect.gen(function*() {
    const offers = yield* Offers

    /**
     * ONE TABLE FOR THIS SERVED DIRECTORY, on this fiber's scope.
     *
     * IT THROWS IF IT CANNOT BE OPENED, which is {@link ./table.ts}'s own
     * decision and is why there is no fallback here: a runtime whose SQLite
     * cannot make the table would otherwise serve a quietly slower vault and
     * tell nobody. As a ROW the throw is contained where a throw in `make` was
     * not — this fiber lands `failed` having installed nothing, the panel says
     * so on the row, and the other rows keep running with search refusing in
     * words. That is strictly better than the process it used to take down.
     */
    const index = yield* Effect.acquireRelease(
      Effect.sync(open),
      (table) => Effect.sync(table.close),
    )

    /**
     * THE ONE DOOR THIS ROW STANDS BEHIND.
     *
     * The four opaque fields are cast once, here, and that is the whole of the
     * `unknown` the tag carries: `@olai/plugin-api` may not import the floor, so
     * the door is spelled structurally there and with the floor's own types at
     * both ends — `@olai/ops`' `Search` on the calling side and these four casts
     * on this one. The composition root holds both, which is what makes a drift
     * a type error in one file rather than a field that arrives `undefined`.
     */
    yield* offers.offer(Search, () => ({
      nodes: ({ at, query, now, kinds }) =>
        Effect.sync(() =>
          search(
            at as Reading,
            query as SearchRequest,
            now,
            kinds as KindVocabulary,
            index,
          )
        ),
    }))
  }),
})
