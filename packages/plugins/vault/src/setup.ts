/** Vault configuration follows the vault row, including optional provider views. */
import { definePlugin, kindWordOf, type PropKind } from "@olai/plugin-api"
import { BundleModules, Directory, HostServices, Kinds, Ledger, Offers, Search, VaultSettings } from "@olai/plugin-api/services"
import { NO_LEDGER, NO_SEARCH, type Directory as OpenDirectory, type Ledger as OpsLedger, type Search as OpsSearch, type VaultSettings as Settings } from "@olai/ops"
import { Effect, Stream } from "effect"
import { VaultBoot } from "./boot.ts"

export const setup = definePlugin({
  name: "vault-setup", needs: [VaultBoot, BundleModules, HostServices, Kinds, Offers],
  apply: Effect.gen(function*() {
    const boot = yield* VaultBoot
    const modules = yield* (yield* BundleModules).read
    const host = yield* HostServices
    const registry = yield* Kinds
    const offers = yield* Offers
    const built = new Map<string, PropKind>()
    for (const module of modules) {
      for (const kind of (module.exports as { kinds?: ReadonlyArray<PropKind> }).kinds ?? []) {
        const word = kindWordOf(module.name, kind.kind)
        built.set(word, { ...kind, kind: word })
      }
    }
    const ledger = (): OpsLedger => host.current(Ledger) as OpsLedger | undefined ?? NO_LEDGER
    const search = (): OpsSearch => host.current(Search) as OpsSearch | undefined ?? NO_SEARCH
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
