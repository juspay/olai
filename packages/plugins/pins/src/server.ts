/** pins owns these legacy wire members for its activation. The vault
 * remains the write authority. All readings and subscriptions are acquired on
 * this provider's scope; UI and layout are not dependencies of this half. */
import { definePlugin, Directory, Ops, Surfaces, Vault } from "@olai/plugin-api/services"
import type { Ops as Gate, Store } from "@olai/ops"
import { Effect, Stream, SubscriptionRef } from "effect"
import { inMemoryStore, inMemoryChannel, type ImplementSurfaceDeps, type SurfaceRuntime } from "@kolu/surface/server"
import type { Reading } from "@olai/format"
import type { Snapshot } from "@olai/store"
import { applyEdit, runWrite } from "@olai/edit-intents/apply"
import { surface, faces, dispatch } from "./surface.ts"
import { name } from "./name.ts"
export { name } from "./name.ts"
import { NO_PINS, shelfIn, conventionRecorded, pinsIn, type Convention } from "@olai/format"

export default definePlugin({
  name, needs: [Directory, Ops, Vault, Surfaces],
  apply: Effect.gen(function*() {
    const store = (yield* Directory).store as Store
    const gate = (yield* Ops).gate as Gate
    const vault = yield* Vault
    let ctx: SurfaceRuntime<typeof surface.spec>["ctx"] | undefined
    const value = inMemoryStore(NO_PINS)
    const publish = (next: typeof NO_PINS) => ctx ? ctx.cells.pins.set(next) : value.set(next)
    let file: Convention | undefined
    yield* vault.revision<Snapshot<Reading>>(snapshot => Effect.sync(() => {
      file = conventionRecorded(pinsIn, snapshot.value.derived, snapshot, file)
      publish(shelfIn(snapshot.value.derived, file.file))
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
    yield* (yield* Surfaces).register({ surface, faces, dispatch, root: true, scopedFaces: { browser: faces.browser }, deps, published: value => { ctx = value as typeof ctx } })
  }),
})

export { dispatch } from "./surface.ts"
