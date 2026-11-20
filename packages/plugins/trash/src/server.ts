import { definePlugin, Directory, Ops, Surfaces, Vault } from "@olai/plugin-api/services"
import type { Ops as Gate, Store } from "@olai/ops"
import { Effect, Stream, SubscriptionRef } from "effect"
import { inMemoryStore, inMemoryChannel, type ImplementSurfaceDeps, type SurfaceRuntime } from "@kolu/surface/server"
import type { Reading } from "@olai/format"
import type { Snapshot } from "@olai/store"
import { applyEdit, runWrite } from "@olai/edit-intents/apply"
import { surface, faces } from "./surface.ts"
import { tools } from "./tools.ts"
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
    yield* (yield* Surfaces).register({ surface, faces, tools, writes: ["surface/ops/run"], deps, published: value => { ctx = value as typeof ctx } })
  }),
})

export { dispatch } from "./surface.ts"

import { faces as standaloneFaces } from "./surface.ts"
const siblingFaces = { browser: standaloneFaces.browser }
export { siblingFaces as faces }
export { surface } from "./surface.ts"
