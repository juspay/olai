import { expect, test } from "bun:test"

import { printStored, readStored } from "./persist.ts"

const set = {
  tabs: [
    { id: "t1", href: "/Tasks.olai", title: "Tasks", key: "k1" },
    { id: "t2", href: "/d/2026-09-14", title: "Monday" },
  ],
  front: "t2",
}

/** The page the address bar holds when the set is read back. */
const here = { href: "/Monday.olai", title: "Monday" }
/** ...as the store hands it over: a whole tab, whose id must not replace the stored one's. */
const shown = { id: "t9", ...here }

test("a set round-trips, with the front tab kept as its id and key alone and shown at the address", () => {
  const printed = JSON.parse(printStored(set))
  expect(printed.tabs[1]).toEqual({ id: "t2" })
  expect(readStored(printStored(set), shown)).toEqual({ ...set, tabs: [set.tabs[0]!, { id: "t2", ...here }] })
  const keyed = { ...set, front: "t1" }
  expect(JSON.parse(printStored(keyed)).tabs[0]).toEqual({ id: "t1", key: "k1" })
})

test("a change to the front tab's address or name prints the same string", () => {
  const moved = { ...set, tabs: [set.tabs[0]!, { ...set.tabs[1]!, href: "/d/2026-09-14?q=milk", title: "Monday, filtered" }] }
  expect(printStored(moved)).toBe(printStored(set))
})

test("only the front record may be kept without an address", () => {
  const raw = JSON.stringify({ v: 1, front: "t2", tabs: [{ id: "t1" }, { id: "t2" }] })
  expect(readStored(raw, here)).toEqual({ tabs: [{ id: "t2", ...here }], front: "t2" })
})

test("no storage reads as no set", () => {
  expect(readStored(null, here)).toBeUndefined()
})

test("another version reads as no set", () => {
  expect(readStored(JSON.stringify({ v: 2, front: "t1", tabs: set.tabs }), here)).toBeUndefined()
  expect(readStored(JSON.stringify({ front: "t1", tabs: set.tabs }), here)).toBeUndefined()
})

test("garbage reads as no set", () => {
  for (const raw of ["{", "null", "42", "[]", '"tabs"', JSON.stringify({ v: 1, front: "t1", tabs: "no" })]) {
    expect(readStored(raw, here)).toBeUndefined()
  }
  expect(readStored(JSON.stringify({ v: 1, front: "t1", tabs: [{ id: 3 }, { href: "/x" }, null] }), here)).toBeUndefined()
})

test("a malformed tab is dropped and the rest kept, with a title falling back to the address", () => {
  const raw = JSON.stringify({ v: 1, front: "t3", tabs: [{ id: "t1", href: "no-slash" }, { id: "t2", href: "/x", title: 7 }, { id: "t3" }] })
  expect(readStored(raw, here)).toEqual({ tabs: [{ id: "t2", href: "/x", title: "/x" }, { id: "t3", ...here }], front: "t3" })
})

test("a second tab with an id already seen is dropped", () => {
  const raw = JSON.stringify({ v: 1, front: "t1", tabs: [set.tabs[0], { ...set.tabs[1], id: "t1" }] })
  expect(readStored(raw, here)?.tabs).toEqual([{ ...set.tabs[0]!, ...here }])
})

test("a front that names no tab falls to the first", () => {
  expect(readStored(JSON.stringify({ v: 1, front: "gone", tabs: set.tabs }), here)?.front).toBe("t1")
  expect(readStored(JSON.stringify({ v: 1, tabs: set.tabs }), here)?.front).toBe("t1")
})
