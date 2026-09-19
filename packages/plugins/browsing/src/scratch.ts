import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { Effect } from "effect"

/** Plugin-owned spill area, following mail's attachment-directory acquisition.
 * Existing engine sessions may outlive it; it is never durable storage. */
export const openScratch = (runtime: string | undefined) => Effect.acquireRelease(
  Effect.promise(() => mkdtemp(join(resolve(runtime?.trim() || tmpdir()), "olai-browser-"))),
  path => Effect.promise(() => rm(path, { recursive: true, force: true })),
)
