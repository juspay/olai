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

import type { LocalState } from "@olai/plugin-api/services"
import {
  canonical,
  fileForLocal,
  readLocal,
  writeLocal,
  type LocalRecord,
  StateFailure,
} from "@olai/state"

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
  const gate = Semaphore.makeUnsafe(1)
  let loaded = false
  let record: Record<string, unknown> | null = null

  // There is one current path. Missing and unreadable both load as absence;
  // the warning distinguishes a failed read without adding a cache state.
  const readOnce = Effect.match(readLocal(at, cwd), {
    onFailure: (failure) => {
      warn(`plugin ${plugin}: ${failure.why}`)
      return null
    },
    onSuccess: (value) => value,
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
      })),
  }
}
