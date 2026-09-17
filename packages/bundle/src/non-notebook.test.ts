/** Exercise the shipped fixture through the real row loader and host, with
 * an empty generic Surface root and no directory or presentation providers. */
import { selectFixtureRows } from "./fixture.testlib.ts"
import { expect, test } from "bun:test"
import { Effect } from "effect"
import { defineSurface } from "@kolu/surface/define"
import { implementRootedSurfaces } from "@kolu/surface/server"
import { Directory, Ops, Vault, openPlugins } from "@olai/plugin-api/services"
import { offered as door } from "./bundle.ts"
import { mountBundle, setRow } from "./bundle.ts"

const fixture = "test-counter"
test("a non-notebook capability runs headless through the ordinary host and returns fresh", () => Effect.runPromise(Effect.scoped(Effect.gen(function*() {
  const plugins = yield* openPlugins({ vars: {}, now: () => "2026-09-05T00:00:00Z" })
  yield* mountBundle(plugins.host, selectFixtureRows([fixture]), "test-minimal")
  expect(door(plugins.host, Vault)).toBeUndefined()
  expect(door(plugins.host, Directory)).toBeUndefined()
  expect(door(plugins.host, Ops)).toBeUndefined()
  expect(plugins.composed().map(row => row.name)).toEqual([fixture])
  const runtime = implementRootedSurfaces(defineSurface({}), {}, {})
  const genericTags = Object.keys(runtime.handlers)
  expect(genericTags.every(tag => tag.startsWith("surface/system/"))).toBe(true)
  const mount = () => {
    const row = plugins.composed()[0]!
    return runtime.mount(row.name, row.surface as never, row.deps as never)
  }
  let mounted = mount()
  yield* Effect.addFinalizer(() => Effect.promise(() => mounted.drop()))
  const call = (verb: string) => {
    const handler = runtime.handlers[`surface/${fixture}/counter/${verb}`]
    if (!handler) throw new Error(`Missing counter ${verb} handler`)
    return handler({}) as Effect.Effect<number>
  }
  expect(yield* call("read")).toBe(0)
  expect(yield* call("increment")).toBe(1)
  expect(yield* call("read")).toBe(1)
  yield* setRow(plugins.host, fixture, false)
  expect(plugins.composed()).toEqual([])
  yield* Effect.promise(() => mounted.drop())
  expect(Object.keys(runtime.handlers)).toEqual(genericTags)
  yield* setRow(plugins.host, fixture, true)
  mounted = mount()
  expect(yield* call("read")).toBe(0)
}))), { timeout: 15_000 })
// A BUDGET, and the same one `./published.equivalence.test.ts` gives its
// differential: this test MOUNTS A ROW through the real loader, so its first
// import pays a cold transpile of the plugin roster — 0.7s warm, and 21.8s on a
// CI fleet running six e2e shards beside it, which the 5s default is not a
// budget for (`test[2-of-2]` failed on exactly this, twice in one run: the
// shard and the whole-leaf node that re-runs it).
