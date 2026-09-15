import { expect, test } from "bun:test"

import { printStored, readStored, storedCodec } from "./persist.ts"

const set = {
  tabs: [
    { id: "t1", href: "/Tasks.olai", title: "Tasks", key: "k1" },
    { id: "t2", href: "/d/2026-09-14", title: "Monday" },
  ],
  front: "t2",
}

test("a set round-trips", () => {
  expect(readStored(printStored(set))).toEqual(set)
  expect(storedCodec.parse(storedCodec.print(set))).toEqual(set)
})

test("no storage reads as no set", () => {
  expect(readStored(null)).toBeUndefined()
  expect(storedCodec.print(undefined)).toBeNull()
})

test("another version reads as no set", () => {
  expect(readStored(JSON.stringify({ v: 2, front: "t1", tabs: set.tabs }))).toBeUndefined()
  expect(readStored(JSON.stringify({ front: "t1", tabs: set.tabs }))).toBeUndefined()
})

test("garbage reads as no set", () => {
  for (const raw of ["{", "null", "42", "[]", '"tabs"', JSON.stringify({ v: 1, front: "t1", tabs: "no" })]) {
    expect(readStored(raw)).toBeUndefined()
  }
  expect(readStored(JSON.stringify({ v: 1, front: "t1", tabs: [{ id: 3 }, { href: "/x" }, null] }))).toBeUndefined()
})

test("a malformed tab is dropped and the rest kept, with a title falling back to the address", () => {
  const raw = JSON.stringify({ v: 1, front: "t2", tabs: [{ id: "t1", href: "no-slash" }, { id: "t2", href: "/x", title: 7 }] })
  expect(readStored(raw)).toEqual({ tabs: [{ id: "t2", href: "/x", title: "/x" }], front: "t2" })
})

test("a second tab with an id already seen is dropped", () => {
  const raw = JSON.stringify({ v: 1, front: "t1", tabs: [set.tabs[0], { ...set.tabs[1], id: "t1" }] })
  expect(readStored(raw)?.tabs).toEqual([set.tabs[0]!])
})

test("a front that names no tab falls to the first", () => {
  expect(readStored(JSON.stringify({ v: 1, front: "gone", tabs: set.tabs }))?.front).toBe("t1")
  expect(readStored(JSON.stringify({ v: 1, tabs: set.tabs }))?.front).toBe("t1")
})
