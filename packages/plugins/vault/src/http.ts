/** File bytes and explicit resynchronization leave with the vault activation. */
import { definePlugin, Directory, Ops } from "@olai/plugin-api/services"
import { TransportSurface } from "@olai/plugin-api/transport"
import type { Directory as OpenDirectory, Ops as Gate } from "@olai/ops"
import { Effect, Layer } from "effect"
import { mediaLayer } from "./http/media.ts"
import { resyncDirectory, resyncRoute } from "./http/resync.ts"

export default definePlugin({
  name: "http", needs: [Directory, Ops, TransportSurface],
  apply: Effect.gen(function*() {
    const directory = (yield* Directory) as OpenDirectory
    const gate = (yield* Ops).gate as Gate
    let active = true
    yield* Effect.addFinalizer(() => Effect.sync(() => { active = false }))
    yield* (yield* TransportSurface).register({ routes: Layer.mergeAll(
      mediaLayer(directory.root),
      resyncRoute(resyncDirectory(() => active ? directory : undefined, () => active ? gate : undefined)),
    ) })
  }),
})
