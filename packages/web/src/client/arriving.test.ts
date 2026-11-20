import { expect, test } from "bun:test"

import { createArrival } from "./arriving.ts"

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
  expect(chunk.failure()?.message).toBe("the markdown renderer could not be loaded: offline")
  expect(chunk.failure()?.cause).toEqual(new Error("offline"))
  expect(held.started()).toBe(1)
})

test("a value that is a FUNCTION is stored, not called", async () => {
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
  const chunk = createArrival("the ••• menu", heldFetch<string>().fetch)
  expect(() => chunk.now()).toThrow("the ••• menu was used before it arrived")
})

test("waiting is here-not-yet, and a failure is not waiting", async () => {
  const held = heldFetch<string>()
  const chunk = createArrival("the markdown renderer", held.fetch)

  expect(chunk.waiting()).toBe(true)
  expect(chunk.ready()).toBe(false)

  held.land("here")
  await settled()
  expect(chunk.waiting()).toBe(false)
  expect(chunk.ready()).toBe(true)

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
  const held = heldFetch<string>()
  const chunk = createArrival("the thing", held.fetch)
  expect(held.started()).toBe(0)

  expect(chunk.waiting()).toBe(true)
  expect(held.started()).toBe(1)

  chunk.waiting()
  chunk.ready()
  expect(held.started()).toBe(1)
})
