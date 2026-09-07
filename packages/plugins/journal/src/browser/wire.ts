/**
 * THIS PLUGIN'S OWN SIBLING CLIENT, as the tab reads it — a holder of the READ
 * rather than the client, and an acquisition on the activation's own scope.
 * `olai-plugin-chat`'s `browser/wire.ts` carries both arguments.
 */
import type { SurfaceClient } from "@kolu/surface/solid"
import { Effect, type Scope } from "effect"

import type { surface } from "../wire.ts"

export type JournalClient = SurfaceClient<typeof surface.spec>

let held: (() => JournalClient) | null = null

export const holdJournalWire = (
  read: () => JournalClient,
): Effect.Effect<void, never, Scope.Scope> =>
  Effect.acquireRelease(
    Effect.sync(() => { held = read }),
    () => Effect.sync(() => { if (held === read) held = null }),
  )

export const journalWire = (): JournalClient => {
  if (held === null) throw new Error("journal wire read before its browser half mounted")
  return held()
}
