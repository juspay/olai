/**
 * THE HELD DOOR — one opaque record per plugin per vault, in the state home.
 *
 * Core owns the file. Writes are chained so the last snapshot handed over is
 * the one that lands: `@olai/state`'s staged rename cannot tear, but concurrent
 * writes are unordered ("either may win"), and a drain that persisted
 * `queue:[B]` then `queue:[]` cannot have the empty lose the rename race to
 * the earlier one and come back on the next boot as a digest already posted.
 *
 * A plugin never imports `@olai/state`. The door is keyed by the plugin's
 * `name` the way `deliveries` is.
 */

import { Effect } from "effect"
import { readFileSync } from "node:fs"

import type { PluginHeld } from "@olai/plugin-api/server"
import {
  canonical,
  fileForHold,
  writeHeld,
  type Held,
  type StateFailure,
} from "@olai/state"

export const heldFor = (
  plugin: string,
  served: string,
  warn: (line: string) => void,
  write: (
    at: string,
    held: Held & Record<string, unknown>,
  ) => Effect.Effect<void, StateFailure> = writeHeld,
): PluginHeld => {
  const cwd = canonical(served)
  const at = fileForHold(plugin, cwd)
  let saving = Promise.resolve()
  return {
    load: () => {
      try {
        const raw: unknown = JSON.parse(readFileSync(at, "utf8"))
        if (raw === null || typeof raw !== "object") {
          warn(`plugin ${plugin}: \`${at}\` is not a hold object`)
          return null
        }
        const record = raw as Record<string, unknown>
        return record.cwd === cwd ? record : null
      } catch (cause) {
        if ((cause as { readonly code?: unknown }).code === "ENOENT") return null
        warn(
          `plugin ${plugin}: \`${at}\` could not be read: ${
            cause instanceof Error ? cause.message : String(cause)
          }`,
        )
        return null
      }
    },
    save: (value) => {
      const held = { cwd, ...value }
      saving = saving.then(() =>
        Effect.runPromise(write(at, held)).then(undefined, (error: unknown) => {
          warn(
            `plugin ${plugin}: hold could not be written (${
              error instanceof Error ? error.message : String(error)
            })`,
          )
        }),
      )
    },
  }
}
