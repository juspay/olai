/**
 * THE TWO OPTIONAL VIEWS THE STORE IS BUILT OVER — a ledger to record a write
 * in, and a matcher to answer a query with — held by two components of this
 * row's own.
 *
 * ## They cannot be `needs` on the row, and that is not a hedge
 *
 * The git row needs `Vault`. A vault row that named `Ledger` would be an
 * activation cycle, and `--plugins` composes serves with neither provider at
 * all. So each is a COMPONENT: it sits `waiting` until its provider is up, says
 * which key on the panel, and unwinds when the provider leaves — which is what
 * the `HostServices` lookup it replaces could never do.
 *
 * ## The reads stay PER CALL, and the absence is the ops layer's own word
 *
 * Either row can come and go under a standing store, so a write resolves its
 * ledger at the moment it lands rather than at the moment the settings were
 * built. With nobody mounted the answer is `NO_LEDGER` / `NO_SEARCH`, which
 * refuse in the vault's own words — the same sentences a serve without those
 * rows already gave.
 */
import { definePlugin } from "@olai/plugin-api"
import { Ledger, Search } from "@olai/plugin-api/services"
import { NO_LEDGER, NO_SEARCH, type Ledger as OpsLedger, type Search as OpsSearch } from "@olai/ops"
import { Effect } from "effect"

let ledger: OpsLedger | undefined
let matcher: OpsSearch | undefined

/** Where a write is recorded, or the refusal for a serve with no history. */
export const ledgerView = (): OpsLedger => ledger ?? NO_LEDGER

/** ...and what a query is answered by. */
export const searchView = (): OpsSearch => matcher ?? NO_SEARCH

/** The git row's ledger, DECLARED — on a component, so the vault itself never
 *  waits for the row that waits for it. */
export const ledgerIntegration = definePlugin({
  name: "ledger-view",
  needs: [Ledger],
  apply: Effect.gen(function*() {
    const door = (yield* Ledger) as OpsLedger
    yield* Effect.acquireRelease(
      Effect.sync(() => { ledger = door }),
      () => Effect.sync(() => { if (ledger === door) ledger = undefined }),
    )
  }),
})

/** ...and the search row's matcher, the same way. */
export const searchIntegration = definePlugin({
  name: "search-view",
  needs: [Search],
  apply: Effect.gen(function*() {
    const door = (yield* Search) as OpsSearch
    yield* Effect.acquireRelease(
      Effect.sync(() => { matcher = door }),
      () => Effect.sync(() => { if (matcher === door) matcher = undefined }),
    )
  }),
})
