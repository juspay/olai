import { definePlugin, Directory, Ops, Surfaces, Vault } from "@olai/plugin-api/services"
import type { Ops as Gate, Store } from "@olai/ops"
import { Effect, Stream, SubscriptionRef } from "effect"
import { inMemoryStore, inMemoryChannel, type ImplementSurfaceDeps, type SurfaceRuntime } from "@kolu/surface/server"
import { applyEdit, runWrite } from "@olai/edit-intents/apply"
import { surface, faces } from "./surface.ts"
import { tools } from "./tools.ts"
import { name } from "./name.ts"
export { name } from "./name.ts"
import { INBOX, mintedInto, mintExt, NO_INBOX, inboxHeldIn, conventionServed, inboxIn, type Convention } from "@olai/format"

export default definePlugin({
  name, needs: [Directory, Ops, Vault, Surfaces],
  apply: Effect.gen(function*() {
    const store = (yield* Directory).store as Store
    const gate = (yield* Ops).gate as Gate
    const vault = yield* Vault
    let ctx: SurfaceRuntime<typeof surface.spec>["ctx"] | undefined
    const value = inMemoryStore(NO_INBOX)
    const publish = (next: typeof NO_INBOX) => ctx ? ctx.cells.inbox.set(next) : value.set(next)
    const publishInbox = yield* vault.inbox.register(null)
    let file: Convention | undefined
    yield* vault.revision(snapshot => Effect.gen(function*() {
      file = conventionServed(snapshot.value.claims, inboxIn, snapshot.value.set, snapshot, file)
      publish(inboxHeldIn(snapshot.value.derived, file.file))
      const reading = yield* Effect.result(gate.read)
      const ext = reading._tag === "Success" ? mintExt(snapshot.value.claims, reading.success.outlineRow) : null
      yield* publishInbox(file.file ?? (ext === null ? null : mintedInto(`${INBOX}${ext}`)))
    }))
    yield* vault.unloaded(Effect.gen(function*() {
      publish(NO_INBOX)
      file = undefined
      yield* publishInbox(null)
    }))
    const deps: ImplementSurfaceDeps<typeof surface.spec> = {
      cells: {
        inbox: { store: value }
      },
      procedures: {
        edit: { apply: ({ input }) => applyEdit(gate, input) },
      },
    }
    yield* (yield* Surfaces).register({ surface, faces, tools, deps, published: value => { ctx = value as typeof ctx } })
  }),
})

export { dispatch } from "./surface.ts"

import { faces as standaloneFaces } from "./surface.ts"
const siblingFaces = { browser: standaloneFaces.browser }
export { siblingFaces as faces }
export { surface } from "./surface.ts"
