import { claim } from "./claim.ts"
import { definePlugin, Directory, FileKinds, Ops, Surfaces, Vault } from "@olai/plugin-api/services"
import type { Ops as Gate, Store } from "@olai/ops"
import { Effect } from "effect"
import { inMemoryChannel, type ImplementSurfaceDeps, type SurfaceRuntime } from "@kolu/surface/server"
import { type Reading, samePageReading } from "@olai/format"
import type { Snapshot } from "@olai/store"
import { applyEdit, runWrite } from "@olai/edit-intents/apply"
import { surface, faces, resources } from "./surface.ts"
import { tools } from "./tools.ts"
import { name } from "./name.ts"
export { name } from "./name.ts"
import type { Projection } from "@olai/surface/projection"
import { documentProjection } from "./projection.ts"
import type { DocumentEntry } from "./wire.ts"
import type { FiledPageReading } from "@olai/format"

export default definePlugin({
  name, needs: [Directory, Ops, Vault, Surfaces, FileKinds],
  apply: Effect.gen(function*() {
    yield* (yield* FileKinds).register(claim)
    const store = (yield* Directory).store as Store
    const gate = (yield* Ops).gate as Gate
    const vault = yield* Vault
    let ctx: SurfaceRuntime<typeof surface.spec>["ctx"] | undefined
    let held: Projection<DocumentEntry> | undefined
    const empty = new Map<string, DocumentEntry>()
    const revisions = inMemoryChannel<void>()
    yield* vault.revision<Snapshot<Reading>>(snapshot => Effect.sync(() => {
      const next = documentProjection(snapshot, held)
      held = next
      for (const [key, value] of next.change.upserts) ctx?.collections.documents.upsert(key, value)
      for (const key of next.change.removes) ctx?.collections.documents.remove(key)
      revisions.publish(undefined)
    }))
    yield* vault.unloaded(Effect.sync(() => {
      for (const key of held?.change.entries.keys() ?? []) ctx?.collections.documents.remove(key)
      held = undefined
      revisions.publish(undefined)
    }))
    const deps: ImplementSurfaceDeps<typeof surface.spec> = {
      onStreamReadError: (error, {stream}) => { Effect.runFork(Effect.logWarning(`markdown ${stream} read failed: ${String(error)}`)) },
      /** The effect is run OUTSIDE this plugin's scope, which is why a failure
       *  lands on `onStreamReadError` above rather than tearing the fiber down
       *  — one reader's bad address must not withdraw the row from everyone. */
      streams: { documentPage: {
        read: input => {
          if (!claim.exts.some(ext => input.address.path.endsWith(ext))) return Promise.reject(new Error("this page requires this row's claimed Markdown file"))
          return Effect.runPromise(Effect.map(gate.page(input), value => {
          if (value.shows.kind !== "document" && value.shows.kind !== "nothing") throw new Error("this page requires a claimed body file")
          return value as FiledPageReading
        }))
        },
        install: (_input, onEvent) => revisions.consume({onEvent, onError: () => {}}),
        isEqual: samePageReading,
      } },
      collections: {
        documents: { readAll: () => held?.change.entries ?? empty, upsert: () => {}, remove: () => {},
        readOne: key => held?.change.entries.get(key), }

      },
      procedures: {
        edit: { apply: ({ input }) => applyEdit(gate, input) },
        ops: { documents: () => gate.documents, document: ({ input }) => gate.document(input), run: ({ input }) => runWrite(gate, input) },
      },
    }
    yield* (yield* Surfaces).register({ surface, faces, resources, tools, writes: ["surface/ops/run"], deps, published: value => { ctx = value as typeof ctx } })
  }),
})

export { dispatch } from "./surface.ts"

import { faces as standaloneFaces } from "./surface.ts"
const siblingFaces = { browser: standaloneFaces.browser }
export { siblingFaces as faces }
export { surface } from "./surface.ts"
