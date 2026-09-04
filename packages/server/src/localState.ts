/**
 * THE LOCAL-STATE DOOR — one opaque record per plugin per vault, in the state home.
 *
 * Core owns the file. Writes are chained so the last snapshot handed over is
 * the one that lands: `@olai/state`'s staged rename cannot tear, but concurrent
 * writes are unordered ("either may win"), and a drain that persisted
 * `queue:[B]` then `queue:[]` cannot have the empty lose the rename race to
 * the earlier one and come back on the next boot as a digest already posted.
 *
 * A plugin never imports `@olai/state`. The door is keyed by the plugin's
 * `name` the way `deliveries` is.
 *
 * ## THE CHAIN IS PER DOOR, SO THE DOOR HAS TO BE PER PLUGIN — and this file
 * ## cannot make that true on its own
 *
 * `saving` below is a closure variable, so every call to this function mints a
 * fresh chain and two doors for one plugin order nothing against each other. The
 * ordering above is therefore a claim about the CALLER: `@olai/plugin-api`'s
 * `openPlugins` memoises the door by plugin NAME, and its own paragraph argues
 * why by name rather than per activation — a plugin that unloads and comes back
 * is two fibers writing one path, and the file does not care which fiber a
 * snapshot came from.
 *
 * It was memoised per CALL first, which fixed the reachable half and left the
 * other one open for as long as no server half could unload mid-serve. A row
 * that stands behind another row's doors makes that routine, which is what
 * closed it.
 */

import { Effect } from "effect"
import { readFileSync } from "node:fs"

import type { PluginLocalState } from "@olai/plugin-api"
import {
  canonical,
  layoutForLocal,
  writeLocal,
  type LocalRecord,
  type StateFailure,
} from "@olai/state"

export const localStateFor = (
  plugin: string,
  served: string,
  warn: (line: string) => void,
  write: (
    at: string,
    local: LocalRecord & Record<string, unknown>,
  ) => Effect.Effect<void, StateFailure> = writeLocal,
): PluginLocalState => {
  const cwd = canonical(served)
  const layout = layoutForLocal(plugin, cwd)
  const at = layout.at
  let saving = Promise.resolve()
  let loaded = false
  let record: Record<string, unknown> | null = null
  let migrating: ReadonlyArray<string> = []

  const read = (from: string): Record<string, unknown> | null | undefined => {
    try {
      const raw: unknown = JSON.parse(readFileSync(from, "utf8"))
      if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
        warn(`plugin ${plugin}: \`${from}\` is not a local-state object`)
        return undefined
      }
      const one = raw as Record<string, unknown>
      return one.cwd === cwd ? one : null
    } catch (cause) {
      if ((cause as { readonly code?: unknown }).code === "ENOENT") return null
      warn(
        `plugin ${plugin}: \`${from}\` could not be read: ${
          cause instanceof Error ? cause.message : String(cause)
        }`,
      )
      return undefined
    }
  }

  const withoutCwd = (one: Record<string, unknown>): Record<string, unknown> => {
    const { cwd: _cwd, ...value } = one
    return value
  }

  const load = (): Record<string, unknown> | null => {
    if (loaded) return record
    loaded = true
    const current = read(at)
    if (current === undefined) return null

    const sectioned = layout.unsectioned !== undefined && current !== null &&
      ["memory", "wake", "heard"].some((section) => section in current)
    if (current !== null && (layout.unsectioned === undefined || sectioned)) {
      record = current
      return record
    }

    const merged: Record<string, unknown> = {}
    const sources: Array<string> = []
    if (current !== null && layout.unsectioned !== undefined) {
      merged[layout.unsectioned] = withoutCwd(current)
      sources.push(at)
    }
    for (const legacy of layout.legacy) {
      const old = read(legacy.at)
      if (old === undefined) continue
      if (old === null) continue
      if (legacy.section === undefined) {
        if (Object.keys(merged).length === 0) {
          record = old
          migrating = [legacy.at]
          return record
        }
        continue
      }
      merged[legacy.section] = withoutCwd(old)
      sources.push(legacy.at)
    }
    if (Object.keys(merged).length > 0) {
      record = { cwd, ...merged }
      migrating = sources
    }
    return record
  }

  return {
    load,
    save: (value) => {
      const local = { cwd, ...value }
      record = local
      loaded = true
      saving = saving.then(() =>
        Effect.runPromise(write(at, local)).then(
          () => {
            if (migrating.length === 0) return
            warn(
              `plugin ${plugin}: migrated machine-local state from ${
                migrating.map((from) => `\`${from}\``).join(", ")
              } to \`${at}\`; the old files are inert`,
            )
            migrating = []
          },
          (error: unknown) => {
            warn(
              `plugin ${plugin}: local state could not be written (${
                error instanceof Error ? error.message : String(error)
              })`,
            )
          },
        ),
      )
    },
  }
}
