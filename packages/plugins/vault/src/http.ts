/** File bytes and explicit resynchronization leave with the vault activation. */

import type { VaultSettings as Settings } from "@olai/ops"
import { definePlugin, Directory, VaultSettings, Ops } from "@olai/plugin-api/services"
import { TransportSurface } from "@olai/plugin-api/transport"
import type { Directory as OpenDirectory, Ops as Gate } from "@olai/ops"
import { Effect, Layer } from "effect"
import { mediaLayer } from "./http/media.ts"
import { resyncDirectory, resyncRoute } from "./http/resync.ts"

export default definePlugin({
  name: "http", needs: [Directory, Ops, VaultSettings, TransportSurface],
  apply: Effect.gen(function*() {
    const directory = (yield* Directory) as OpenDirectory
    const settings = (yield* VaultSettings) as Settings
    const gate = (yield* Ops).gate as Gate
    let active = true
    yield* Effect.addFinalizer(() => Effect.sync(() => { active = false }))
    yield* (yield* TransportSurface).register({ passive: true, routes: Layer.mergeAll(
      mediaLayer(directory.root, () => settings.claims.current),
      resyncRoute(resyncDirectory(() => active ? directory : undefined, () => active ? gate : undefined)),
    ) })
  }),
})
