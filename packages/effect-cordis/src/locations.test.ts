import { expect, test } from "bun:test"
import { Effect, Exit, Scope } from "effect"
import { location, locations } from "./locations.ts"
import { mountPlugin, openHost, provide } from "./host.ts"
import { definePlugin } from "./plugin.ts"
import { serviceTag } from "./service.ts"
import type { LocationOwner } from "./locations.ts"

const root = location<string>("root", "one")
const side = location<string>("layout.sidebar", "one")
const list = location<string>("sidebar.sections")
const run = <A>(scope: Scope.Scope, effect: Effect.Effect<A, never, Scope.Scope>) =>
  Effect.runPromise(Scope.provide(effect, scope))
const close = (scope: Scope.Closeable) => Effect.runPromise(Scope.close(scope, Exit.void))

test("only root is built in; consumers and nested declarations can precede providers", async () => {
  const slots = locations()
  const shell = Scope.makeUnsafe()
  const sidebar = Scope.makeUnsafe()
  const consumer = Scope.makeUnsafe()
  try {
    await run(consumer, slots.forOwner("clock").contribute(root, "clock"))
    await run(consumer, slots.forOwner("files").contribute(list, "files"))
    await run(sidebar, slots.forOwner("sidebar").declare(list, side.name))
    expect(slots.read(root)).toEqual([{ owner: "clock", value: "clock" }])
    expect(slots.read(list)).toEqual([])
    expect(slots.inspect()).toContainEqual({ name: list.name, owner: "files", state: "waiting", waitingFor: side.name })
    await run(shell, slots.forOwner("layout").declare(side, "root"))
    expect(slots.read(list)).toEqual([{ owner: "files", value: "files" }])
    await close(shell)
    expect(slots.read(list)).toEqual([])
    expect(slots.read(root)).toHaveLength(1)
    const replacement = Scope.makeUnsafe()
    try {
      await run(replacement, slots.forOwner("alternate-layout").declare(side, "root"))
      expect(slots.read(list)).toEqual([{ owner: "files", value: "files" }])
      await close(sidebar)
      expect(slots.read(list)).toEqual([])
    } finally {
      await close(replacement)
    }
  } finally {
    await close(consumer)
    await close(sidebar)
    await close(shell)
  }
  expect(slots.inspect()).toEqual([])
})

test("duplicate declarations and single occupants name both owners, including waiting occupants", async () => {
  const slots = locations()
  const scope = Scope.makeUnsafe()
  try {
    await run(scope, slots.forOwner("layout").declare(side, "root"))
    await expect(run(scope, slots.forOwner("other").declare(side, "root"))).rejects.toThrow('"other" and "layout"')
    await run(scope, slots.forOwner("sidebar").contribute(side, "first"))
    await expect(run(scope, slots.forOwner("other").contribute(side, "second"))).rejects.toThrow('"other" and "sidebar"')
    const waiting = location<string>("absent", "one")
    await run(scope, slots.forOwner("first").contribute(waiting, "first"))
    await expect(run(scope, slots.forOwner("second").contribute(waiting, "second"))).rejects.toThrow('"second" and "first"')
    expect(slots.read(side)).toEqual([{ owner: "sidebar", value: "first" }])
  } finally {
    await close(scope)
  }
})

test("late providers cannot change waiting consumers' contracts or close an ownership cycle", async () => {
  const slots = locations()
  const scope = Scope.makeUnsafe()
  try {
    await run(scope, slots.forOwner("files").contribute(list, "files"))
    await expect(run(scope, slots.forOwner("sidebar").declare(location(list.name, "one"), "root"))).rejects.toThrow('"sidebar" disagrees with "files"')
    await run(scope, slots.forOwner("sidebar").declare(list, side.name))
    await expect(run(scope, slots.forOwner("layout").declare(side, list.name))).rejects.toThrow("ownership cycle")
    expect(slots.read(list)).toEqual([])
    await run(scope, slots.forOwner("layout").declare(side, "root"))
    expect(slots.read(list)).toHaveLength(1)
    await expect(run(scope, slots.forOwner("bad").declare(root, "root"))).rejects.toThrow('cannot redeclare host location "root"')
  } finally {
    await close(scope)
  }
})

test("failed acquisition rolls back before a later provider arrives", async () => {
  let refuse = false
  const slots = locations({ changed: () => { if (refuse) throw new Error("refused frame") } })
  const scope = Scope.makeUnsafe()
  try {
    refuse = true
    await expect(run(scope, slots.forOwner("bad").declare(side, "root"))).rejects.toThrow("refused frame")
    await expect(run(scope, slots.forOwner("bad").contribute(side, "bad"))).rejects.toThrow("refused frame")
    refuse = false
    await run(scope, slots.forOwner("good").declare(side, "root"))
    await run(scope, slots.forOwner("good").contribute(side, "good"))
    expect(slots.read(side)).toEqual([{ owner: "good", value: "good" }])
  } finally {
    refuse = false
    await close(scope)
  }
})

test("list entries have independent scopes even when values and owners are identical", async () => {
  const slots = locations()
  const first = Scope.makeUnsafe()
  const second = Scope.makeUnsafe()
  try {
    await run(first, slots.forOwner("sidebar").declare(list, "root"))
    await run(first, slots.forOwner("files").contribute(list, "same"))
    await run(second, slots.forOwner("files").contribute(list, "same"))
    expect(slots.read(list)).toHaveLength(2)
    await close(second)
    expect(slots.read(list)).toHaveLength(1)
  } finally {
    await close(first)
    await close(second)
  }
})

test("shell replacement preserves an independent capability's activation and contribution identity", () =>
  Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const host = yield* openHost
    const slots = locations()
    const Slots = serviceTag<LocationOwner>("locations")
    yield* provide(host, Slots, (owner) => slots.forOwner(owner))
    let activations = 0
    const capability = yield* mountPlugin(host, definePlugin({
      name: "counter", needs: [Slots], apply: Effect.gen(function*() {
        activations++
        yield* (yield* Slots).contribute(list, "counter")
      }),
    }))
    const shell = (name: string) => definePlugin({
      name, needs: [Slots], apply: Effect.gen(function*() {
        yield* (yield* Slots).declare(list, "root")
      }),
    })
    expect(yield* capability.report).toEqual({ state: "running" })
    expect(slots.read(list)).toEqual([])
    const first = yield* mountPlugin(host, shell("first-shell"))
    const entry = slots.read(list)[0]
    yield* first.dispose
    expect(slots.read(list)).toEqual([])
    expect(yield* capability.report).toEqual({ state: "running" })
    const replacement = yield* mountPlugin(host, shell("alternate-shell"))
    expect(slots.read(list)[0]).toBe(entry)
    expect(activations).toBe(1)
    yield* replacement.dispose
    yield* capability.dispose
    expect(slots.inspect()).toEqual([])
  }))))

test("a failed plugin releases its declarations and contributions without disturbing a sibling", () =>
  Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const host = yield* openHost
    const slots = locations()
    const Slots = serviceTag<LocationOwner>("locations")
    yield* provide(host, Slots, (owner) => slots.forOwner(owner))
    yield* mountPlugin(host, definePlugin({ name: "kept", needs: [Slots], apply: Effect.gen(function*() {
      yield* (yield* Slots).contribute(root, "kept")
    }) }))
    const failed = yield* mountPlugin(host, definePlugin({ name: "failed", needs: [Slots], apply: Effect.gen(function*() {
      const own = yield* Slots
      yield* own.declare(list, "root")
      yield* own.contribute(list, "failed")
      yield* Effect.die(new Error("initialization refused"))
    }) }))
    expect(yield* failed.report).toEqual({ state: "failed", fault: "initialization refused" })
    expect(slots.read(root)).toEqual([{ owner: "kept", value: "kept" }])
    expect(slots.read(list)).toEqual([])
    expect(slots.inspect()).toEqual([{ name: "root", owner: "kept", state: "active" }])
  }))))
