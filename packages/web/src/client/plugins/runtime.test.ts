import { afterEach, expect, test } from "bun:test"
import { definePlugin, Offers, serviceTag, Slots } from "@olai/plugin-api"
import { Effect } from "effect"
import { app, browserHint, composeTo } from "./runtime.ts"

const client = () => null
const Value = serviceTag<{ version: string }>("source.value")
afterEach(() => composeTo([], client))

test("a browser component reports its missing key while its parent keeps its faces", async () => {
  let reading: string | null = null
  const consumer = {
    default: definePlugin({ name: "reader", needs: [Slots], apply: Effect.gen(function*() {
      yield* (yield* Slots).register("app.viewer", () => "surviving parent")
    }) }),
    components: { detail: definePlugin({ name: "ignored", needs: [Value], apply: Effect.gen(function*() {
      const value = yield* Value
      yield* Effect.acquireRelease(Effect.sync(() => { reading = value.version }), () => Effect.sync(() => { reading = null }))
    }) }) },
  }
  const source = (version: string) => ({ default: definePlugin({ name: "source", needs: [Offers], apply: Effect.gen(function*() {
    yield* Effect.addFinalizer(() => Effect.sync(() => { expect(reading).toBeNull() }))
    yield* (yield* Offers).own("value", () => ({ version }))
  }) }) })
  await composeTo([consumer], client)
  expect(browserHint("reader")).toBe("Browser detail: waiting for source.value.")
  expect(app.only("app.viewer")?.face()).toBe("surviving parent")
  await composeTo([consumer, source("first")], client)
  expect<string | null>(reading).toBe("first")
  expect(browserHint("reader")).toBeNull()
  await composeTo([consumer], client)
  expect(reading).toBeNull()
  expect(browserHint("reader")).toContain("source.value")
  expect(app.only("app.viewer")?.face()).toBe("surviving parent")
  await composeTo([consumer, source("second")], client)
  expect<string | null>(reading).toBe("second")
  await composeTo([], client)
  expect(browserHint("reader")).toBeNull()
})

test("failed browser activation stays visible after cleanup and clears on retry", async () => {
  let fail = true
  const half = { default: definePlugin({ name: "flaky", needs: [Slots], apply: Effect.gen(function*() {
    yield* (yield* Slots).register("app.viewer", () => "ready")
    if (fail) yield* Effect.die(new Error("reader failed"))
  }) }) }
  await composeTo([half], client)
  expect(browserHint("flaky")).toContain("reader failed")
  expect(app.only("app.viewer")).toBeNull()
  fail = false
  await composeTo([half], client)
  expect(browserHint("flaky")).toBeNull()
  expect(app.only("app.viewer")?.face()).toBe("ready")
})

test("a consumer that fails after waiting is visible and retried on the next composition", async () => {
  let fail = true
  const reader = { default: definePlugin({ name: "reader", needs: [Value], apply: Effect.suspend(() =>
    fail ? Effect.die(new Error("late failure")) : Effect.void,
  ) }) }
  const source = { default: definePlugin({ name: "source", needs: [Offers], apply: Effect.gen(function*() {
    yield* (yield* Offers).own("value", () => ({ version: "ready" }))
  }) }) }
  await composeTo([reader], client)
  expect(browserHint("reader")).toContain("source.value")
  await composeTo([reader, source], client)
  // The dependency-triggered activation finishes after the provider itself.
  for (let turn = 0; turn < 100 && !browserHint("reader")?.includes("late failure"); turn++) {
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  expect(browserHint("reader")).toContain("late failure")
  fail = false
  await composeTo([reader, source], client)
  expect(browserHint("reader")).toBeNull()
})
