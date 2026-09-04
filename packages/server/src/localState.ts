/**
 * THE LOCAL-STATE DOOR — one opaque record per plugin per vault.
 *
 * Core owns the file and the ordering. The plugin owns the record's fields.
 * One permit contains both the first read and every write, so a returning
 * plugin sees the same snapshot a restart will see and a failed save is visible
 * to the effect that asked for it.
 *
 * The caller mints this door once per plugin name. Two doors would mean two
 * chains writing the same path; `openPlugins` keeps the name-to-door map.
 */

import { Effect, Semaphore } from "effect"
import { join } from "node:path"

import type { LocalState } from "@olai/plugin-api/services"
import {
  canonical,
  digestOf,
  fileForLocal,
  readLocal,
  stateHome,
  writeLocal,
  type LocalRecord,
  StateFailure,
} from "@olai/state"

type ChatSection = "memory" | "wake" | "heard"

interface LegacyLocalFile {
  readonly at: string
  readonly section?: ChatSection
}

interface LegacyLayout {
  /** Chat's old memory file already occupies its new path. */
  readonly unsectioned?: "memory"
  readonly files: ReadonlyArray<LegacyLocalFile>
}

/**
 * Plugin history belongs at the door that knows the plugin name, not in the
 * filesystem leaf. Remove these rows after the first release containing the
 * LocalState layout has itself been superseded by a release.
 */
const legacyFor = (plugin: string, cwd: string): LegacyLayout => {
  const digest = digestOf(cwd)
  return {
    ...(plugin === "chat" ? { unsectioned: "memory" as const } : {}),
    files: [
      { at: join(stateHome(), "hold", `${digest}.${plugin}.json`) },
      ...(plugin === "chat"
        ? [
          { at: join(stateHome(), "wake", `${digest}.json`), section: "wake" as const },
          { at: join(stateHome(), "heard", `${digest}.json`), section: "heard" as const },
        ]
        : []),
      ...(plugin === "xyne-spaces"
        ? [{ at: join(stateHome(), "mirror", `${digest}.json`) }]
        : []),
    ],
  }
}

const withoutCwd = (one: Record<string, unknown>): Record<string, unknown> => {
  const { cwd: _cwd, ...value } = one
  return value
}

export const localStateFor = (
  plugin: string,
  served: string,
  warn: (line: string) => void,
  write: (
    at: string,
    local: LocalRecord & Record<string, unknown>,
  ) => Effect.Effect<void, StateFailure> = writeLocal,
): LocalState => {
  const cwd = canonical(served)
  const at = fileForLocal(plugin, cwd)
  const legacy = legacyFor(plugin, cwd)
  const gate = Semaphore.makeUnsafe(1)
  let loaded = false
  let record: Record<string, unknown> | null = null
  let migrating: ReadonlyArray<string> = []

  const read = (from: string): Effect.Effect<Record<string, unknown> | null | undefined> =>
    Effect.match(readLocal(from, cwd), {
      onFailure: (failure) => {
        warn(`plugin ${plugin}: ${failure.why}`)
        return undefined
      },
      onSuccess: (value) => value,
    })

  const readOnce: Effect.Effect<Record<string, unknown> | null> = Effect.gen(function*() {
    const current = yield* read(at)
    if (current === undefined) return null

    const sectioned = legacy.unsectioned !== undefined && current !== null &&
      ["memory", "wake", "heard"].some((section) => section in current)
    if (current !== null && (legacy.unsectioned === undefined || sectioned)) return current

    const merged: Record<string, unknown> = {}
    const sources: Array<string> = []
    if (current !== null && legacy.unsectioned !== undefined) {
      merged[legacy.unsectioned] = withoutCwd(current)
      sources.push(at)
    }
    for (const old of legacy.files) {
      const value = yield* read(old.at)
      if (value === undefined || value === null) continue
      if (old.section === undefined) {
        if (Object.keys(merged).length === 0) {
          migrating = [old.at]
          return value
        }
        continue
      }
      merged[old.section] = withoutCwd(value)
      sources.push(old.at)
    }
    if (Object.keys(merged).length === 0) return null
    migrating = sources
    return { cwd, ...merged }
  })

  const loadOnce: Effect.Effect<Record<string, unknown> | null> = Effect.suspend(() =>
    loaded ? Effect.succeed(record) : Effect.map(readOnce, (value) => {
      record = value
      loaded = true
      return value
    }))

  return {
    load: gate.withPermit(loadOnce),
    save: (value) =>
      gate.withPermit(Effect.gen(function*() {
        yield* loadOnce
        const local = { cwd, ...value }
        yield* Effect.tapError(
          write(at, local),
          (failure) =>
            Effect.sync(() =>
              warn(`plugin ${plugin}: local state could not be written (${failure.why})`)),
        )
        record = local
        if (migrating.length > 0) {
          warn(
            `plugin ${plugin}: migrated machine-local state from ${
              migrating.map((from) => `\`${from}\``).join(", ")
            } to \`${at}\`; the old files are inert`,
          )
          migrating = []
        }
      })),
  }
}
