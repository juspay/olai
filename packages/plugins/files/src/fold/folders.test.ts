/**
 * The sidebar's half of the same memory — the same three questions as
 * ./memory.test.ts, over the set that is INVERTED because folders start shut.
 */

import { expect, test } from "bun:test"

import { parseFolders, printFolders, prunedFolders } from "./folders.ts"

test("what is stored is the folders left OPEN", () => {
  expect(printFolders(new Set(["notes", "Daily"]))).toBe(`["Daily","notes"]`)
  expect(parseFolders(`["Daily","notes"]`)).toEqual(new Set(["Daily", "notes"]))
})

test("nothing open is a key removed, not an empty list", () => {
  expect(printFolders(new Set())).toBeNull()
})

test("a value this app did not write is nothing", () => {
  expect(parseFolders(null).size).toBe(0)
  expect(parseFolders("hello").size).toBe(0)
  expect(parseFolders(`{"notes":true}`).size).toBe(0)
  expect(parseFolders(`["notes",7]`)).toEqual(new Set(["notes"]))
})

test("a folder that is not in the directory any more is dropped", () => {
  expect(prunedFolders(new Set(["notes", "gone"]), new Set(["notes", "Daily"])))
    .toEqual(new Set(["notes"]))
})

test("a directory that has not loaded prunes nothing", () => {
  // Same rule as the outline's folds: an empty answer is "this browser does
  // not know yet", which is not evidence that a folder is gone.
  expect(prunedFolders(new Set(["notes"]), new Set())).toEqual(new Set(["notes"]))
})
