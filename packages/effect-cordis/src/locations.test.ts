import { expect, test } from "bun:test"
import { Deferred, Effect, Exit, Scope } from "effect"
import { location, locations } from "./locations.ts"

const root = location<string>("root", "one")
const side = location<string>("layout.sidebar", "one")
const list = location<string>("sidebar.sections")
const run = <A>(scope: Scope.Scope, effect: Effect.Effect<A, never, Scope.Scope>) => Effect.runPromise(Scope.provide(effect, scope))
const close = (scope: Scope.Closeable) => Effect.runPromise(Scope.close(scope, Exit.void))
const scoped = (body: (scope: Scope.Closeable) => Promise<void>) => async () => {
  const scope = Scope.makeUnsafe()
  try { await body(scope) } finally { await close(scope) }
}

test("only an active owning entry makes descendants available; replacement reacquires integrations", scoped(async (scope) => {
  const slots = await run(scope, locations())
  const shell = Scope.makeUnsafe()
  let starts = 0
  let stops = 0
  let independent = 0
  await run(scope, Effect.acquireRelease(Effect.sync(() => { independent++ }), () => Effect.sync(() => { independent-- })))
  await run(scope, slots.forOwner("files").contribute(list, "files", {
    activate: Effect.acquireRelease(Effect.sync(() => { starts++ }), () => Effect.sync(() => { stops++ })),
  }))
  await run(scope, slots.forOwner("sidebar").contribute(side, "sidebar", { children: [list] }))
  await run(scope, slots.settled)
  expect(starts).toBe(0)
  expect(slots.read(list)).toEqual([])
  try {
    await run(shell, slots.forOwner("layout").contribute(root, "frame", { children: [side] }))
    await run(scope, slots.settled)
    expect(starts).toBe(1)
    expect(slots.read(list)).toEqual([{ owner: "files", value: "files" }])
    await close(shell)
    await run(scope, slots.settled)
    expect(stops).toBe(1)
    expect(independent).toBe(1)
    expect(slots.read(list)).toEqual([])
    expect(slots.read(side)).toEqual([])
    expect(slots.inspect().find((entry) => entry.owner === "files")?.state).toBe("waiting")
    await run(scope, slots.forOwner("replacement").contribute(root, "new frame", { children: [side] }))
    await run(scope, slots.settled)
    expect(starts).toBe(2)
    expect(independent).toBe(1)
  } finally { await close(shell) }
}))

test("removing an entry drains asynchronous descendant finalizers before its own resources", scoped(async (scope) => {
  const slots = await run(scope, locations())
  const shell = Scope.makeUnsafe()
  const began = await Effect.runPromise(Deferred.make<void>())
  const finish = await Effect.runPromise(Deferred.make<void>())
  const order: string[] = []
  await run(scope, slots.forOwner("files").contribute(list, "files", { activate: Effect.addFinalizer(() => Effect.gen(function*() {
    order.push("files closing")
    yield* Deferred.succeed(began, undefined)
    yield* Deferred.await(finish)
    order.push("files closed")
  })) }))
  await run(shell, slots.forOwner("shell").contribute(root, "shell", {
    children: [list], activate: Effect.addFinalizer(() => Effect.sync(() => { order.push("shell closed") })),
  }))
  await run(scope, slots.settled)
  const closing = close(shell)
  await Effect.runPromise(Deferred.await(began))
  expect(order).toEqual(["files closing"])
  await Effect.runPromise(Deferred.succeed(finish, undefined))
  await closing
  expect(order).toEqual(["files closing", "files closed", "shell closed"])
}))

test("failed integration initialization is reported without publishing children or affecting siblings", scoped(async (scope) => {
  const slots = await run(scope, locations())
  await run(scope, slots.forOwner("shell").contribute(root, "shell", { children: [list] }))
  await run(scope, slots.forOwner("kept").contribute(list, "kept"))
  await run(scope, slots.settled)
  const kept = slots.read(list)[0]
  let released = false
  await run(scope, slots.forOwner("bad").contribute(list, "bad", {
    children: [side], activate: Effect.gen(function*() {
      yield* Effect.addFinalizer(() => Effect.sync(() => { released = true }))
      yield* Effect.die(new Error("integration refused"))
    }),
  }))
  await run(scope, slots.settled)
  expect(released).toBe(true)
  expect(slots.read(list)).toEqual([kept!])
  expect(slots.read(list)[0]).toBe(kept)
  expect(slots.inspect()).toContainEqual({ name: list.name, owner: "bad", state: "failed", fault: "integration refused" })
  expect(slots.read(side)).toEqual([])
}))

test("duplicate declarations and single occupants name both owners even while waiting", scoped(async (scope) => {
  const slots = await run(scope, locations())
  await run(scope, slots.forOwner("sidebar").contribute(side, "sidebar", { children: [list] }))
  await expect(run(scope, slots.forOwner("other").contribute(side, "other"))).rejects.toThrow('"other" and "sidebar"')
  await expect(run(scope, slots.forOwner("other").contribute(root, "other", { children: [list] }))).rejects.toThrow('"other" and "sidebar"')
  // Failed reservation must not occupy root.
  await run(scope, slots.forOwner("shell").contribute(root, "shell", { children: [side] }))
  await run(scope, slots.settled)
  expect(slots.read(side)).toHaveLength(1)
}))

test("late owners cannot change cardinality or close cycles, and invalid acquisitions release reservations", scoped(async (scope) => {
  const slots = await run(scope, locations())
  await run(scope, slots.forOwner("files").contribute(list, "files"))
  await expect(run(scope, slots.forOwner("bad").contribute(root, "bad", { children: [side, location(list.name, "one")] }))).rejects.toThrow('"bad" disagrees with "files"')
  await run(scope, slots.forOwner("sidebar").contribute(side, "sidebar", { children: [list] }))
  await expect(run(scope, slots.forOwner("cycle").contribute(list, "cycle", { children: [side] }))).rejects.toThrow("ownership cycle")
  await expect(run(scope, slots.forOwner("bad-root").contribute(list, "bad", { children: [root] }))).rejects.toThrow("cannot redeclare")
  await run(scope, slots.forOwner("shell").contribute(root, "shell", { children: [side] }))
  await run(scope, slots.settled)
  expect(slots.read(list)).toHaveLength(1)
}))

test("identical list contributions have separate lifetimes and unrelated entries retain identity", scoped(async (scope) => {
  const slots = await run(scope, locations())
  const second = Scope.makeUnsafe()
  await run(scope, slots.forOwner("shell").contribute(root, "shell", { children: [list] }))
  await run(scope, slots.forOwner("files").contribute(list, "same"))
  await run(second, slots.forOwner("files").contribute(list, "same"))
  await run(scope, slots.settled)
  const first = slots.read(list)[0]
  expect(slots.read(list)).toHaveLength(2)
  await close(second)
  expect(slots.read(list)).toHaveLength(1)
  expect(slots.read(list)[0]).toBe(first)
}))

test("withdrawal cancels a hanging integration and releases acquired resources", scoped(async (scope) => {
  const slots = await run(scope, locations())
  const consumer = Scope.makeUnsafe()
  const began = await Effect.runPromise(Deferred.make<void>())
  let released = false
  await run(scope, slots.forOwner("shell").contribute(root, "shell", { children: [list] }))
  await run(consumer, slots.forOwner("hanging").contribute(list, "hanging", { activate: Effect.gen(function*() {
    yield* Effect.addFinalizer(() => Effect.sync(() => { released = true }))
    yield* Deferred.succeed(began, undefined)
    yield* Effect.never
  }) }))
  await Effect.runPromise(Deferred.await(began))
  expect(slots.read(list)).toEqual([])
  await close(consumer)
  expect(released).toBe(true)
  expect(slots.inspect().some((entry) => entry.owner === "hanging")).toBe(false)
}))

test("failed dependent cleanup cannot leave faces or child locations active", scoped(async (scope) => {
  const slots = await run(scope, locations())
  const shell = Scope.makeUnsafe()
  let closed = false
  await run(scope, slots.forOwner("bad-cleanup").contribute(list, "bad", {
    children: [side], activate: Effect.addFinalizer(() => Effect.die(new Error("cleanup refused"))),
  }))
  await run(scope, slots.forOwner("descendant").contribute(side, "descendant", {
    activate: Effect.addFinalizer(() => Effect.sync(() => { closed = true })),
  }))
  await run(shell, slots.forOwner("shell").contribute(root, "shell", { children: [list] }))
  await run(scope, slots.settled)
  await close(shell)
  await run(scope, slots.settled)
  expect(closed).toBe(true)
  expect(slots.read(list)).toEqual([])
  expect(slots.read(side)).toEqual([])
  expect(slots.inspect().find((entry) => entry.owner === "bad-cleanup")?.state).toBe("failed")
}))

test("key reservations include waiting entries and cannot shadow a native occupant", scoped(async (scope) => {
  const slots = await run(scope, locations())
  const held = Scope.makeUnsafe()
  await run(held, slots.forOwner("first").contribute(list, "one", { key: "shared" }))
  const duplicate = await run(scope, Effect.exit(slots.forOwner("second").contribute(list, "two", { key: "shared" })))
  expect(Exit.isFailure(duplicate)).toBe(true)
  expect(slots.inspect()).toHaveLength(1)
  await close(held)
  await run(scope, slots.forOwner("second").contribute(list, "two", { key: "shared" }))
  await run(scope, slots.forOwner("shell").contribute(root, "shell", { children: [list] }))
  await run(scope, slots.settled)
  expect(slots.read(list)).toEqual([{ owner: "second", value: "two", key: "shared" }])
}))

test("retry reacquires only failed integrations and preserves siblings and independent work", scoped(async (scope) => {
  const slots = await run(scope, locations())
  let fail = true
  let starts = 0
  let closed = 0
  await run(scope, slots.forOwner("shell").contribute(root, "shell", { children: [list] }))
  await run(scope, slots.forOwner("stable").contribute(list, "stable"))
  await run(scope, slots.forOwner("flaky").contribute(list, "recovered", {
    activate: Effect.gen(function*() {
      starts++
      yield* Effect.addFinalizer(() => Effect.sync(() => { closed++ }))
      if (fail) yield* Effect.die(new Error("try again"))
    }),
  }))
  await run(scope, slots.settled)
  const stable = slots.read(list)[0]
  expect(closed).toBe(1)
  expect(slots.inspect().find((entry) => entry.owner === "flaky")?.state).toBe("failed")
  fail = false
  await run(scope, slots.retry)
  expect(starts).toBe(2)
  expect(slots.read(list)[0]).toBe(stable)
  expect(slots.read(list).map((entry) => entry.value)).toEqual(["stable", "recovered"])
  await run(scope, slots.retry)
  expect(starts).toBe(2)
}))
