/**
 * A chunk's arrival, and its five rules (`./arriving.ts`).
 *
 * They were spelled twice — once around the markdown pipeline's `import()` and
 * once around the `•••` menu's — before the second one made them one thing.
 * Each test below is one of the rules the two copies were both keeping by hand.
 *
 * No bundler is involved: `createArrival` takes the thunk, so a test hands it a
 * promise it controls and the `import()` stays in the callers, where the
 * bundler reads it.
 */

import { expect, test } from "bun:test"

import { createArrival } from "./arriving.ts"

/** A fetch a test finishes when it chooses, plus how many times it was
 *  started — the counter is the point of the second test. */
const heldFetch = <T>() => {
  let land: (value: T) => void = () => {}
  let fail: (cause: unknown) => void = () => {}
  let started = 0
  return {
    started: () => started,
    land: (value: T) => land(value),
    fail: (cause: unknown) => fail(cause),
    fetch: () => {
      started += 1
      return new Promise<T>((resolve, reject) => {
        land = resolve
        fail = reject
      })
    },
  }
}

/** `then` is a microtask, so a landed promise is visible on the next turn and
 *  not in the same one. */
const settled = (): Promise<void> => new Promise((resolve) => queueMicrotask(resolve))

test("asking is what fetches it, and nothing fetches it before that", async () => {
  const held = heldFetch<string>()
  const chunk = createArrival("the thing", held.fetch)
  expect(held.started()).toBe(0)

  expect(chunk.ready()).toBe(false)
  expect(held.started()).toBe(1)

  held.land("here")
  await settled()
  expect(chunk.ready()).toBe(true)
  expect(chunk.now()).toBe("here")
})

test("a second ask does not start a second fetch", async () => {
  // Every row of the outline reads the menu's answer; a fetch per reader would
  // be one request per row of the page.
  const held = heldFetch<string>()
  const chunk = createArrival("the thing", held.fetch)
  chunk.ready()
  chunk.ready()
  chunk.ready()
  expect(held.started()).toBe(1)

  held.land("here")
  await settled()
  chunk.ready()
  expect(held.started()).toBe(1)
})

test("a fetch that fails is a value, not a throw — and asking again is not a retry", async () => {
  const held = heldFetch<string>()
  const chunk = createArrival("the markdown renderer", held.fetch)
  chunk.ready()
  held.fail(new Error("offline"))
  await settled()

  expect(chunk.ready()).toBe(false)
  // The MESSAGE is what a surface puts on the page, so it is asserted whole:
  // what could not be loaded, and why.
  expect(chunk.failure()?.message).toBe("the markdown renderer could not be loaded: offline")
  expect(chunk.failure()?.cause).toEqual(new Error("offline"))
  expect(held.started()).toBe(1)
})

test("a value that is a FUNCTION is stored, not called", async () => {
  // The one footgun in this shape: Solid reads a bare `set(fn)` as an updater,
  // so a component — which is a function — would be invoked with the previous
  // state and whatever it returned would be stored in its place. Both ways in
  // are held: the fetch, and the install a unit test uses.
  const Component = (): string => "drawn"
  const held = heldFetch<typeof Component>()
  const fetched = createArrival("the menu", held.fetch)
  fetched.ready()
  held.land(Component)
  await settled()
  expect(fetched.now()).toBe(Component)

  const installed = createArrival("the menu", held.fetch)
  installed.install(Component)
  expect(installed.now()).toBe(Component)
})

test("using it before it arrives is a throw, because that is a bug in the caller", () => {
  // A silent `undefined` would be a page that merely looked blank; every
  // caller is inside something that just read `ready()`.
  const chunk = createArrival("the ••• menu", heldFetch<string>().fetch)
  expect(() => chunk.now()).toThrow("the ••• menu was used before it arrived")
})

/**
 * THE THIRD STATE, and the one this file did not hold when it was written.
 *
 * `ready()` answers two questions with one `false`: the chunk is coming, and
 * the chunk is never coming. Every surface that dresses itself as UNFINISHED
 * has to tell those apart, and a surface that read `!ready()` for it would go
 * on saying "loading" at a page nothing is ever going to change — which is
 * exactly what `markdown/title.ts` did for one commit of this branch: a title
 * with marks in it stayed blurred forever behind a renderer that had failed.
 */
test("waiting is here-not-yet, and a failure is not waiting", async () => {
  const held = heldFetch<string>()
  const chunk = createArrival("the markdown renderer", held.fetch)

  // Before anything has asked: nothing is here, and something is coming as
  // soon as somebody reads it.
  expect(chunk.waiting()).toBe(true)
  expect(chunk.ready()).toBe(false)

  held.land("here")
  await settled()
  expect(chunk.waiting()).toBe(false)
  expect(chunk.ready()).toBe(true)

  // ...and the other way out of waiting, which is the one that matters: not
  // here, not coming, and NOT to be drawn as though it were on its way.
  const lost = heldFetch<string>()
  const failed = createArrival("the markdown renderer", lost.fetch)
  expect(failed.waiting()).toBe(true)
  lost.fail(new Error("offline"))
  await settled()
  expect(failed.ready()).toBe(false)
  expect(failed.waiting()).toBe(false)
  expect(failed.failure()).toBeDefined()
})

test("reading `waiting` is an ask, exactly as reading `ready` is", async () => {
  // The two are one question asked two ways, so the fetch belongs to neither
  // of them alone: a surface that only ever asks whether it should draw itself
  // as unfinished still starts the thing it is waiting for.
  const held = heldFetch<string>()
  const chunk = createArrival("the thing", held.fetch)
  expect(held.started()).toBe(0)

  expect(chunk.waiting()).toBe(true)
  expect(held.started()).toBe(1)

  chunk.waiting()
  chunk.ready()
  expect(held.started()).toBe(1)
})
