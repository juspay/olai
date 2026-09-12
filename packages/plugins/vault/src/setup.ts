/**
 * Vault configuration follows the vault row, including optional provider views.
 *
 * ## THE TWO OPTIONAL VIEWS ARE DECLARED NOW, by the rows that provide them
 *
 * The settings this row hands the store carry a LEDGER (where a write is
 * recorded) and a MATCHER (what a query answers), and neither can be a `needs`
 * on the row: git needs the vault, so requiring its ledger here would be an
 * activation cycle, and the file’s row selection may compose a serve with neither.
 *
 * They used to be `HostServices.current(Ledger)` and `.current(Search)` — a
 * capability whose shape is *give me whatever stands behind this key*, spent on
 * two keys this row never declared. The graph a person reads said the vault
 * wanted a boot, a bundle and a vocabulary; the code reached for two other
 * rows' doors on every write and every query (the audit's §5).
 *
 * So this component stands behind {@link VaultViews} and the providers register
 * into it — git and search already name `Vault`, so neither gains a wait. The
 * table they register into is minted HERE, inside this activation, which is the
 * difference between a vault owning its views and a process holding one pair of
 * them for every vault it ever opens.
 * `./views.ts` carries the whole of why the arrow points that way rather than
 * at two components of this row. The reads stay PER CALL for the reason they
 * always did, and the absent answer is unchanged: `NO_LEDGER` and `NO_SEARCH`,
 * which refuse in the vault's own words.
 */
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
    // ONE TABLE, MINTED HERE — this activation's, not the module's. Its own
    // paragraph carries why that distinction is the whole finding: two hosts in
    // one process used to share a pair of module variables, so the second
    // serve's git row answered the first serve's writes.
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
        get push() { return ledger().push },
        get resume() { return ledger().resume },
      },
      search: { nodes: ask => search().nodes(ask) },
    }
    yield* offers.offer(VaultSettings, () => settings)
    yield* offers.offer(VaultViews, () => views.door)
    yield* offers.own("file-kinds", views.fileKinds.provision)
  }),
})

/** Snapshot publication also changes the host. Only a changed vocabulary is
 * a reason to revalidate; update the identity before publishing the result. */
export const revalidation = definePlugin({
  name: "vault-revalidation", needs: [Directory, Kinds, FileKinds],
  apply: Effect.gen(function*() {
    const directory = (yield* Directory) as OpenDirectory
    const kinds = yield* Kinds
    const fileKinds = yield* FileKinds
    // A claim can arrive between the first store read and this component's
    // activation. Compare the replayed pulse to the published reading, not
    // to a newer table that the store may never have probed.
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
