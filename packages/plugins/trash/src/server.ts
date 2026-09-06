/** trash owns these legacy wire members for its activation. The vault
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

export default definePlugin({
  name, needs: [Directory, Ops, Vault, Surfaces],
  apply: Effect.gen(function*() {
    const store = (yield* Directory).store as Store
    const gate = (yield* Ops).gate as Gate
    const vault = yield* Vault
    let ctx: SurfaceRuntime<typeof surface.spec>["ctx"] | undefined
    const deps: ImplementSurfaceDeps<typeof surface.spec> = {
      procedures: {
        edit: { apply: ({ input }) => applyEdit(gate, input) },
        ops: { run: ({ input }) => runWrite(gate, input) },
      },
    }
    yield* (yield* Surfaces).register({ surface, faces, dispatch, writes: ["surface/ops/run"], root: true, scopedFaces: { browser: faces.browser }, deps, published: value => { ctx = value as typeof ctx } })
  }),
})

export { dispatch } from "./surface.ts"
