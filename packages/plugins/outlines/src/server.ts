import { definePlugin, Directory, Ops, Surfaces, Vault } from "@olai/plugin-api/services"
import type { Ops as Gate } from "@olai/ops"
import { Effect } from "effect"
import { inMemoryChannel, type ImplementSurfaceDeps, type SurfaceRuntime } from "@kolu/surface/server"
import { applyEdit, runWrite } from "@olai/edit-intents/apply"
import { surface, faces, resources } from "./surface.ts"
import { tools } from "./tools.ts"
import { CHARTER } from "./charter.ts"
import { name } from "./name.ts"
export { name } from "./name.ts"
import type { Projection } from "@olai/surface/projection"
import { outlineProjection } from "./projection.ts"
import type { OutlineEntry } from "./wire.ts"
import { samePageReading, sameNarrowing, sameMoving } from "@olai/format"
import type { FiledPageReading } from "@olai/format"

export default definePlugin({
  name, needs: [Directory, Ops, Vault, Surfaces],
  apply: Effect.gen(function*() {
    const gate = (yield* Ops).gate as Gate
    const vault = yield* Vault
    let ctx: SurfaceRuntime<typeof surface.spec>["ctx"] | undefined
    let held: Projection<OutlineEntry> | undefined
    const empty = new Map<string, OutlineEntry>()
    const revisions = inMemoryChannel<void>()
    yield* vault.revision(snapshot => Effect.sync(() => {
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
        page: { read: input => Effect.runPromise(Effect.map(gate.page(input), value => value as FiledPageReading)), install: (_input, onEvent) => revisions.consume({onEvent, onError: () => {}}), isEqual: samePageReading },
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
    yield* (yield* Surfaces).register({ surface, faces, resources, tools, charter: CHARTER, writes: ["surface/ops/run"], deps, published: value => { ctx = value as typeof ctx } })
  }),
})

export { dispatch } from "./surface.ts"

export { slotContracts as slots } from "./slots.ts"

import { faces as standaloneFaces } from "./surface.ts"
const siblingFaces = { browser: standaloneFaces.browser }
export { siblingFaces as faces }
export { surface } from "./surface.ts"
