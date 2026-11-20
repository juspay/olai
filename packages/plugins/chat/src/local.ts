import type { LocalState, Refusal } from "@olai/plugin-api/services"
import { MemoryFailure } from "@kolu/acp-client"
import { Effect, Semaphore } from "effect"

export type LocalSection = "memory" | "models" | "wake" | "heard" | "live"

export interface ChatLocalState {
  readonly load: (section: LocalSection) => Record<string, unknown> | null
  readonly save: (
    section: LocalSection,
    value: Record<string, unknown>,
  ) => Effect.Effect<void, MemoryFailure>
}

const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}

export const word = (value: unknown): string | null =>
  typeof value === "string" && value !== "" ? value : null

const reasonOf = (failure: Refusal): string => {
  const shaped = failure as { readonly reason?: unknown; readonly why?: unknown }
  if (typeof shaped.reason === "string") return shaped.reason
  if (typeof shaped.why === "string") return shaped.why
  return String(failure)
}

export const openLocalState = (door: LocalState): Effect.Effect<ChatLocalState> =>
  Effect.gen(function*() {
    const loaded = object(yield* door.load)
    let snapshot: Record<LocalSection, Record<string, unknown>> = {
      memory: object(loaded["memory"]),
      models: object(loaded["models"]),
      wake: object(loaded["wake"]),
      heard: object(loaded["heard"]),
      live: object(loaded["live"]),
    }
    const writing = yield* Semaphore.make(1)

    return {
      load: (section) => {
        const value = snapshot[section]
        return Object.keys(value).length === 0 ? null : value
      },
      save: (section, value) =>
        writing.withPermit(Effect.gen(function*() {
          const next = { ...snapshot, [section]: value }
          yield* Effect.mapError(
            door.save(next),
            (failure) => new MemoryFailure({ why: reasonOf(failure) }),
          )
          snapshot = next
        })),
    }
  })

export const ephemeralLocalState = (): ChatLocalState => {
  let snapshot: Record<LocalSection, Record<string, unknown>> = {
    memory: {},
    models: {},
    wake: {},
    heard: {},
    live: {},
  }
  return {
    load: (section) => {
      const value = snapshot[section]
      return Object.keys(value).length === 0 ? null : value
    },
    save: (section, value) => Effect.sync(() => void (snapshot = { ...snapshot, [section]: value })),
  }
}
