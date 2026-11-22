/**
 * CHAT'S ONE MACHINE-LOCAL DOCUMENT.
 *
 * Core gives this row one {@link LocalState} door, already keyed by the row's
 * name and served directory. Chat keeps model choices, wake picks, heard
 * records, the set of conversations that were live a moment ago and the turns
 * a stop cut short in it. Chat
 * does not read the legacy conversation-selection note. A writer replaces one
 * section under one permit and carries the others, so a model choice cannot
 * erase a doorbell pick or an overheard line.
 */

import type { LocalState, Refusal } from "@olai/plugin-api/services"
import { MemoryFailure } from "@kolu/acp-client"
import { Effect, Semaphore } from "effect"

export type LocalSection = "memory" | "models" | "wake" | "heard" | "live" | "cut"

export interface ChatLocalState {
  /** One section, or `null` when this machine has never written it. */
  readonly load: (section: LocalSection) => Record<string, unknown> | null
  /** Replace one section and carry the other sections in the same snapshot. */
  readonly save: (
    section: LocalSection,
    value: Record<string, unknown>,
  ) => Effect.Effect<void, MemoryFailure>
}

const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}

/** A legible field of this document: a string somebody wrote. Anything else —
 *  a number, a missing key, the empty string — reads as absent, which is how
 *  every section here is parsed leniently without a strange value becoming a
 *  record that half exists. */
export const word = (value: unknown): string | null =>
  typeof value === "string" && value !== "" ? value : null

const reasonOf = (failure: Refusal): string => {
  const shaped = failure as { readonly reason?: unknown; readonly why?: unknown }
  if (typeof shaped.reason === "string") return shaped.reason
  if (typeof shaped.why === "string") return shaped.why
  return String(failure)
}

/** Open the one document once for this activation. */
export const openLocalState = (door: LocalState): Effect.Effect<ChatLocalState> =>
  Effect.gen(function*() {
    const loaded = object(yield* door.load)
    let snapshot: Record<LocalSection, Record<string, unknown>> = {
      memory: object(loaded["memory"]),
      models: object(loaded["models"]),
      wake: object(loaded["wake"]),
      heard: object(loaded["heard"]),
      live: object(loaded["live"]),
      cut: object(loaded["cut"]),
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

/** A standalone panel keeps nothing across constructions. Product supplies the
 *  real door; most state-machine tests intentionally exercise no filesystem. */
export const ephemeralLocalState = (): ChatLocalState => {
  let snapshot: Record<LocalSection, Record<string, unknown>> = {
    memory: {},
    models: {},
    wake: {},
    heard: {},
    live: {},
    cut: {},
  }
  return {
    load: (section) => {
      const value = snapshot[section]
      return Object.keys(value).length === 0 ? null : value
    },
    save: (section, value) => Effect.sync(() => void (snapshot = { ...snapshot, [section]: value })),
  }
}
