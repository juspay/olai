import type { SurfaceClient } from "@kolu/surface/solid"
import { Effect, type Scope } from "effect"

import type { surface } from "../wire.ts"

export type ChatClient = SurfaceClient<typeof surface.spec>

let held: (() => ChatClient) | null = null

export const holdChatWire = (
  read: () => ChatClient,
): Effect.Effect<void, never, Scope.Scope> =>
  Effect.acquireRelease(
    Effect.sync(() => { held = read }),
    () => Effect.sync(() => { if (held === read) held = null }),
  )

export const chatWire = (): ChatClient => {
  if (held === null) {
    throw new Error(
      "olai-plugin-chat: a face read the chat's wire before the plugin was mounted — "
        + "the tab dials a sibling and then mounts its half, in that order",
    )
  }
  return held()
}
