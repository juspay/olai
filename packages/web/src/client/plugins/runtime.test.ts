import { afterEach, expect, test } from "bun:test"
import { definePlugin, Offers, serviceTag, Slots, Wired } from "@olai/plugin-api"
import { Effect } from "effect"
import { app, browserReports, composeTo } from "./runtime.ts"

import { browserHint } from "./rows.ts"

const hint = (plugin: string) => browserHint(plugin, browserReports())
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
  expect(hint("reader")).toBe("Browser detail: waiting for source.value.")
  expect(app.only("app.viewer")?.face()).toBe("surviving parent")
  await composeTo([consumer, source("first")], client)
  expect<string | null>(reading).toBe("first")
  expect(hint("reader")).toBeNull()
  await composeTo([consumer], client)
  expect(reading).toBeNull()
  expect(hint("reader")).toContain("source.value")
  expect(app.only("app.viewer")?.face()).toBe("surviving parent")
  await composeTo([consumer, source("second")], client)
  expect<string | null>(reading).toBe("second")
  await composeTo([], client)
  expect(hint("reader")).toBeNull()
})

test("failed browser activation stays visible after cleanup and clears on retry", async () => {
  let fail = true
  const half = { default: definePlugin({ name: "flaky", needs: [Slots], apply: Effect.gen(function*() {
    yield* (yield* Slots).register("app.viewer", () => "ready")
    if (fail) yield* Effect.die(new Error("reader failed"))
  }) }) }
  await composeTo([half], client)
  expect(hint("flaky")).toContain("reader failed")
  expect(app.only("app.viewer")).toBeNull()
  fail = false
  await composeTo([half], client)
  expect(hint("flaky")).toBeNull()
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
  expect(hint("reader")).toContain("source.value")
  await composeTo([reader, source], client)
  // The dependency-triggered activation finishes after the provider itself.
  for (let turn = 0; turn < 100 && !hint("reader")?.includes("late failure"); turn++) {
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  expect(hint("reader")).toContain("late failure")
  fail = false
  await composeTo([reader, source], client)
  expect(hint("reader")).toBeNull()
})

test("component lifetimes spend their owning plugin's wire, slot and service namespace", async () => {
  let wire: unknown
  const consumers: string[] = []
  let reading: string | null = null
  const provider = {
    default: definePlugin({ name: "source", needs: [], apply: Effect.void }),
    components: { detail: definePlugin({
      // The author of a component cannot choose a different plugin owner.
      name: "somebody-else", needs: [Offers, Slots, Wired], apply: Effect.gen(function*() {
        wire = (yield* Wired).client()
        yield* (yield* Slots).register("app.header", { place: "cluster", body: () => "detail" })
        yield* (yield* Offers).own("value", (consumer) => {
          consumers.push(consumer)
          return { version: "component" }
        })
      }),
    }) },
  }
  const reader = { default: definePlugin({ name: "reader", needs: [], apply: Effect.void }),
    components: { detail: definePlugin({ name: "ignored", needs: [Value], apply: Effect.gen(function*() {
    const value = yield* Value
    yield* Effect.acquireRelease(Effect.sync(() => { reading = value.version }), () => Effect.sync(() => { reading = null }))
  }) }) } }
  await composeTo([reader, provider], (owner) => ({ owner }))
  expect(consumers).toEqual(["reader"])
  expect(wire).toEqual({ owner: "source" })
  expect(app.hung("app.header").map((row) => row.plugin)).toEqual(["source"])
  expect<string | null>(reading).toBe("component")
  expect(hint("source")).toBeNull()
  await composeTo([reader, { default: provider.default }], client)
  expect(app.hung("app.header")).toEqual([])
  expect(reading).toBeNull()
  expect(hint("reader")).toContain("source.value")
})
