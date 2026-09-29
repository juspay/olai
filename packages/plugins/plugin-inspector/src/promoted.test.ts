/**
 * ONE HEADING PER PLUGIN, RELEASED WHEN ITS PLUGIN STOPS — held against a REAL
 * location host, because that is the thing the component is wrong about when it
 * is wrong.
 *
 * ## What this is here to refuse
 *
 * A registration in `preferences.sections` is a claim on a key, and
 * `contribute` DIES when the key is already held. Two shapes that look right and
 * are not, both of which this file fails on:
 *
 *   - making the registration inside a forked fiber, whose release then lands on
 *     the COMPONENT's scope rather than on the plugin's departure (interrupting
 *     a fiber that has already completed does nothing);
 *   - claiming the same key again when a plugin is switched back on, because the
 *     first claim was never given back.
 *
 * Both leave the panel drawing the previous set and, in the second case, a
 * defect inside a fiber nobody awaits. So the claims are: the held set is the
 * set that was asked for, the second ask does not die, and the keys are all
 * given back.
 *
 * The host is `@olai/plugin-api`'s own (`openApp` + `effect-cordis`'s
 * `locations`), the seat is declared the way the preferences row declares it (a
 * child of its own entry), and `RendererSlots` is the shape the renderer hands
 * out — no DOM, because what is under test is the holding, not the drawing.
 */
import { expect, test } from "bun:test"
import { definePlugin, location, locations, mountPlugin, Offers, openApp } from "@olai/plugin-api"
import type { Locations } from "@olai/plugin-api/contracts"
import type { RendererSlots } from "olai-plugin-ui-renderer/contract"
import type { Section } from "olai-plugin-preferences/contract"
import { sections } from "olai-plugin-preferences/contract"
import { Effect, type Scope } from "effect"
import { heldHeadings } from "./promoted.ts"

const run = (body: Effect.Effect<void, never, Scope.Scope>) => Effect.runPromise(Effect.scoped(body))

/** The words and rows a heading is registered with. The label is a reader and
 *  the body draws nothing: neither is what this file is about. */
const headings = { heading: (plugin: string) => ({ plugin, label: () => plugin }), body: () => () => null }

test("a heading is released when its plugin stops, and claimed again when it returns", () => run(Effect.gen(function*() {
  const app = yield* openApp()
  let store!: Locations
  yield* mountPlugin(app.host, definePlugin({
    name: "renderer", needs: [Offers], apply: Effect.gen(function*() { store = yield* locations() }),
  }))
  // THE SEAT, declared the way the preferences row declares it: the seat this
  // host provides, taken by an entry of its own, with `preferences.sections` as
  // ITS child. A registration into a location nobody declared waits, and a
  // waiting registration would make every read below vacuously empty.
  yield* store.forOwner("preferences").contribute(location("root", "one"), null, { children: [sections] })
  yield* store.settled
  const slots: RendererSlots = { ...store.forOwner("inspector"), read: store.read, inspect: store.inspect }
  const held = heldHeadings(slots, sections)
  const claimed = () => store.read(sections).map((one) => one.key).sort()

  yield* held.reconcile(["git", "mail"], headings)
  yield* store.settled
  expect(claimed()).toEqual(["git", "mail"])

  // ONE STOPS: its heading is GONE, not merely hidden.
  yield* held.reconcile(["git"], headings)
  yield* store.settled
  expect(claimed()).toEqual(["git"])

  // ...AND COMES BACK: the key is free, so the second claim does not die. A
  // defect here would reject this promise rather than failing an expectation.
  yield* held.reconcile(["git", "mail"], headings)
  yield* store.settled
  expect(claimed()).toEqual(["git", "mail"])

  // A frame that changed nothing claims nothing.
  yield* held.reconcile(["git", "mail"], headings)
  yield* store.settled
  expect(claimed()).toEqual(["git", "mail"])

  // The integration is ACTIVE rather than waiting or failed — the state a
  // silently-refused claim would show up as.
  expect(store.inspect().filter((one) => one.state !== "active").map((one) => one.name)).toEqual([])

  // ...and the component closing gives every key back.
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
  // `Effect.scoped` closes this inner scope at the end of the block, which is
  // the shape the component's activation has: the finalizer runs, the heading
  // goes, and a later claim on the same key is free.
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

/**
 * A KEY SOMEBODY ELSE HOLDS IS ONE HEADING'S LOSS, not the frame's and not the
 * stream's.
 *
 * The failure this refuses is the shape that reads as correct: `held.set` before
 * the claim, so a claim that died leaves a scope holding nothing (never closed)
 * and an entry that stops the plugin from ever being retried; and the failure
 * caught outside the stream, so the stream ENDS — headings that stop appearing
 * and, worse, stop being withdrawn.
 *
 * The rival is another owner holding the same key, which is what a leaked
 * registration looks like from the outside.
 */
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
    // THE RIVAL, for as long as this scope runs: the `mail` key is taken.
    yield* store.forOwner("rival").contribute(sections, {
      heading: { plugin: "mail", label: () => "Rival" }, order: 0, scope: "shared", body: () => null,
    }, { key: "mail" })
    yield* store.settled
    // ONE FRAME, TWO HEADINGS, ONE OF THEM IMPOSSIBLE: `git` is claimed, `mail`
    // cannot be, and the frame itself does not fail.
    yield* held.reconcile(["git", "mail"], headings)
    yield* store.settled
    expect(mine()).toEqual(["git"])
    expect(store.read(sections).filter((one) => one.key === "mail").map((one) => one.owner)).toEqual(["rival"])
    // ...AND THE HEADING THAT FAILED IS NOT REMEMBERED AS HELD: a later frame
    // tries it again rather than skipping it for the rest of the component.
    yield* held.reconcile(["git", "mail"], headings)
    yield* store.settled
    expect(mine()).toEqual(["git"])
  }))

  // The rival is gone with its scope, so the SAME heading claims the key now.
  yield* held.reconcile(["git", "mail"], headings)
  yield* store.settled
  expect(mine()).toEqual(["git", "mail"])
  expect(store.read(sections).filter((one) => one.key === "mail").map((one) => one.owner)).toEqual(["inspector"])
  expect(store.inspect().filter((one) => one.state !== "active").map((one) => one.name)).toEqual([])
})))
