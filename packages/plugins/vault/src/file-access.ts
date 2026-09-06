/** Vault owns file-access wire members and the write authority. Readings and
 * subscriptions are acquired on this provider's scope; UI and layout are not dependencies of this half. */
import { definePlugin, Directory, Surfaces, Vault } from "@olai/plugin-api/services"
import type { Store } from "@olai/ops"
import { Effect } from "effect"
import { followSubscription } from "./subscription.ts"
import { inMemoryStore, type ImplementSurfaceDeps, type SurfaceRuntime } from "@kolu/surface/server"
import type { Reading } from "@olai/format"
import type { Snapshot } from "@olai/store"
import { surface, faces } from "./file-surface.ts"

import type { Projection } from "@olai/surface/projection"
import { headProjection } from "./projection.ts"
import type { Head } from "./wire.ts"
import { NOTHING_WRONG } from "@olai/format"
import { LOADED, type Manifest } from "./wire.ts"

export default definePlugin({
  name: "file-access", needs: [Directory, Vault, Surfaces],
  apply: Effect.gen(function*() {
    const store = (yield* Directory).store as Store
    const vault = yield* Vault
    let ctx: SurfaceRuntime<typeof surface.spec>["ctx"] | undefined
    let held: Projection<Head> | undefined
    const empty = new Map<string, Head>()
    const errors = inMemoryStore(NOTHING_WRONG)
    const manifest = inMemoryStore<Manifest>(null)
    yield* vault.revision<Snapshot<Reading>>(snapshot => Effect.sync(() => {
      const next = headProjection(snapshot, held)
      held = next
      for (const [key, value] of next.change.upserts) ctx?.collections.heads.upsert(key, value)
      for (const key of next.change.removes) ctx?.collections.heads.remove(key)
      if (ctx) ctx.cells.manifest.set(LOADED)
      else manifest.set(LOADED)
    }))
    yield* vault.unloaded(Effect.sync(() => {
      for (const key of held?.change.entries.keys() ?? []) ctx?.collections.heads.remove(key)
      held = undefined
      if (ctx) ctx.cells.manifest.set(null)
      else manifest.set(null)
    }))
    const deps: ImplementSurfaceDeps<typeof surface.spec> = {
      cells: {
        errors: { store: errors, connect: cell => followSubscription(store.errors, value => cell.set(value ?? NOTHING_WRONG)) },
        manifest: { store: manifest }
      },
      collections: {
        heads: { readAll: () => held?.change.entries ?? empty, upsert: () => {}, remove: () => {},  }
      },
    }
    yield* (yield* Surfaces).register({ surface, faces, root: true, scopedFaces: { browser: faces.browser }, deps, published: value => { ctx = value as typeof ctx } })
  }),
})
