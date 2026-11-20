import { definePlugin, Ops, Surfaces } from "@olai/plugin-api/services"
import type { Ops as Gate } from "@olai/ops"
import { Effect } from "effect"
import type { ImplementSurfaceDeps } from "@kolu/surface/server"
import { applyEdit, runWrite } from "@olai/edit-intents/apply"
import { surface, faces } from "./surface.ts"
import { tools } from "./tools.ts"
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
    yield* (yield* Surfaces).register({ surface, faces, tools, writes: ["surface/ops/run"], deps })
  }),
})

export { dispatch } from "./surface.ts"

import { faces as standaloneFaces } from "./surface.ts"
const siblingFaces = { browser: standaloneFaces.browser }
export { siblingFaces as faces }
export { surface } from "./surface.ts"
