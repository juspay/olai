/** markdown owns these legacy wire members for its activation. The vault
 * remains the write authority. All readings and subscriptions are acquired on
 * this provider's scope; UI and layout are not dependencies of this half. */
import { definePlugin, Directory, Ops, Surfaces, Vault } from "@olai/plugin-api/services"
import type { Ops as Gate, Store } from "@olai/ops"
import { Effect, Stream, SubscriptionRef } from "effect"
import { inMemoryStore, inMemoryChannel, type ImplementSurfaceDeps, type SurfaceRuntime } from "@kolu/surface/server"
import { type Reading, samePageReading } from "@olai/format"
import type { Snapshot } from "@olai/store"
import { applyEdit, runWrite } from "@olai/edit-intents/apply"
import { surface, faces, dispatch } from "./surface.ts"
import { name } from "./name.ts"
export { name } from "./name.ts"
import { documentProjection, type Projection } from "@olai/surface/projection"
import type { CorePageReading, DocumentEntry } from "@olai/surface"
import * as Bodies from "./server/bodies.ts"

export default definePlugin({
  name, needs: [Directory, Ops, Vault, Surfaces],
  apply: Effect.gen(function*() {
    const store = (yield* Directory).store as Store
    const gate = (yield* Ops).gate as Gate
    const vault = yield* Vault
    let ctx: SurfaceRuntime<typeof surface.spec>["ctx"] | undefined
    let held: Projection<DocumentEntry> | undefined
    const empty = new Map<string, DocumentEntry>()
    const revisions = inMemoryChannel<void>()
    const bodies = yield* Bodies.make({
      read: path => store.body(path),
      publish: (path, body) => {
        const entry = held?.change.entries.get(path)
        if (entry) ctx?.collections.documents.upsert(path, "refused" in body
          ? { rev: entry.rev, text: null, refused: true }
          : { rev: entry.rev, text: body.text, refused: false })
      },
    })
    yield* vault.revision<Snapshot<Reading>>(snapshot => Effect.sync(() => {
      const next = documentProjection(snapshot, held)
      held = next
      for (const [key, value] of next.change.upserts) ctx?.collections.documents.upsert(key, value)
      for (const key of next.change.removes) ctx?.collections.documents.remove(key)
      bodies.unread(next.unread)
      revisions.publish(undefined)
    }))
    yield* vault.unloaded(Effect.sync(() => {
      for (const key of held?.change.entries.keys() ?? []) ctx?.collections.documents.remove(key)
      held = undefined
      revisions.publish(undefined)
    }))
    const deps: ImplementSurfaceDeps<typeof surface.spec> = {
      onStreamReadError: (error, {stream}) => { Effect.runFork(Effect.logWarning(`markdown ${stream} read failed: ${String(error)}`)) },
      streams: { documentPage: {
        read: input => Effect.runPromise(Effect.map(gate.page(input), value => value as CorePageReading)),
        install: (_input, onEvent) => revisions.consume({onEvent, onError: () => {}}),
        isEqual: samePageReading,
      } },
      collections: {
        documents: { readAll: () => held?.change.entries ?? empty, upsert: () => {}, remove: () => {}, 
        readOne: (key) => {
          const entry = held?.change.entries.get(key)
          if (!entry || entry.text !== null) return entry
          bodies.unread([key])
          return undefined
        },
        holders: bodies.held, }
      },
      procedures: {
        edit: { apply: ({ input }) => applyEdit(gate, input) },
        ops: { documents: () => gate.documents, document: ({ input }) => gate.document(input), run: ({ input }) => runWrite(gate, input) },
      },
    }
    yield* (yield* Surfaces).register({ surface, faces, dispatch, writes: ["surface/ops/run"], root: true, scopedFaces: { browser: faces.browser }, deps, published: value => { ctx = value as typeof ctx } })
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
