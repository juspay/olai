import { expect, test } from "bun:test"
import { Effect } from "effect"
import { definePlugin, mountPlugin, Offers, openApp, serviceTag, Slots } from "./browser.ts"

const Reading = serviceTag<{ read: () => string }>("source.reading")
const run = (body: Effect.Effect<void, never, import("effect").Scope.Scope>) =>
  Effect.runPromise(Effect.scoped(body))

test("browser consumers wait, release faces before provider resources, and restart with fresh services", () => run(Effect.gen(function*() {
  const app = yield* openApp()
  const seen: string[] = []
  const consumer = yield* mountPlugin(app.host, definePlugin({
    name: "reader", needs: [Reading, Slots], apply: Effect.gen(function*() {
      const reading = yield* Reading
      seen.push(reading.read())
      yield* Effect.addFinalizer(() => Effect.sync(() => { seen.push(`release:${reading.read()}`) }))
      yield* (yield* Slots).register("app.viewer", () => reading.read())
    }),
  }))
  expect((yield* consumer.report).state).toBe("waiting")
  expect(app.only("app.viewer")).toBeNull()
  const provider = (version: string) => definePlugin({
    name: "source", needs: [Offers], apply: Effect.gen(function*() {
      let alive = true
      yield* Effect.addFinalizer(() => Effect.sync(() => {
        expect(app.only("app.viewer")).toBeNull()
        alive = false
        seen.push(`closed:${version}`)
      }))
      yield* (yield* Offers).own("reading", (consumer) => ({ read: () => {
        expect(alive).toBe(true)
        return `${version}:${consumer}`
      } }))
    }),
  })
  const first = yield* mountPlugin(app.host, provider("v1"))
  expect((yield* consumer.report).state).toBe("running")
  expect(app.only("app.viewer")?.face()).toBe("v1:reader")
  yield* first.dispose
  expect((yield* consumer.report).state).toBe("waiting")
  expect(seen).toEqual(["v1:reader", "release:v1:reader", "closed:v1"])
  const second = yield* mountPlugin(app.host, provider("v2"))
  expect(app.only("app.viewer")?.face()).toBe("v2:reader")
  yield* second.dispose
})))

for (const word of ["", "other.reading", "Reading", "../slots"]) {
  test(`browser offers refuse invalid local word ${JSON.stringify(word)}`, () => run(Effect.gen(function*() {
    const app = yield* openApp()
    const bad = yield* mountPlugin(app.host, definePlugin({
      name: "source", needs: [Offers], apply: Effect.gen(function*() {
        yield* (yield* Offers).own(word, () => ({}))
      }),
    }))
    expect((yield* bad.report).state).toBe("failed")
  })))
}

for (const duplicate of [false, true]) {
  test(`browser failed setup publishes no partial service (duplicate: ${duplicate})`, () => run(Effect.gen(function*() {
    const app = yield* openApp()
    let activations = 0
    const reader = yield* mountPlugin(app.host, definePlugin({
      name: "reader", needs: [Reading], apply: Effect.sync(() => { activations++ }),
    }))
    const bad = yield* mountPlugin(app.host, definePlugin({
      name: "source", needs: [Offers, Slots], apply: Effect.gen(function*() {
        const offers = yield* Offers
        yield* (yield* Slots).register("app.viewer", () => "partial")
        yield* offers.own("reading", () => ({ read: () => "partial" }))
        if (duplicate) yield* offers.own("reading", () => ({ read: () => "duplicate" }))
        else yield* Effect.die(new Error("setup failed"))
      }),
    }))
    expect((yield* bad.report).state).toBe("failed")
    expect((yield* reader.report).state).toBe("waiting")
    expect(activations).toBe(0)
    expect(app.only("app.viewer")).toBeNull()
    yield* bad.dispose
    yield* mountPlugin(app.host, definePlugin({
      name: "source", needs: [Offers], apply: Effect.gen(function*() {
        yield* (yield* Offers).own("reading", () => ({ read: () => "recovered" }))
      }),
    }))
    expect(activations).toBe(1)
  })))
}

test("a local word cannot shadow browser furniture or another namespace", () => run(Effect.gen(function*() {
  const app = yield* openApp()
  for (const name of ["one", "two"]) {
    const row = yield* mountPlugin(app.host, definePlugin({
      name, needs: [Offers, Slots], apply: Effect.gen(function*() {
        yield* (yield* Offers).own("slots", () => ({ owner: name }))
        yield* (yield* Slots).register("app.header", { place: "cluster", body: () => name })
      }),
    }))
    expect((yield* row.report).state).toBe("running")
  }
  expect(app.hung("app.header").length).toBe(2)
})))
