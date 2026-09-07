import { location as slotContract } from "@olai/plugin-api"
import { afterEach, expect, test } from "bun:test"
import { definePlugin, Offers, serviceTag, Slots, Wired, locations, location, slotFacade, slotLocation } from "@olai/plugin-api"
import type { SlotDefinition } from "@olai/plugin-api/slots"
import { Effect } from "effect"
import { app, browserReports, composeTo as compose } from "./runtime.ts"

/**
 * THE HOST, NOT THE FURNITURE — and so the two slot names this bench needs are
 * its own.
 *
 * It got them by importing `olai-plugin-layout/slots` for the side effect of
 * that module's `declare module`, which is the whole of what a `import type {}`
 * with no bindings was doing: the boot package's own runtime suite spelled a
 * plugin to borrow two type-level names. What is under test here is
 * `./runtime.ts` — who is mounted, whose fibers survive a re-compose, which
 * owner a component spends, what a failed `apply` leaves behind — and none of
 * that knows or cares what `app.header` draws. A borrowed fixture is how
 * `@olai/bundle`'s `fence.test.ts` came to read `olai-plugin-layout` for
 * `@olai/web`, where the table now holds an empty list.
 *
 * TWO NAMES NOBODY SERVES, therefore, and one of each KIND the assertions
 * below actually exercise: an `app`-keyed seat, so `only` has a single slot to
 * answer for, and a `plugin`-keyed one, so `hung` has an owner to carry. The
 * faces answer STRINGS because every assertion reads what a face returned, and
 * a string is the smallest value two registrations can be told apart by — a
 * `JSX.Element` here would put a UI runtime on the graph of a test about
 * fibers.
 */
declare module "@olai/plugin-api/slots" {
  interface SlotDefinitions {
    "bench.seat": SlotDefinition<() => string, "app">
    "bench.mark": SlotDefinition<{ readonly place: string; readonly body: () => string }, "plugin">
  }
}


const renderer = { default: definePlugin({ name: "ui-renderer", needs: [Offers], apply: Effect.gen(function*() {
  const store = yield* locations()
  const facade = slotFacade(store)
  const offers = yield* Offers
  yield* offers.own("legacy-slots", facade.forOwner)
  yield* offers.own("faces", () => facade.faces)
  yield* offers.own("integrations", () => facade.management)
  yield* store.forOwner("test-shell").contribute(location("root", "one"), null, {
    children: [location("bench.mark","many","owner"),location("bench.seat","one")],
  })
}) }) }
const composeTo: typeof compose = (halves, client) => compose(halves.length ? [renderer, ...halves] : [], client)

const hint = (plugin: string) => {
  const pending = [...browserReports()].filter(([name, report]) =>
    (name === plugin || name.startsWith(plugin + "/")) && (report.state === "waiting" || report.state === "failed"))
  return pending.length ? JSON.stringify(pending) : null
}
const client = () => null
const Value = serviceTag<{ version: string }>("source.value")
afterEach(() => composeTo([], client))

test("a browser component reports its missing key while its parent keeps its faces", async () => {
  let reading: string | null = null
  const consumer = {
    default: definePlugin({ name: "reader", needs: [Slots], apply: Effect.gen(function*() {
      yield* (yield* Slots).register("bench.seat", () => "surviving parent")
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
  expect(browserReports().get("reader/detail")).toEqual({ state: "waiting", missing: ["source.value"] })
  expect(app.only("bench.seat")?.face()).toBe("surviving parent")
  await composeTo([consumer, source("first")], client)
  expect<string | null>(reading).toBe("first")
  expect(hint("reader")).toBeNull()
  await composeTo([consumer], client)
  expect(reading).toBeNull()
  expect(hint("reader")).toContain("source.value")
  expect(app.only("bench.seat")?.face()).toBe("surviving parent")
  await composeTo([consumer, source("second")], client)
  expect<string | null>(reading).toBe("second")
  await composeTo([], client)
  expect(hint("reader")).toBeNull()
})

test("failed browser activation stays visible after cleanup and clears on retry", async () => {
  let fail = true
  const half = { default: definePlugin({ name: "flaky", needs: [Slots], apply: Effect.gen(function*() {
    yield* (yield* Slots).register("bench.seat", () => "ready")
    if (fail) yield* Effect.die(new Error("reader failed"))
  }) }) }
  await composeTo([half], client)
  expect(hint("flaky")).toContain("reader failed")
  expect(app.only("bench.seat")).toBeNull()
  fail = false
  await composeTo([half], client)
  expect(hint("flaky")).toBeNull()
  expect(app.only("bench.seat")?.face()).toBe("ready")
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
        yield* (yield* Slots).register("bench.mark", { place: "cluster", body: () => "detail" })
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
  expect(app.hung("bench.mark").map((row) => row.plugin)).toEqual(["source"])
  expect<string | null>(reading).toBe("component")
  expect(hint("source")).toBeNull()
  await composeTo([reader, { default: provider.default }], client)
  expect(app.hung("bench.mark")).toEqual([])
  expect(reading).toBeNull()
  expect(hint("reader")).toContain("source.value")
})


test("a legacy contribution waits for the renderer and uses the same location failure ledger", async () => {
  const half = { default: definePlugin({ name: "legacy", needs: [Slots], apply: Effect.gen(function*() {
    yield* (yield* Slots).register("bench.seat", () => "ready", {
      activate: Effect.die(new Error("integration refused")),
    })
  }) }) }
  await compose([half], client)
  expect(hint("legacy")).toContain("ui-renderer.legacy-slots")
  await composeTo([half], client)
  expect(hint("legacy")).toContain("integration refused")
  expect(app.only("bench.seat")).toBeNull()
})
