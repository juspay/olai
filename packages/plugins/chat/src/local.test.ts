import { describe, expect, test } from "bun:test"
import type { LocalState } from "@olai/plugin-api/services"
import { Effect } from "effect"

import { openLocalState } from "./local.ts"

const run = <A, E>(effect: Effect.Effect<A, E>): Promise<A> => Effect.runPromise(effect)

describe("chat's one machine-local document", () => {
  test("one section cannot erase either neighbour", async () => {
    let record: Record<string, unknown> = {
      memory: { session: "sess-1" },
      wake: { scopes: [{ plugin: "kolu" }] },
      heard: { heard: [{ session: "sess-1" }] },
    }
    const door: LocalState = {
      load: Effect.succeed(record),
      save: (next) => Effect.sync(() => void (record = next)),
    }
    const local = await run(openLocalState(door))

    await run(local.save("memory", { session: "sess-2" }))

    expect(record).toEqual({
      memory: { session: "sess-2" },
      wake: { scopes: [{ plugin: "kolu" }] },
      heard: { heard: [{ session: "sess-1" }] },
    })
  })

  test("simultaneous section writes share one lane", async () => {
    let record: Record<string, unknown> = {}
    const door: LocalState = {
      load: Effect.succeed(null),
      save: (next) => Effect.gen(function*() {
        yield* Effect.yieldNow
        record = next
      }),
    }
    const local = await run(openLocalState(door))

    await Promise.all([
      run(local.save("wake", { scopes: [{ plugin: "kolu" }] })),
      run(local.save("heard", { heard: [{ session: "sess-1" }] })),
    ])

    expect(record).toEqual({
      memory: {},
      wake: { scopes: [{ plugin: "kolu" }] },
      heard: { heard: [{ session: "sess-1" }] },
    })
  })

  test("a fresh activation sees the record the previous one left", async () => {
    let record: Record<string, unknown> | null = null
    const door: LocalState = {
      load: Effect.sync(() => record),
      save: (next) => Effect.sync(() => void (record = next)),
    }
    const first = await run(openLocalState(door))
    await run(first.save("memory", { agent: "claude", session: "sess-1" }))
    await run(first.save("wake", { scopes: [{ plugin: "kolu" }] }))

    const afterFlip = await run(openLocalState(door))

    expect(afterFlip.load("memory")).toEqual({ agent: "claude", session: "sess-1" })
    expect(afterFlip.load("wake")).toEqual({ scopes: [{ plugin: "kolu" }] })
  })
})
