/** files owns these legacy wire members for its activation. The vault
 * remains the write authority. All readings and subscriptions are acquired on
 * this provider's scope; UI and layout are not dependencies of this half. */
import { definePlugin, Ops, Surfaces } from "@olai/plugin-api/services"
import type { Ops as Gate } from "@olai/ops"
import { Effect } from "effect"
import type { ImplementSurfaceDeps } from "@kolu/surface/server"
import { applyEdit, runWrite } from "@olai/edit-intents/apply"
import { surface, faces, dispatch } from "./surface.ts"
import { name } from "./name.ts"
export { name } from "./name.ts"

export default definePlugin({
  name, needs: [Ops, Surfaces],
  apply: Effect.gen(function*() {
    const gate = (yield* Ops).gate as Gate
    const deps: ImplementSurfaceDeps<typeof surface.spec> = {
      procedures: {
        edit: { apply: ({ input }) => applyEdit(gate, input) },
        ops: { paths: () => gate.paths, run: ({ input }) => runWrite(gate, input) },
      },
    }
    yield* (yield* Surfaces).register({ surface, faces, dispatch, writes: ["surface/ops/run"], root: true, scopedFaces: faces, deps })
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
