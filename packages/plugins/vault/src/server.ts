/**
 * The vault is the lifetime of a served directory: its exclusive claim, store,
 * write gate and revision publisher are acquired and released by this row.
 *
 * The lock comes first. Opening the store starts its watcher; doing that before
 * claiming the directory would let a losing process observe and potentially
 * write a vault it does not own. openDirectory keeps that ordering structural.
 * A failed claim, or a path that is not a directory, fails this fiber and offers
 * no doors. The transports depend on TransportSurface instead of Vault, so the
 * panel can show that failure and a person can retry after freeing the path.
 *
 * The bundle is mounted before VaultSettings is provided. Kinds is a host
 * registry, and the complete vocabulary includes declarations from disabled
 * rows as well as a live lookup of active contributions. Reading it before the
 * bundle's modules are known would misjudge a legal property declaration. This
 * late settings door expresses that dependency without making apply wait for
 * work that mountBundle must precede. Tenants wait on our offers in turn.
 *
 * The format is row config, not a choice hidden in directory acquisition.
 * Config validates the selected codec before any resource is acquired. Only
 * olai is supported today; an Org implementation belongs at that selection
 * seam, while replacing the store itself would mean another Directory provider.
 *
 * The gate is acquired after the store and on this same scope. It owns its
 * caches and count of accepted writes. Scope teardown withdraws the offers and
 * drains dependent plugins before releasing our resources; the gate's release
 * then refuses fresh calls through retained handles and waits for accepted
 * writes. Only after it finishes can the store watcher and lock be released.
 * No root-owned gate or write-draining callback survives the row. Ledger and
 * search are read per call because those provider rows can change independently.
 * They are optional views in settings rather than required injects: git itself
 * needs Vault, so requiring its Ledger here would make an activation cycle.
 *
 * Turning this row off clears core's served collections and stops tenants that
 * need Vault or Ops. The panel explains that cost and remains available. On
 * return, a new store, gate and publisher are acquired from disk. The publisher
 * establishes its first reading before offering Vault; subscription replay and
 * later publications are ordered together, so a late tenant cannot see an old
 * revision after a newer one. These are registrations and lifetimes we can undo;
 * a write already accepted is an emission and must finish, not be rolled back.
 */
import { definePlugin } from "@olai/plugin-api"
import { Directory, Kinds, Offers, Ops, opsEvents, Vault, VaultSettings, vaultEvents } from "@olai/plugin-api/services"
import { make as makeOps, type VaultSettings as Settings } from "@olai/ops"
import { NodeServices } from "@effect/platform-node"
import { Deferred, Effect, Stream } from "effect"
import { opsDoor } from "./ops-door.ts"
import { openDirectory } from "./directory.ts"
import { codecs, Config } from "./format.ts"

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
    const directory = yield* openDirectory(settings.root, codecs[config.format](settings.kinds), settings.runtime)
    const refusals = opsEvents()
    const gate = yield* Effect.acquireRelease(
      Effect.sync(() => makeOps({
        ...directory,
        kinds: settings.kinds,
        ledger: settings.ledger,
        search: settings.search,
        onRefusal: (request, failure) => refusals.tell({ op: request.op, failure }),
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

/** Static sibling metadata matches the browser-owned client. Agent grants
 * belong to the standalone aliases registered by this activation, so copying
 * them here would advertise a second set of namespaced agent tools. */
import { faces as standaloneFaces } from "./file-surface.ts"
const siblingFaces = { browser: standaloneFaces.browser }
export { siblingFaces as faces }
export { surface } from "./file-surface.ts"
