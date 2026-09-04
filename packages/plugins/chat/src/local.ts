/**
 * CHAT'S ONE MACHINE-LOCAL DOCUMENT.
 *
 * Core gives this row one {@link LocalState} door, already keyed by the row's
 * name and served directory. Chat keeps three independently capped readings in
 * it. This adapter is the one owner of their shared snapshot: a writer replaces
 * one section under one permit and carries the other two, so a memory write can
 * never erase a doorbell pick or an overheard line.
 */

import type { LocalState } from "@olai/plugin-api/services"
import { Effect, Semaphore } from "effect"

export type LocalSection = "memory" | "wake" | "heard"

export interface ChatLocalState {
  /** One section, or `null` when this machine has never written it. */
  readonly load: (section: LocalSection) => Record<string, unknown> | null
  /** Replace one section and carry the other two in the same snapshot. */
  readonly save: (
    section: LocalSection,
    value: Record<string, unknown>,
  ) => Effect.Effect<void>
}

const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}

/** Open the one document once for this activation. */
export const openLocalState = (door: LocalState): Effect.Effect<ChatLocalState> =>
  Effect.gen(function*() {
    const loaded = object(yield* door.load)
    let snapshot: Record<LocalSection, Record<string, unknown>> = {
      memory: object(loaded["memory"]),
      wake: object(loaded["wake"]),
      heard: object(loaded["heard"]),
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
          yield* door.save(next)
          snapshot = next
        })),
    }
  })

/** A standalone panel keeps nothing across constructions. Product supplies the
 *  real door; most state-machine tests intentionally exercise no filesystem. */
export const ephemeralLocalState = (): ChatLocalState => {
  let snapshot: Record<LocalSection, Record<string, unknown>> = {
    memory: {},
    wake: {},
    heard: {},
  }
  return {
    load: (section) => {
      const value = snapshot[section]
      return Object.keys(value).length === 0 ? null : value
    },
    save: (section, value) => Effect.sync(() => void (snapshot = { ...snapshot, [section]: value })),
  }
}
