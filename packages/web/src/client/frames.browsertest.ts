/**
 * The frame count, over the REAL store — `./frames.ts`'s whole subject is what
 * Solid's `reconcile` does to one, so it cannot be asked under the server build
 * `bun test` resolves (where a memo never re-runs and would pass having run
 * none of the code it names). `./settled.browsertest.ts`'s header argues the
 * filename and the second `just test` command in full.
 *
 * THE FRAMES ARE WRITTEN THE WAY THE WIRE WRITES THEM — `writeWrappedValue`,
 * the one merge `@kolu/surface` performs, imported rather than imitated. A
 * hand-rolled `setStore(reconcile(...))` here would be this file agreeing with
 * itself about the very law it exists to pin.
 *
 * What it pins is three things:
 *
 *   - the LAW the counter keeps — a first frame is a value, a blank is not a
 *     frame, and every frame after that counts once;
 *   - the CLAIM `./frames.ts` makes about the framework: an array element is
 *     REPLACED rather than merged, so the array's own node is what says a frame
 *     landed and the elements never have to be walked. The day
 *     `@kolu/surface` lets a stream declare an array key
 *     (`docs/brainstorming/reactivity-after-the-flip.md` §3.5's 5.1) the third
 *     test here fails, which is the point of it;
 *   - the COST — that counting a frame no longer clones the page. The clone is
 *     counted rather than argued: `structuredClone` is swapped for a counting
 *     wrapper for the length of the test, which is exactly what
 *     `createUpdatedTracker` reaches for on every frame with a handler
 *     registered.
 */

import { expect, test } from "bun:test"
import { createRoot, createEffect } from "solid-js"
import { createStore } from "solid-js/store"
import { writeWrappedValue } from "@kolu/surface/solid"

import { createFrames } from "./frames.ts"

/** A page shaped like the reading the client actually subscribes to: an object
 *  spine over arrays of rows, each row with children of its own. */
const page = (title: string, second = "two") => ({
  shows: {
    kind: "outline" as const,
    file: "house.olai",
    rows: [
      { key: "a", node: { id: "a", title }, children: [{ key: "a/x", node: { id: "x", title: "x" }, children: [] }] },
      { key: "b", node: { id: "b", title: second }, children: [] },
    ],
  },
  names: [{ id: "a", title }],
})

/** A store written the way the wire writes one, plus the counter over it. */
const live = () =>
  createRoot((dispose) => {
    const [store, setStore] = createStore<{ v: unknown }>({ v: undefined })
    const frames = createFrames(() => store.v)
    // A subscriber, because a memo nobody reads is a memo Solid is free to
    // leave cold — and every reader of this count in the client is one.
    createEffect(() => frames())
    return {
      frames,
      write: (value: unknown) => writeWrappedValue(setStore, value),
      // What the framework does to every subscription the moment its input
      // moves, before the new question's first frame.
      blank: () => setStore("v", undefined),
      stop: dispose,
    }
  })

test("a first frame is a value, not a change", () => {
  const store = live()
  expect(store.frames()).toBe(0)
  store.write(page("one"))
  expect(store.frames()).toBe(0)
  store.stop()
})

test("every frame after the first counts once", () => {
  const store = live()
  store.write(page("one"))
  store.write(page("two"))
  expect(store.frames()).toBe(1)
  store.write(page("three"))
  expect(store.frames()).toBe(2)
  store.stop()
})

test("a change buried in an array element is a frame", () => {
  // THE CLAIM `./frames.ts` RESTS ON. `reconcile(next, { key: null })` replaces
  // every element rather than merging into it, so a title three levels down
  // inside `rows` reaches the counter through the ARRAY's own node — which is
  // why the walk stops at arrays and the page is not walked per frame. If
  // `@kolu/surface` ever declares an array key, this is the test that says so.
  const store = live()
  store.write(page("one"))
  store.write(page("one", "two changed"))
  expect(store.frames()).toBe(1)
  store.stop()
})

test("a blank re-arms the first-frame rule instead of counting", () => {
  // What the framework does to every subscription the moment its input moves:
  // `setStore("v", undefined)`, then the new question's first frame.
  const store = live()
  store.write(page("one"))
  store.write(page("two"))
  expect(store.frames()).toBe(1)
  store.blank()
  expect(store.frames()).toBe(1)
  store.write(page("elsewhere"))
  expect(store.frames()).toBe(1)
  store.write(page("elsewhere moved"))
  expect(store.frames()).toBe(2)
  store.stop()
})

test("an identical frame still counts — it is still a write", () => {
  // NOT the tracker's law, deliberately (`./frames.ts`'s header): an identical
  // reconnect snapshot replaces every array element, so every `<For>` by
  // reference in the client sees it. A counter downstream of the store says
  // what the store did.
  const store = live()
  store.write(page("one"))
  store.write(page("one"))
  expect(store.frames()).toBe(1)
  store.stop()
})

test("counting a frame does not clone the page", () => {
  // The tax itself, counted rather than argued — two `structuredClone`s of the
  // whole page per frame is what registering `Subscription.updated` costs, and
  // this counter is the reason none of them happen.
  const real = globalThis.structuredClone
  let clones = 0
  globalThis.structuredClone = ((value: unknown) => {
    clones += 1
    return real(value)
  }) as typeof structuredClone
  try {
    const store = live()
    store.write(page("one"))
    for (let n = 0; n < 20; n += 1) store.write(page(`title ${n}`))
    expect(store.frames()).toBe(20)
    store.stop()
  } finally {
    globalThis.structuredClone = real
  }
  expect(clones).toBe(0)
})
