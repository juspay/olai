/**
 * WHAT TYPING AT A LEVEL WAKES — asked of `./level-owner.ts` itself, under the
 * browser condition, because "this memo did not re-run" is a claim a
 * server-resolved Solid cannot make (`justfile`'s `test` recipe says why).
 *
 * A keystroke at a level replaces the path (the step's text is a field of it).
 * What must NOT follow it: the standing check, which asks the root adapter's
 * `items()`; the crumbs, which a `<For>` keeps by identity; and the top level's
 * live rows, which the drawing is keyed on.
 */
import { expect, test } from "bun:test"
import { createRoot, createSignal, onCleanup } from "solid-js"
import { atOnce } from "@olai/web/client/settled.ts"
import type { PaletteAdapter } from "../index.ts"
import type { PaletteItem } from "./items.ts"
import { createLevelOwner, resetLevelMemory } from "./level-owner.ts"
import type { PaletteLevel } from "./levels.ts"

const NOTE: PaletteLevel = {
  kind: "value",
  options: [{ id: "plain", label: "Plain" }, { id: "loud", label: "Loud" }],
  submit: () => Promise.resolve({}),
}
const row = (id: string, level: PaletteLevel): PaletteItem => ({
  id, label: id, action: { kind: "level", level }, taking: atOnce, search: id,
})
const NESTED: PaletteLevel = { kind: "group", children: [row("note", NOTE)] }

const bench = () => {
  let asked = 0
  const adapter: PaletteAdapter = {
    items: () => {
      asked++
      return [row("root", NESTED)]
    },
  }
  const [adapters] = createSignal<ReadonlyArray<PaletteAdapter>>([adapter])
  const host = {
    adapters, touched: () => {}, leaveRoot: () => {}, relist: () => {}, hush: () => {},
    say: () => {}, refuse: () => {}, close: () => {}, focus: () => {},
  }
  return { host, asked: () => asked }
}

test("typing at a level asks the root adapter nothing, and keeps the crumbs and the top level", () => {
  resetLevelMemory()
  const { host, asked } = bench()
  createRoot((dispose) => {
    const owner = createLevelOwner(host)
    // Read what the drawing reads, so each is a live subscription.
    owner.crumbs(); owner.topLive(); owner.depth(); owner.busy(); owner.chosenId()
    owner.drill(row("root", NESTED), NESTED)
    owner.drill(row("note", NOTE), NOTE)
    expect(owner.depth()).toBe(2)
    const crumbs = owner.crumbs()
    const live = owner.topLive()
    const before = asked()

    for (const text of ["h", "he", "hel", "hello"]) owner.type(text)
    owner.crumbs(); owner.topLive(); owner.depth()

    expect(owner.top()?.step.text).toBe("hello")
    expect(asked()).toBe(before)
    expect(owner.crumbs()).toBe(crumbs)
    expect(owner.topLive()).toBe(live)
    dispose()
  })
})

test("a crumb is one object for as long as its level stands", () => {
  resetLevelMemory()
  const { host } = bench()
  createRoot((dispose) => {
    const owner = createLevelOwner(host)
    owner.drill(row("root", NESTED), NESTED)
    const first = owner.crumbs()[0]
    owner.drill(row("note", NOTE), NOTE)
    expect(owner.crumbs()).toHaveLength(2)
    expect(owner.crumbs()[0]).toBe(first)
    owner.pop(1, false)
    expect(owner.crumbs()).toHaveLength(1)
    expect(owner.crumbs()[0]).toBe(first)
    dispose()
  })
})

test("moving the option changes the chosen id and not the top level", () => {
  resetLevelMemory()
  const { host } = bench()
  createRoot((dispose) => {
    const owner = createLevelOwner(host)
    owner.drill(row("root", NESTED), NESTED)
    owner.drill(row("note", NOTE), NOTE)
    const live = owner.topLive()
    expect(owner.chosenId()).toBe("plain")
    owner.move(1)
    expect(owner.chosenId()).toBe("loud")
    expect(owner.topLive()).toBe(live)
    dispose()
  })
})

test("a level's own work ends when it is popped and when the drawing goes, and its signal aborts only on the pop", () => {
  resetLevelMemory()
  const { host } = bench()
  let cleaned = 0
  let signal: AbortSignal | undefined
  const counted: PaletteLevel = {
    kind: "group",
    children: (scope) => {
      signal = scope.signal
      onCleanup(() => { cleaned++ })
      return () => []
    },
  }
  createRoot((dispose) => {
    const owner = createLevelOwner(host)
    owner.drill(row("root", counted), counted)
    expect(cleaned).toBe(0)
    owner.pop(0, false)
    expect(cleaned).toBe(1)
    expect(signal?.aborted).toBe(true)

    owner.drill(row("root", counted), counted)
    // The drawing going disposes the rows' scope; the level itself (its
    // step, its signal) belongs to navigation's memory and outlives a redraw.
    dispose()
    expect(cleaned).toBe(2)
    expect(signal?.aborted).toBe(false)
  })
  resetLevelMemory()
  expect(signal?.aborted).toBe(true)
})
