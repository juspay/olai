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
 * ## A TABLE PER ACTIVATION, and it was one per PROCESS
 *
 * The two views were a `let` apiece at this module's scope, which is private to
 * the package and belongs to nobody. One process can open two hosts — the
 * benches do it, and `openPlugins` makes no claim otherwise — and both vaults
 * read the same pair of variables, so the second serve's git row answered the
 * first serve's writes. That is the counterexample the paper's Def. 30 is
 * about, and it is the very fault this phase exists to remove: private to a
 * package is not owned by an activation.
 *
 * {@link openViews} is the repair. `./setup.ts` mints one inside its own
 * `apply`, builds the settings over THAT instance's readers, and stands behind
 * `VaultViews` with THAT instance's door — so a table's reach is one vault's
 * activation and nothing wider.
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

/** One vault activation's pair of optional views: what its settings read, and
 *  the door its providers register through. */
export interface Views {
  /** Where a write is recorded, or the refusal for a serve with no history. */
  readonly ledger: () => OpsLedger
  /** ...and what a query is answered by. */
  readonly search: () => OpsSearch
  /** What `./setup.ts` stands behind — this instance's, and no other's. */
  readonly door: VaultViews
}

/**
 * ONE REGISTRATION EACH, and a second is REFUSED rather than taken.
 *
 * The alternative is what this used to do: write unconditionally, so a second
 * `ledger(door)` replaced the first silently and the first's release — guarded
 * by identity — then did nothing at all. Two rows answering *where is this
 * write recorded* would resolve in favour of whichever mounted last, which is
 * the failure {@link VaultViews} says out loud it does not have.
 *
 * It adds no failure mode a provider could reach by restarting. A provider
 * registers from the same activation that stands behind `Ledger` or `Search`,
 * and Cordis already refuses a second row behind either of those — so an
 * overlap that could reach this refusal is an overlap that would have died one
 * door earlier.
 *
 * A DEFECT and not a failure, for the reason every other double-claim on this
 * path is one: there is no arm a caller could write for "somebody else got
 * here first", and a serve that composed two ledgers is a serve whose
 * composition is wrong.
 */
const holding = <Door>(what: string) => {
  let held: Door | undefined
  return {
    read: () => held,
    hold: (door: Door) =>
      Effect.suspend(() =>
        held !== undefined
          ? Effect.die(new Error(
            `olai-plugin-vault: a second row registered the ${what} this vault records `
              + "through — a store reads one, and the second would leave every write "
              + "landing in whichever was mounted last.",
          ))
          : Effect.acquireRelease(
            Effect.sync(() => { held = door }),
            // BY IDENTITY still, though the refusal above makes a replacement
            // unreachable: a release that did not check is one line away from
            // being wrong the day the refusal is relaxed.
            () => Effect.sync(() => { if (held === door) held = undefined }),
          ).pipe(Effect.asVoid),
      ),
  }
}

/** Mint one activation's views. Called by `./setup.ts` inside its `apply`, and
 *  by nothing else — a second caller would be a second vault. */
export const openViews = (): Views => {
  const ledger = holding<OpsLedger>("ledger")
  const search = holding<OpsSearch>("matcher")
  return {
    ledger: () => ledger.read() ?? NO_LEDGER,
    search: () => search.read() ?? NO_SEARCH,
    door: {
      ledger: ledger.hold as VaultViews["ledger"],
      search: search.hold as VaultViews["search"],
    },
  }
}
