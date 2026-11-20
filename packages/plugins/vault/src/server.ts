import { codecFor } from "@olai/ops"
import { definePlugin } from "@olai/plugin-api"
import { Directory, Kinds, Offers, Ops, opsEvents, Vault, VaultSettings, vaultEvents } from "@olai/plugin-api/services"
import { make as makeOps, type VaultSettings as Settings } from "@olai/ops"
import { NodeServices } from "@effect/platform-node"
import { Deferred, Effect, Stream } from "effect"
import { opsDoor } from "./ops-door.ts"
import { openDirectory } from "./directory.ts"
import { Config } from "./format.ts"

import { name } from "./index.ts"
export { name } from "./index.ts"
export { Config } from "./format.ts"

export default definePlugin({
  name,
  needs: [Kinds, Offers, VaultSettings],
  config: Config,
  apply: (config: Config) => Effect.gen(function*() {
    const settings = (yield* VaultSettings) as Settings
    const offers = yield* Offers
    yield* offers.own("outline-row", () => config.format)
    const directory = yield* openDirectory(settings.root, codecFor(settings.kinds, settings.claims), settings.runtime)
    const refusals = opsEvents()
    const gate = yield* Effect.acquireRelease(
      Effect.sync(() => makeOps({
        ...directory,
        kinds: settings.kinds,
        claims: settings.claims,
        format: config.format,
        ledger: settings.ledger,
        search: settings.search,
        onRefusal: (request, failure, writer) => refusals.tell({ op: request.op, failure, writer }),
      })),
      (gate) => gate.close,
    )
    const events = vaultEvents(directory.root)
    const first = yield* Deferred.make<void>()
    yield* Effect.forkScoped(Stream.runForEach(directory.store.reads, ({ snapshot }) =>
      Effect.andThen(snapshot === null ? events.quiet : events.published(snapshot), Deferred.succeed(first, undefined))))
    yield* Deferred.await(first)
    yield* offers.offer(Directory, () => directory)
    yield* offers.offer(Ops, (plugin) => opsDoor(gate, refusals.listen(plugin)))
    yield* offers.offer(Vault, events.door)
  }).pipe(Effect.provide(NodeServices.layer), Effect.tapCause((cause) => Effect.logError("vault failed to start", cause)), Effect.orDie),
})

import fileAccess from "./file-access.ts"
import { setup, revalidation } from "./setup.ts"
import http from "./http.ts"
export const components = { "file-access": fileAccess, setup, revalidation, http }

import { faces as standaloneFaces } from "./file-surface.ts"
const siblingFaces = { browser: standaloneFaces.browser }
export { siblingFaces as faces }
export { surface } from "./file-surface.ts"
