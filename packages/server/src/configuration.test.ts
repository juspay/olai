/** The root's publication worker, over real loader rows and scoped service offers. */
import { expect, test } from "bun:test"
import { Effect, Deferred, Exit, Fiber, Scope, SubscriptionRef } from "effect"
import { mountBundle, patchBundleRow, provide } from "@olai/bundle/bundle"
import { ConfigurationSource, Ops as WriteDoor, openPlugins } from "@olai/plugin-api/services"
import type { Configuration } from "@olai/plugin-api/configuration"
import { followConfiguration } from "./configuration.ts"
import { SERVER_LAYERS } from "./serve.testlib.ts"

const publication = (revision = 1, sequence = 1): Configuration => ({
  revision, file: "_olai/Settings.olai", rows: new Map([["test-counter", {
    on: true, config: { sequence }, values: [], node: { id: "counter-policy", file: "_olai/Settings.olai" },
  }]]),
})
const until = (ready: () => boolean) => Effect.promise(async () => {
  const deadline = Date.now() + 3000
  while (!ready()) {
    if (Date.now() > deadline) throw new Error("configuration worker did not settle")
    await Bun.sleep(1)
  }
})
const bench = (use: (at: {
  plugins: Effect.Success<ReturnType<typeof openPlugins>>,
  policy: Effect.Success<ReturnType<typeof followConfiguration>>,
  publish: (value: Configuration) => Effect.Effect<void>,
  withdraw: Effect.Effect<void>,
  source: ConfigurationSource,
}) => Effect.Effect<void, unknown, Scope.Scope>) => Effect.gen(function*() {
  const plugins = yield* openPlugins({ vars: {}, now: () => new Date().toISOString() })
  yield* mountBundle(plugins.host, [], "test-minimal")
  let current = publication()
  const readings = yield* SubscriptionRef.make(current)
  const source: ConfigurationSource = { current: () => current, changes: SubscriptionRef.changes(readings) }
  const owner = yield* Scope.make()
  yield* Effect.addFinalizer(() => Scope.close(owner, Exit.void))
  yield* provide(plugins.host, ConfigurationSource, () => source).pipe(Scope.provide(owner))
  const policy = yield* followConfiguration(plugins.host, () => {}, () => [], () => {}, "test-minimal")
  yield* Effect.addFinalizer(() => policy.close)
  yield* policy.ready
  yield* use({ plugins, policy, source, withdraw: Scope.close(owner, Exit.void),
    publish: value => Effect.andThen(Effect.sync(() => { current = value }), SubscriptionRef.set(readings, value)),
  })
}).pipe(Effect.scoped, Effect.provide(SERVER_LAYERS), Effect.runPromise)

test("non-live configuration replaces the row's activation; identical policy does not", () => bench(({ plugins, policy, publish }) => Effect.gen(function*() {
  const active = () => plugins.composed().find(row => row.name === "test-counter")
  const first = active()
  expect(first).toBeDefined()
  yield* publish(publication(2, 2))
  yield* until(() => policy.current()?.revision === 2 && active() !== first)
  const second = active()
  expect(second).toBeDefined()
  yield* publish(publication(3, 2))
  yield* until(() => policy.current()?.revision === 3)
  expect(active()).toBe(second)
  yield* patchBundleRow(plugins.host, "test-counter", { config: { sequence: 3 } })
  expect(active()).not.toBe(second)
  expect(yield* patchBundleRow(plugins.host, "not-a-row", { disabled: true })).toBe(false)
})))

test("withdrawal clears the reading but preserves applied options and permits a session switch", () => bench(({ plugins, policy, withdraw }) => Effect.gen(function*() {
  const first = plugins.composed().find(row => row.name === "test-counter")
  yield* withdraw
  yield* until(() => policy.current() === undefined)
  expect(plugins.composed().find(row => row.name === "test-counter")).toBe(first)
  let pressed = false
  expect(yield* policy.set("test-counter", false, () => Effect.sync(() => { pressed = true; return true }))).toBe(true)
  expect(pressed).toBe(true)
})))

test("a durable switch refuses a missing write door and a broken file", () => bench(({ policy, publish }) => Effect.gen(function*() {
  const missing = yield* Effect.flip(policy.set("test-counter", false, () => Effect.succeed(false)))
  expect(missing.message).toBe("The directory's write door is unavailable.")
  yield* publish({ ...publication(2), broken: "torn" })
  yield* until(() => policy.current()?.revision === 2)
  const broken = yield* Effect.flip(policy.set("test-counter", false, () => Effect.succeed(false)))
  expect(broken.message).toBe("Repair _olai/Settings.olai before changing which tools run.")
})))

test("reader withdrawal during an accepted write refuses settlement without undoing the write", () => bench(({ plugins, policy, withdraw }) => Effect.gen(function*() {
  const entered = yield* Deferred.make<void>()
  const finish = yield* Deferred.make<void>()
  let written = false
  yield* provide(plugins.host, WriteDoor, () => ({ gate: { run: () => Effect.gen(function*() {
    yield* Deferred.succeed(entered, undefined)
    yield* Deferred.await(finish)
    written = true
    return { rev: 2 }
  }) } } as unknown as WriteDoor))
  const press = yield* Effect.forkChild(Effect.flip(policy.set("test-counter", false, () => Effect.succeed(false))))
  yield* Deferred.await(entered)
  yield* withdraw
  yield* Deferred.succeed(finish, undefined)
  const failure = yield* Fiber.join(press)
  expect(written).toBe(true)
  expect(failure.message).toBe("The configuration reader withdrew before the change settled. The file retains the write.")
})))
