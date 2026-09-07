/**
 * THIS PLUGIN'S OWN SIBLING CLIENT, as the tab reads it.
 *
 * A holder of the READ, not the client — the tab redials, so a module-scope
 * constant would be a handle onto a dead wire. See `olai-plugin-chat`'s
 * `browser/wire.ts` for the full argument, and for why the hold is an
 * acquisition on the activation's own scope rather than a bare assignment.
 */

import type { SurfaceClient } from "@kolu/surface/solid"
import { Effect, type Scope } from "effect"

import type { surface } from "../wire.ts"

export type GitClient = SurfaceClient<typeof surface.spec>

let held: (() => GitClient) | null = null

export const holdGitWire = (
  read: () => GitClient,
): Effect.Effect<void, never, Scope.Scope> =>
  Effect.acquireRelease(
    Effect.sync(() => { held = read }),
    () => Effect.sync(() => { if (held === read) held = null }),
  )

export const gitWire = (): GitClient => {
  if (held === null) {
    throw new Error("olai-plugin-git: the sibling client was read before apply held it")
  }
  return held()
}
