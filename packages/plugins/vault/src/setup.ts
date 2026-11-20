import { definePlugin, kindWordOf, type PropKind } from "@olai/plugin-api"
import { BundleModules, Directory, FileKinds, Kinds, Offers, VaultSettings, VaultViews } from "@olai/plugin-api/services"
import { type Directory as OpenDirectory, type VaultSettings as Settings } from "@olai/ops"
import { Effect, Stream } from "effect"
import { VaultBoot } from "./boot.ts"
import { openViews } from "./views.ts"

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
    const views = openViews()
    const ledger = views.ledger
    const search = views.search
    const settings: Settings = {
      claims: { get current() { return views.fileKinds.current() } },
      root: boot.root,
      runtime: boot.runtime,
      kinds: { built, get enabled() { return registry.current() } },
      ledger: {
        wrote: writer => ledger().wrote(writer),
        whyWaiting: writer => ledger().whyWaiting(writer),
        record: (request, writer) => ledger().record(request, writer),
        push: Effect.suspend(() => ledger().push),
        waiting: Effect.suspend(() => ledger().waiting),
        resume: Effect.suspend(() => ledger().resume),
        hold: Effect.suspend(() => ledger().hold),
      },
      search: { nodes: ask => search().nodes(ask) },
    }
    yield* offers.offer(VaultSettings, () => settings)
    yield* offers.offer(VaultViews, () => views.door)
    yield* offers.own("file-kinds", views.fileKinds.provision)
  }),
})

export const revalidation = definePlugin({
  name: "vault-revalidation", needs: [Directory, Kinds, FileKinds],
  apply: Effect.gen(function*() {
    const directory = (yield* Directory) as OpenDirectory
    const kinds = yield* Kinds
    const fileKinds = yield* FileKinds
    let previousFiles = (yield* directory.store.read("cheap")).snapshot?.value.claims.byKind
    let previous = kinds.current()
    yield* Effect.forkScoped(Stream.runForEach(Stream.merge(kinds.changes, fileKinds.changes), () => Effect.suspend(() => {
      const current = kinds.current()
      const currentFiles = fileKinds.current()
      if (current === previous && currentFiles === previousFiles) return Effect.void
      previousFiles = currentFiles
      previous = current
      return Effect.ignore(directory.store.refresh("verified"))
    })))
  }),
})
