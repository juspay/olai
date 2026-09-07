/**
 * Vault configuration follows the vault row, including optional provider views.
 *
 * ## THE TWO OPTIONAL VIEWS ARE DECLARED NOW, and by two components
 *
 * The settings this row hands the store carry a LEDGER (where a write is
 * recorded) and a MATCHER (what a query answers), and neither can be a `needs`
 * on the row: git needs the vault, so requiring its ledger here would be an
 * activation cycle, and `--plugins` may compose a serve with neither.
 *
 * They used to be `HostServices.current(Ledger)` and `.current(Search)` — a
 * capability whose shape is *give me whatever stands behind this key*, spent on
 * two keys this row never declared. The graph a person reads said the vault
 * wanted a boot, a bundle and a vocabulary; the code reached for two other
 * rows' doors on every write and every query (the audit's §5).
 *
 * Each is a COMPONENT of this row now (`./views.ts`). The cycle is not
 * reintroduced, because a component waits on its own: `vault/ledger-view` sits
 * `waiting` until git is up and git waits for this row's `Vault` in the usual
 * way. The reads stay PER CALL for the reason they always did — either row can
 * come and go under a standing store — and the absent answer is unchanged:
 * `NO_LEDGER` and `NO_SEARCH`, which refuse in the vault's own words.
 */
import { definePlugin, kindWordOf, type PropKind } from "@olai/plugin-api"
import { BundleModules, Directory, Kinds, Offers, VaultSettings } from "@olai/plugin-api/services"
import { type Directory as OpenDirectory, type VaultSettings as Settings } from "@olai/ops"
import { Effect, Stream } from "effect"
import { VaultBoot } from "./boot.ts"
import { ledgerView, searchView } from "./views.ts"

export const setup = definePlugin({
  name: "vault-setup", needs: [VaultBoot, BundleModules, Kinds, Offers],
  apply: Effect.gen(function*() {
    const boot = yield* VaultBoot
    const modules = yield* (yield* BundleModules).read
    const registry = yield* Kinds
    const offers = yield* Offers
    const built = new Map<string, PropKind>()
    for (const module of modules) {
      for (const kind of (module.exports as { kinds?: ReadonlyArray<PropKind> }).kinds ?? []) {
        const word = kindWordOf(module.name, kind.kind)
        built.set(word, { ...kind, kind: word })
      }
    }
    const ledger = ledgerView
    const search = searchView
    const settings: Settings = {
      root: boot.root,
      runtime: boot.runtime,
      kinds: { built, get enabled() { return registry.current() } },
      ledger: {
        wrote: writer => ledger().wrote(writer),
        whyWaiting: writer => ledger().whyWaiting(writer),
        record: (request, writer) => ledger().record(request, writer),
        get push() { return ledger().push },
        get resume() { return ledger().resume },
      },
      search: { nodes: ask => search().nodes(ask) },
    }
    yield* offers.offer(VaultSettings, () => settings)
  }),
})

/** Snapshot publication also changes the host. Only a changed vocabulary is
 * a reason to revalidate; update the identity before publishing the result. */
export const revalidation = definePlugin({
  name: "vault-revalidation", needs: [Directory, Kinds],
  apply: Effect.gen(function*() {
    const directory = (yield* Directory) as OpenDirectory
    const kinds = yield* Kinds
    let previous = kinds.current()
    yield* Effect.forkScoped(Stream.runForEach(kinds.changes, () => Effect.suspend(() => {
      const current = kinds.current()
      if (current === previous) return Effect.void
      previous = current
      return Effect.ignore(directory.store.refresh("verified"))
    })))
  }),
})
