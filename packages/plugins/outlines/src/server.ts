/** Outlines owns these wire members for its activation. The vault
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
import { outlineProjection, type Projection } from "@olai/surface/projection"
import type { OutlineEntry } from "@olai/surface"
import { samePageReading, sameNarrowing, sameMoving } from "@olai/format"
import type { CorePageReading } from "@olai/surface"

export default definePlugin({
  name, needs: [Directory, Ops, Vault, Surfaces],
  apply: Effect.gen(function*() {
    const store = (yield* Directory).store as Store
    const gate = (yield* Ops).gate as Gate
    const vault = yield* Vault
    let ctx: SurfaceRuntime<typeof surface.spec>["ctx"] | undefined
    let held: Projection<OutlineEntry> | undefined
    const empty = new Map<string, OutlineEntry>()
    const revisions = inMemoryChannel<void>()
    yield* vault.revision<Snapshot<Reading>>(snapshot => Effect.sync(() => {
      const next = outlineProjection(snapshot, held)
      held = next
      for (const [key, value] of next.change.upserts) ctx?.collections.outlines.upsert(key, value)
      for (const key of next.change.removes) ctx?.collections.outlines.remove(key)
      revisions.publish(undefined)
    }))
    yield* vault.unloaded(Effect.sync(() => {
      for (const key of held?.change.entries.keys() ?? []) ctx?.collections.outlines.remove(key)
      held = undefined
      revisions.publish(undefined)
    }))
    const deps: ImplementSurfaceDeps<typeof surface.spec> = {
      onStreamReadError: (error, { stream }) => {
        Effect.runFork(Effect.logWarning(`outlines ${stream} read failed: ${String(error)}`))
      },
      collections: {
        outlines: { readAll: () => held?.change.entries ?? empty, upsert: () => {}, remove: () => {},  }
      },
      streams: {
        page: { read: input => Effect.runPromise(Effect.map(gate.page(input), value => value as CorePageReading)), install: (_input, onEvent) => revisions.consume({onEvent, onError: () => {}}), isEqual: samePageReading },
        narrowing: { read: input => Effect.runPromise(gate.narrowing(input)), install: (_input, onEvent) => revisions.consume({onEvent, onError: () => {}}), isEqual: sameNarrowing },
        tagCompletions: { read: input => Effect.runPromise(gate.tags(input)), install: (_input, onEvent) => revisions.consume({onEvent, onError: () => {}}), isEqual: (a,b) => JSON.stringify(a) === JSON.stringify(b) },
        moving: { read: input => Effect.runPromise(gate.moving(input)), install: (_input, onEvent) => revisions.consume({onEvent, onError: () => {}}), isEqual: sameMoving }
      },
      procedures: {
        edit: { apply: ({ input }) => applyEdit(gate, input) },
        vocabulary: { tags: ({ input }) => gate.tags(input) },
        nodes: { named: ({ input }) => gate.named(input), homes: ({ input }) => gate.homes(input) },
        ops: { outlines: () => gate.outlines, node: ({ input }) => gate.node(input), subtree: ({ input }) => gate.subtree(input), run: ({ input }) => runWrite(gate, input) },
      },
    }
    yield* (yield* Surfaces).register({ surface, faces, dispatch, writes: ["surface/ops/run"], root: true, scopedFaces: { browser: faces.browser }, deps, published: value => { ctx = value as typeof ctx } })
  }),
})

export { dispatch } from "./surface.ts"

export { slotContracts as slots } from "./slots.ts"

/** Static sibling metadata matches the browser-owned client. Agent grants
 * belong to the standalone aliases registered by this activation, so copying
 * them here would advertise a second set of namespaced agent tools. */
import { faces as standaloneFaces } from "./surface.ts"
const siblingFaces = { browser: standaloneFaces.browser }
export { siblingFaces as faces }
export { surface } from "./surface.ts"
