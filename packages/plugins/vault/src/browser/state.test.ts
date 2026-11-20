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
  expect(theirs.useServed()()).toEqual([])
  expect(theirs.servedDirectory()).toBeUndefined()
  stop()
  expect(mine.useServed()()).toEqual([])
  expect(mine.servedDirectory()).toBeUndefined()
})

test("a replacement is not cleared by the activation it replaced", () => {
  const held = heldFiles()
  const first = held.holdServed(served("first.olai"))
  const second = held.holdServed(served("second.olai"))
  first()
  expect(held.useServed()()).toEqual(["second.olai"])
  second()
  expect(held.useServed()()).toEqual([])
})
