import { legacyPins } from "./migrate.ts"
/** pins owns these legacy wire members for its activation. The vault
 * remains the write authority. All readings and subscriptions are acquired on
 * this provider's scope; UI and layout are not dependencies of this half. */
import { definePlugin, Directory, Ops, Surfaces, Vault, LocalState } from "@olai/plugin-api/services"
import type { Ops as Gate, Store } from "@olai/ops"
import { Effect, Stream, SubscriptionRef } from "effect"
import { inMemoryStore, inMemoryChannel, type ImplementSurfaceDeps, type SurfaceRuntime } from "@kolu/surface/server"
import type { Reading } from "@olai/format"
import type { Snapshot } from "@olai/store"
import { applyEdit, runWrite } from "@olai/edit-intents/apply"
import { surface, faces } from "./surface.ts"
import { name } from "./name.ts"
export { name } from "./name.ts"
import { NO_PINS, shelfIn, conventionRecorded, pinsIn, type Convention } from "@olai/format"

export default definePlugin({
  name, needs: [Directory, Ops, Vault, Surfaces, LocalState],
  apply: Effect.gen(function*() {
    const store = (yield* Directory).store as Store
    const gate = (yield* Ops).gate as Gate
    const vault = yield* Vault
    const local = yield* LocalState
    const saved = yield* local.load
    let jobs = saved?.linkMigration as ReturnType<typeof legacyPins> | undefined
    let migrated = saved?.linkVersion === 2 && saved.linkMigration === undefined
    const revisions = yield* SubscriptionRef.make<Snapshot<Reading> | undefined>(undefined)
    // A scoped subscriber writes outside the synchronous revision callback.
    // Persist the original jobs before editing so a restart never migrates new links.
    yield* Effect.forkScoped(Stream.runForEach(SubscriptionRef.changes(revisions), snapshot => Effect.gen(function*() {
      if (!snapshot || migrated) return
      const shelf = shelfIn(snapshot.value.derived, conventionRecorded(pinsIn, snapshot.value.derived, snapshot, undefined).file)
      jobs ??= legacyPins(shelf)
      yield* local.save({ linkVersion: 2, linkMigration: jobs })
      for (const job of jobs) if (shelf.find(row => row.id === job.id)?.title === job.was) yield* applyEdit(gate, job)
      yield* local.save({ linkVersion: 2 })
      migrated = true
    }).pipe(Effect.catch(error => Effect.logWarning(`Pin link migration: ${String(error)}`)))))
    let ctx: SurfaceRuntime<typeof surface.spec>["ctx"] | undefined
    const value = inMemoryStore(NO_PINS)
    const publish = (next: typeof NO_PINS) => ctx ? ctx.cells.pins.set(next) : value.set(next)
    let file: Convention | undefined
    yield* vault.revision<Snapshot<Reading>>(snapshot => Effect.gen(function*() {
      file = conventionRecorded(pinsIn, snapshot.value.derived, snapshot, file)
      publish(shelfIn(snapshot.value.derived, file.file))
      yield* SubscriptionRef.set(revisions, snapshot)
    }))
    yield* vault.unloaded(Effect.sync(() => {
      publish(NO_PINS)
      file = undefined
    }))
    const deps: ImplementSurfaceDeps<typeof surface.spec> = {
      cells: {
        pins: { store: value }
      },
      procedures: {
        edit: { apply: ({ input }) => applyEdit(gate, input) },
      },
    }
    yield* (yield* Surfaces).register({ surface, faces, deps, published: value => { ctx = value as typeof ctx } })
  }),
})

export { dispatch } from "./surface.ts"

/** Static sibling metadata matches the browser-owned client. Agent grants
 * belong to the standalone aliases registered by this activation, so copying
 * them here would advertise a second set of namespaced agent tools. */
import { faces as standaloneFaces } from "./surface.ts"
const siblingFaces = { browser: standaloneFaces.browser }
export { siblingFaces as faces }
export { surface } from "./surface.ts"
