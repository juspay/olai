/** The vault row owns the claim, watcher and revision publisher. Settings are
 * provided after bundle mounting, when the complete declared vocabulary is
 * available. Tenants wait on Vault; transports do not, so a failed acquisition
 * can still be inspected and retried through the panel. */
import { definePlugin, serviceTag } from "@olai/plugin-api"
import { Directory, Kinds, Offers, Vault, vaultEvents } from "@olai/plugin-api/services"
import type { KindVocabulary } from "@olai/format"
import { NodeServices } from "@effect/platform-node"
import { Effect, Stream } from "effect"
import { stat } from "node:fs/promises"
import { openDirectory } from "./directory.ts"

export const VaultSettings = serviceTag<{
  readonly root: string
  readonly kinds: KindVocabulary
  readonly idle: Effect.Effect<void>
}>("vault-settings")

export const vaultModule = definePlugin({
  name: "vault",
  needs: [Kinds, Offers, VaultSettings],
  apply: Effect.gen(function*() {
    const settings = yield* VaultSettings
    const offers = yield* Offers
    const isDirectory = yield* Effect.tryPromise({
      try: async () => (await stat(settings.root)).isDirectory(),
      catch: (cause) => new Error(`cannot open vault ${settings.root}: ${String(cause)}`),
    })
    if (!isDirectory) return yield* Effect.die(new Error(`${settings.root} is not a directory`))
    const directory = yield* openDirectory(settings.root, settings.kinds)
    // Offers withdraw before this release. No new write can enter, and any
    // write already accepted finishes before the watcher and lock are released.
    yield* Effect.addFinalizer(() => settings.idle)
    const events = vaultEvents(directory.root,
      Effect.map(directory.store.read("cheap"), ({ snapshot }) => snapshot))
    yield* Effect.forkScoped(Stream.runForEach(directory.store.reads, ({ snapshot }) =>
      snapshot === null ? events.quiet : events.published(snapshot)))
    yield* offers.offer(Directory, () => directory)
    yield* offers.offer(Vault, events.door)
  }).pipe(Effect.provide(NodeServices.layer), Effect.tapCause((cause) => Effect.logError("vault failed to start", cause)), Effect.orDie),
})
