/**
 * THE CI WATCH at its bench — a service that is not there is silence, and
 * reclaiming a boarded id with no service publishes nothing.
 */

import { Effect } from "effect"
import { expect, test } from "bun:test"

import { makeWatch, type WatchDeps } from "./runs.ts"
import { ODU_UNDIALED } from "./wire/index.ts"

const bench = (): { readonly published: number; readonly deps: WatchDeps } => {
  let published = 0
  return {
    get published() { return published },
    deps: {
      publish: () => { published += 1 },
      service: () => {},
      rang: () => {},
      say: () => {},
      warn: () => {},
      env: {},
      now: () => "2026-09-12T00:00:00.000Z",
      dial: async () => {
        throw new Error("nothing serving")
      },
    },
  }
}

test("a boarded id with no service publishes nothing to the chip", () => {
  const it = bench()
  const watch = makeWatch(it.deps)
  watch.reclaim([{ id: "m1kb0e11-2c8d", node: "lane-a", title: "the seam" }])
  expect(watch.rows()).toEqual([])
  expect(ODU_UNDIALED.status).toBe("absent")
})

test("dropping a boarded id is idempotent", () => {
  const it = bench()
  const watch = makeWatch(it.deps)
  watch.reclaim([{ id: "m1kb0e11-2c8d", node: "lane-a", title: "the seam" }])
  watch.reclaim([])
  expect(watch.rows()).toEqual([])
  return Effect.runPromise(Effect.void)
})
