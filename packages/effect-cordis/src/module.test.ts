import { expect, test } from "bun:test"
import { Effect } from "effect"
import { closeHost, mountPlugin, offered, openHost, provide, rowReport, settled } from "./host.ts"
import { offer } from "./lifecycle.ts"
import { pluginModule } from "./module.ts"
import { definePlugin, type Plugin } from "./plugin.ts"
import { serviceTag } from "./service.ts"

const Settings = serviceTag<{ owner: string }>("module.settings")
const Ready = serviceTag<object>("module.ready")
const Missing = serviceTag<object>("module.missing")

test("module parts activate independently, preserve row authority and drain on removal", () => Effect.runPromise(Effect.scoped(Effect.gen(function*() {
  const host = yield* openHost
  const released: string[] = []
  let starts = 0
  yield* provide(host, Ready, (owner) => ({ owner }))
  const main = definePlugin({ name: "example", needs: [Settings], apply: Effect.gen(function*() {
    expect((yield* Settings).owner).toBe("example")
    starts++
    yield* Effect.addFinalizer(() => Effect.gen(function*() { yield* Effect.sleep("5 millis"); released.push("main") }))
  }) })
  const setup = definePlugin({ name: "ignored", needs: [Ready], apply: Effect.gen(function*() {
    const owner = (yield* Ready) as { owner: string }
    yield* offer(Settings, () => owner)
    yield* Effect.addFinalizer(() => Effect.gen(function*() { yield* Effect.sleep("5 millis"); released.push("setup") }))
  }) })
  const module = pluginModule({ default: main, components: { setup } }) as { default: Plugin }
  const mounted = yield* mountPlugin(host, module.default)
  yield* settled(host, ["example"])
  expect(starts).toBe(1)
  expect((yield* rowReport(host, ["example"])).get("example")).toEqual({ state: "running" })
  yield* mounted.dispose
  expect(released).toEqual(["main", "setup"])
  expect(offered(host, Settings)).toBeUndefined()
  yield* mountPlugin(host, module.default)
  yield* settled(host, ["example"])
  expect(starts).toBe(2)
  yield* closeHost(host)
  expect(released).toEqual(["main", "setup", "main", "setup"])
}))))

for (const fails of [false, true]) test(`module aggregates ${fails ? "failed" : "waiting"} child state`, () => Effect.runPromise(Effect.scoped(Effect.gen(function*() {
  const host = yield* openHost
  const module = pluginModule({ default: definePlugin({ name: "example", needs: [], apply: Effect.void }), components: {
    detail: fails ? definePlugin({ name: "ignored", needs: [], apply: Effect.die("child failed") })
      : definePlugin({ name: "ignored", needs: [Missing], apply: Effect.void }),
  } }) as { default: Plugin }
  yield* mountPlugin(host, module.default)
  yield* settled(host, ["example"])
  const report = (yield* rowReport(host, ["example"])).get("example")
  expect(report?.state).toBe(fails ? "failed" : "waiting")
  if (!fails) expect(report).toEqual({ state: "waiting", missing: ["module.missing"] })
  else expect(report).toMatchObject({ fault: "child failed" })
}))))

test("loader module disposal interrupts a loading child and joins its asynchronous cleanup", () => Effect.runPromise(Effect.scoped(Effect.gen(function*() {
  const { Deferred } = yield* Effect.promise(() => import("effect"))
  const { mkdtemp, writeFile, rm } = yield* Effect.promise(() => import("node:fs/promises"))
  const { tmpdir } = yield* Effect.promise(() => import("node:os"))
  const { pathToFileURL } = yield* Effect.promise(() => import("node:url"))
  const { mountRows, flipRow } = yield* Effect.promise(() => import("./loader.ts"))
  const root = yield* Effect.acquireRelease(Effect.promise(() => mkdtemp(`${tmpdir()}/module-lifetime-`)), path => Effect.promise(() => rm(path, { recursive: true, force: true })))
  yield* Effect.promise(() => writeFile(`${root}/plugins.yml`, "- id: example\n  name: example\n"))
  const host = yield* openHost
  const entered = yield* Deferred.make<void>()
  let released = false
  const module = {
    default: definePlugin({ name: "example", needs: [], apply: Effect.void }),
    components: { loading: definePlugin({ name: "ignored", needs: [], apply: Effect.gen(function*() {
      yield* Effect.addFinalizer(() => Effect.gen(function*() { yield* Effect.sleep("5 millis"); released = true }))
      yield* Deferred.succeed(entered, undefined)
      yield* Effect.never
    }) }) },
  }
  yield* mountRows(host, { baseUrl: pathToFileURL(`${root}/`).href, path: "plugins.yml", patches: [], resolve: async () => module })
  yield* Deferred.await(entered)
  expect((yield* rowReport(host, ["example"])).get("example")?.state).toBe("waiting")
  yield* flipRow(host, "example", true)
  expect(released).toBe(true)
  expect((yield* rowReport(host, ["example"])).get("example")?.state).toBe("off")
}))))
