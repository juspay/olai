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
