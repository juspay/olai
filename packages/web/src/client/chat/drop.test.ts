/**
 * What a drag says about itself, without a browser.
 *
 * The property worth a test is the ASYMMETRY between the two moments: the
 * kinds are readable while the drag is in the air and the files are not, so a
 * panel that lit up on `files.length` would never light up at all.
 */

import { expect, test } from "bun:test"

import { carriesFiles, droppedFiles } from "./drop.ts"

const transfer = (files: ReadonlyArray<File>): DataTransfer =>
  ({ files, types: files.length > 0 ? ["Files"] : [] }) as unknown as DataTransfer

const file = (name: string) => new File([new Uint8Array([1, 2, 3])], name, { type: "image/png" })

test("a drag carrying files says so by KIND, which is all it will say in the air", () => {
  // What a real `dragover` looks like: the kinds are there, the files are not,
  // because the drag data store is in protected mode until the drop.
  expect(carriesFiles(["Files"])).toBe(true)
  expect(carriesFiles(["text/plain", "Files"])).toBe(true)
})

test("a drag carrying anything else is not this panel's to take", () => {
  // Left alone entirely: no lit panel and no preventDefault, so dropping a
  // selection into the composer still types it there.
  expect(carriesFiles(["text/plain", "text/uri-list"])).toBe(false)
  expect(carriesFiles([])).toBe(false)
})

test("a drop hands over its files in the order they were dropped", () => {
  const dropped = droppedFiles(transfer([file("one.png"), file("two.png"), file("three.png")]))
  expect(dropped.map((each) => each.name)).toEqual(["one.png", "two.png", "three.png"])
})

test("a drop with no transfer at all is no files, not a crash", () => {
  expect(droppedFiles(null)).toEqual([])
})
