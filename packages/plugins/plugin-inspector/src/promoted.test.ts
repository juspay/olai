import { expect, test } from "bun:test"
import { definePlugin, location, locations, mountPlugin, Offers, openApp } from "@olai/plugin-api"
import type { Locations } from "@olai/plugin-api/contracts"
import type { RendererSlots } from "olai-plugin-ui-renderer/contract"
import type { Section } from "olai-plugin-preferences/contract"
import { sections } from "olai-plugin-preferences/contract"
import { Effect, type Scope } from "effect"
import { heldHeadings } from "./promoted.ts"

const run = (body: Effect.Effect<void, never, Scope.Scope>) => Effect.runPromise(Effect.scoped(body))

const headings = { heading: (plugin: string) => ({ plugin, label: () => plugin }), body: () => () => null }

test("a heading is released when its plugin stops, and claimed again when it returns", () => run(Effect.gen(function*() {
  const app = yield* openApp()
  let store!: Locations
  yield* mountPlugin(app.host, definePlugin({
    name: "renderer", needs: [Offers], apply: Effect.gen(function*() { store = yield* locations() }),
  }))
  yield* store.forOwner("preferences").contribute(location("root", "one"), null, { children: [sections] })
  yield* store.settled
  const slots: RendererSlots = { ...store.forOwner("inspector"), read: store.read, inspect: store.inspect }
  const held = heldHeadings(slots, sections)
  const claimed = () => store.read(sections).map((one) => one.key).sort()

  yield* held.reconcile(["git", "mail"], headings)
  yield* store.settled
  expect(claimed()).toEqual(["git", "mail"])

  yield* held.reconcile(["git"], headings)
  yield* store.settled
  expect(claimed()).toEqual(["git"])

  yield* held.reconcile(["git", "mail"], headings)
  yield* store.settled
  expect(claimed()).toEqual(["git", "mail"])

  yield* held.reconcile(["git", "mail"], headings)
  yield* store.settled
  expect(claimed()).toEqual(["git", "mail"])

  expect(store.inspect().filter((one) => one.state !== "active").map((one) => one.name)).toEqual([])

  yield* held.close
  yield* store.settled
  expect(claimed()).toEqual([])
})))

test("the component's own finalizer closes what it still holds", () => run(Effect.gen(function*() {
  const app = yield* openApp()
  let store!: Locations
  yield* mountPlugin(app.host, definePlugin({
    name: "renderer", needs: [Offers], apply: Effect.gen(function*() { store = yield* locations() }),
  }))
  yield* store.forOwner("preferences").contribute(location("root", "one"), null, { children: [sections] })
  yield* store.settled
  const slots: RendererSlots = { ...store.forOwner("inspector"), read: store.read, inspect: store.inspect }
  yield* Effect.scoped(Effect.gen(function*() {
    const held = heldHeadings(slots, sections)
    yield* Effect.addFinalizer(() => held.close)
    yield* held.reconcile(["git"], headings)
    yield* store.settled
    expect(store.read(sections).map((one) => one.key)).toEqual(["git"])
  }))
  yield* store.settled
  expect(store.read(sections)).toEqual([])
  const again = heldHeadings(slots, sections)
  yield* again.reconcile(["git"], headings)
  yield* store.settled
  expect(store.read(sections).map((one) => one.key)).toEqual(["git"])
})))

test("a claim that fails takes only its own heading down", () => run(Effect.gen(function*() {
  const app = yield* openApp()
  let store!: Locations
  yield* mountPlugin(app.host, definePlugin({
    name: "renderer", needs: [Offers], apply: Effect.gen(function*() { store = yield* locations() }),
  }))
  yield* store.forOwner("preferences").contribute(location("root", "one"), null, { children: [sections] })
  yield* store.settled
  const slots: RendererSlots = { ...store.forOwner("inspector"), read: store.read, inspect: store.inspect }
  const held = heldHeadings(slots, sections)
  const mine = () => store.read(sections).filter((one) => one.owner === "inspector").map((one) => one.key).sort()

  yield* Effect.scoped(Effect.gen(function*() {
    yield* store.forOwner("rival").contribute(sections, {
      heading: { plugin: "mail", label: () => "Rival" }, order: 0, scope: "shared", body: () => null,
    }, { key: "mail" })
    yield* store.settled
    yield* held.reconcile(["git", "mail"], headings)
    yield* store.settled
    expect(mine()).toEqual(["git"])
    expect(store.read(sections).filter((one) => one.key === "mail").map((one) => one.owner)).toEqual(["rival"])
    yield* held.reconcile(["git", "mail"], headings)
    yield* store.settled
    expect(mine()).toEqual(["git"])
  }))

  yield* held.reconcile(["git", "mail"], headings)
  yield* store.settled
  expect(mine()).toEqual(["git", "mail"])
  expect(store.read(sections).filter((one) => one.key === "mail").map((one) => one.owner)).toEqual(["inspector"])
  expect(store.inspect().filter((one) => one.state !== "active").map((one) => one.name)).toEqual([])
})))
