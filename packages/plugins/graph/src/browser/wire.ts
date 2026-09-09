/**
 * THIS PLUGIN'S OWN SIBLING CLIENT, as the tab reads it — a holder of the
 * READ rather than the client, and an acquisition on the activation's own
 * scope. `journal/src/browser/wire.ts` carries the argument (and itself defers
 * to `olai-plugin-chat`'s); this file is that pattern with this surface's
 * name on it.
 */
import type { SurfaceClient } from "@kolu/surface/solid"
import { Effect, type Scope } from "effect"

import type { surface } from "../wire.ts"

export type GraphClient = SurfaceClient<typeof surface.spec>

let held: (() => GraphClient) | null = null

export const holdGraphWire = (
  read: () => GraphClient,
): Effect.Effect<void, never, Scope.Scope> =>
  Effect.acquireRelease(
    Effect.sync(() => { held = read }),
    () => Effect.sync(() => { if (held === read) held = null }),
  )

export const graphWire = (): GraphClient => {
  if (held === null) throw new Error("graph wire read before its browser half mounted")
  return held()
}
