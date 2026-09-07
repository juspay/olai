/**
 * THE TWO OPTIONAL VIEWS THE STORE IS BUILT OVER — a ledger to record a write
 * in, and a matcher to answer a query with — REGISTERED BY THE ROWS THAT
 * PROVIDE THEM, through {@link VaultViews}.
 *
 * ## Why the arrow points that way
 *
 * They cannot be `needs` on this row: git needs the vault, so requiring its
 * ledger would be an activation cycle, and `--plugins` composes serves with
 * neither provider at all.
 *
 * They cannot be COMPONENTS of this row either, and that one is worth writing
 * down because it is not obvious and it cost a CI run to learn: a row's report
 * folds its components, so a component sitting `waiting` for a provider that
 * will never arrive makes the whole row read `waiting` — and
 * `packages/server/src/runtime.ts` reports a row as `running` only when it does
 * not. A vault short of git would have stopped being loaded by the tab at all.
 *
 * So the PROVIDER registers, which is the shape every other optional table in
 * the host already has (`Kinds.register`, `Surfaces.register`, `Wakes.register`).
 * Git and search already name `Vault`, so they are already waiting for this row
 * and registering costs them no new wait. What this replaced was
 * `HostServices.current(Ledger)` and `.current(Search)` — a capability whose
 * whole shape is *give me whatever stands behind this key*, spent on two keys
 * this row never declared (the audit's §5).
 *
 * ## The reads stay PER CALL, and the absence is the ops layer's own word
 *
 * Either provider can come and go under a standing store, so a write resolves
 * its ledger at the moment it lands rather than at the moment the settings were
 * built. The registration is a finalizer on the REGISTERING plugin's scope, so
 * a provider that unloads takes its view with it and the answer falls back to
 * `NO_LEDGER` / `NO_SEARCH` — the same sentences a serve without those rows
 * already gave.
 */
import type { VaultViews } from "@olai/plugin-api/services"
import { NO_LEDGER, NO_SEARCH, type Ledger as OpsLedger, type Search as OpsSearch } from "@olai/ops"
import { Effect } from "effect"

let ledger: OpsLedger | undefined
let matcher: OpsSearch | undefined

/** Where a write is recorded, or the refusal for a serve with no history. */
export const ledgerView = (): OpsLedger => ledger ?? NO_LEDGER

/** ...and what a query is answered by. */
export const searchView = (): OpsSearch => matcher ?? NO_SEARCH

/** BY IDENTITY, both of them: a registration whose finalizer runs after a
 *  replacement installed its own must not take the replacement's view out from
 *  under a write in flight. */
const held = <Door>(read: () => Door | undefined, write: (door: Door | undefined) => void) =>
(door: Door) =>
  Effect.acquireRelease(
    Effect.sync(() => { write(door) }),
    () => Effect.sync(() => { if (read() === door) write(undefined) }),
  ).pipe(Effect.asVoid)

/** What `./setup.ts` stands behind. ONE VIEW EACH is not enforced here: Cordis
 *  refuses a second row behind `Ledger` or `Search` at the door those come
 *  from, so a second registration cannot be reached without a second provider. */
export const vaultViews: VaultViews = {
  ledger: held(() => ledger, (door) => { ledger = door as OpsLedger | undefined }) as VaultViews["ledger"],
  search: held(() => matcher, (door) => { matcher = door as OpsSearch | undefined }) as VaultViews["search"],
}
