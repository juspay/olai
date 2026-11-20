import { heldService } from "@olai/ui-primitives/held.ts"
import type { SurfaceClient } from "@kolu/surface/solid"
import { Effect, type Scope } from "effect"

import type { surface } from "../wire.ts"

export type ChatClient = SurfaceClient<typeof surface.spec>

const provider = heldService<() => ChatClient>()

export const holdChatWire = (
  read: () => ChatClient,
): Effect.Effect<void, never, Scope.Scope> =>
  Effect.acquireRelease(
    Effect.sync(() => provider.hold(read)),
    (drop) => Effect.sync(drop),
  )

export const chatWire = (): ChatClient => {
  const read = provider.read()
  if (read === undefined) {
    throw new Error(
      "olai-plugin-chat: a face read the chat's wire before the plugin was mounted — "
        + "the tab dials a sibling and then mounts its half, in that order",
    )
  }
  return read()
}
