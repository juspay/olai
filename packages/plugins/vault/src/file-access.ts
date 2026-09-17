/** Vault owns file-access wire members and the write authority. Readings and
 * subscriptions are acquired on this provider's scope; UI and layout are not dependencies of this half. */

import { bodyKind, samePageReading, type FiledPageReading } from "@olai/format"
import type { Ops as Gate } from "@olai/ops"
import type { VaultSettings as Settings } from "@olai/ops"
import { definePlugin, Directory, Ops, FileKinds, VaultSettings, Surfaces, Vault } from "@olai/plugin-api/services"
import type { Store } from "@olai/ops"
import { Effect, Stream } from "effect"
import { followSubscription } from "./subscription.ts"
import { inMemoryChannel, inMemoryStore, type ImplementSurfaceDeps, type SurfaceRuntime } from "@kolu/surface/server"
import { type Reading } from "@olai/format"
import type { Snapshot } from "@olai/store"
import { surface, faces, resources, type FileKindsState } from "./file-surface.ts"

import type { Projection } from "@olai/surface/projection"
import { headProjection } from "./projection.ts"
import type { Head } from "./wire.ts"
import { NOTHING_WRONG } from "@olai/format"
import { LOADED, type Manifest } from "./wire.ts"
import { outlineDiffOf } from "./outline-diff.ts"
import { openBodyReader } from "./server/body-reader.ts"
import { OutlineRow } from "./format.ts"

export default definePlugin({
  name: "file-access", needs: [Directory, Ops, Vault, Surfaces, FileKinds, VaultSettings, OutlineRow],
  apply: Effect.gen(function*() {
    const store = (yield* Directory).store as Store
    const vault = yield* Vault
    const gate = (yield* Ops).gate as Gate
    const revisions = inMemoryChannel<void>()
    const kinds = yield* FileKinds
    const settings = (yield* VaultSettings) as Settings
    const outlineRow = yield* OutlineRow
    const readBody = yield* openBodyReader(path => store.body(path), () => settings.claims.current)
    const kindState = (): FileKindsState => ({
      outlineRow,
      claims: [...kinds.current().values()].map(({ format: _format, ...claim }) => claim),
    })
    const fileKinds = inMemoryStore<FileKindsState | null>(kindState())
    let ctx: SurfaceRuntime<typeof surface.spec>["ctx"] | undefined
    let held: Projection<Head> | undefined
    const empty = new Map<string, Head>()
    const errors = inMemoryStore(NOTHING_WRONG)
    const manifest = inMemoryStore<Manifest>(null)
    yield* vault.revision<Snapshot<Reading>>(snapshot => Effect.sync(() => {
      const next = headProjection(snapshot, held)
      held = next
      revisions.publish(undefined)
      for (const [key, value] of next.change.upserts) ctx?.collections.heads.upsert(key, value)
      for (const key of next.change.removes) ctx?.collections.heads.remove(key)
      if (ctx) ctx.cells.manifest.set(LOADED)
      else manifest.set(LOADED)
    }))
    yield* vault.unloaded(Effect.sync(() => {
      for (const key of held?.change.entries.keys() ?? []) ctx?.collections.heads.remove(key)
      held = undefined
      revisions.publish(undefined)
      if (ctx) ctx.cells.manifest.set(null)
      else manifest.set(null)
    }))
    const deps: ImplementSurfaceDeps<typeof surface.spec> = {
      /** The framework's `read` expects a promise and the gate returns an
       * Effect. Cross that boundary here for each subscriber's re-read. This
       * effect runs outside the provider fiber: a bad address is reported by
       * `onStreamReadError`, rather than withdrawing the row from everyone. */
      streams: { bodyPage: {
        read: input => {
          if (bodyKind(settings.claims.current, input.address.path) === null) return Promise.reject(new Error("this page requires a claimed body file"))
          return Effect.runPromise(Effect.map(gate.page(input), value => {
          if (value.shows.kind !== "document" && value.shows.kind !== "nothing") throw new Error("this page requires a claimed body file")
          return value as FiledPageReading
        }))
        },
        install: (_input, onEvent) => revisions.consume({ onEvent, onError: () => {} }),
        isEqual: samePageReading,
      } },
      onStreamReadError: error => { Effect.runFork(Effect.logWarning(`vault body page read failed: ${String(error)}`)) },
      procedures: { bodies: { get: ({ input }) => readBody(input.path) }, files: { outlineDiff: ({ input }) => Effect.sync(() => outlineDiffOf(settings.claims.current, input)) } },
      cells: {
        "file-kinds": {
          store: fileKinds,
          connect: cell => Stream.runForEach(kinds.changes, () => Effect.sync(() => cell.set(kindState()))),
        },
        errors: { store: errors, connect: cell => followSubscription(store.errors, value => cell.set(value ?? NOTHING_WRONG)) },
        manifest: { store: manifest }
      },
      collections: {
        heads: { readAll: () => held?.change.entries ?? empty, upsert: () => {}, remove: () => {},  }
      },
    }
    yield* (yield* Surfaces).register({ surface, faces, resources, deps, published: value => { ctx = value as typeof ctx } })
  }),
})
