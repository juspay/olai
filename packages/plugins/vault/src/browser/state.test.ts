/**
 * A HOLDER PER CONSUMER — the one thing `heldFiles` may not trade away.
 *
 * It is a factory because five packages held `vault.files` with the same ten
 * lines and only differed in which activation held it. Sharing that ALGORITHM
 * is the point; sharing the STATE would put back precisely the fault this
 * phase removed — a module variable installed by one row and read by five —
 * so the rule is pinned here rather than argued in a header.
 */
import { expect, test } from "bun:test"

import { heldFiles, type Directory } from "./state.ts"

const served = (...paths: ReadonlyArray<string>): Directory =>
  ({ paths: () => paths, head: () => () => 1 }) as unknown as Directory

test("two callers get two holders, and one row's directory is not another's", () => {
  const mine = heldFiles()
  const theirs = heldFiles()
  const stop = mine.holdServed(served("garden.olai"))
  expect(mine.useServed()()).toEqual(["garden.olai"])
  expect(mine.servedDirectory()).toBeDefined()
  // The other consumer is holding nothing, whatever this one holds.
  expect(theirs.useServed()()).toEqual([])
  expect(theirs.servedDirectory()).toBeUndefined()
  // ...and the release is the holder's own: it takes back what it installed
  // and leaves the reading the empty answer every face already draws.
  stop()
  expect(mine.useServed()()).toEqual([])
  expect(mine.servedDirectory()).toBeUndefined()
})

test("a replacement is not cleared by the activation it replaced", () => {
  const held = heldFiles()
  const first = held.holdServed(served("first.olai"))
  const second = held.holdServed(served("second.olai"))
  // The first activation's finalizer runs last, which is the ordering the
  // identity check in `heldService` exists for.
  first()
  expect(held.useServed()()).toEqual(["second.olai"])
  second()
  expect(held.useServed()()).toEqual([])
})
