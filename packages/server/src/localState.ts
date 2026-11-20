import { Effect, Semaphore } from "effect"

import type { LocalState } from "@olai/plugin-api/services"
import {
  canonical,
  directoryForLocal,
  fileForLocal,
  openLocalDirectory,
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
  const at = fileForLocal(plugin, served)
  const gate = Semaphore.makeUnsafe(1)
  let loaded = false
  let record: Record<string, unknown> | null = null

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

  const directory = Effect.tapError(
    Effect.suspend(() => openLocalDirectory(directoryForLocal(plugin, served), cwd)),
    (failure) => Effect.sync(() => warn(`plugin ${plugin}: local directory unavailable (${failure.why})`)),
  )

  return {
    directory,
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
