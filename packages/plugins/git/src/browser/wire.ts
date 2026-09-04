/**
 * THIS PLUGIN'S OWN SIBLING CLIENT, as the tab reads it.
 *
 * A holder of the READ, not the client — the tab redials, so a module-scope
 * constant would be a handle onto a dead wire. See `olai-plugin-chat`'s
 * `browser/wire.ts` for the full argument.
 */

import type { SurfaceClient } from "@kolu/surface/solid"

import type { surface } from "../wire.ts"

export type GitClient = SurfaceClient<typeof surface.spec>

let held: (() => GitClient) | null = null

export const holdGitWire = (read: () => GitClient): void => {
  held = read
}

export const gitWire = (): GitClient => {
  if (held === null) {
    throw new Error("olai-plugin-git: the sibling client was read before apply held it")
  }
  return held()
}
