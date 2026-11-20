const OUTLINE_EXT = mintExt(TEST_CLAIMS, "outline-olai")!
import { TEST_CLAIMS } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { nodesOf } from "./fixtures.testlib.ts"
import { mintExt } from "./kinds.ts"
import {
  TRASH,
  TRASH_FILE,
  ID_SHAPE,
  MENTION_ALPHABET,
  INBOX,
  inboxIn,
  inOlaiDir,
  isLeftoverArchive,
  isTrashed,
  isMirror,
  mintedInto,
  MirrorNode,
  type Node,
  OLAI_DIR,
  PINS,
  pinsIn,
  RegularNode,
} from "./node.ts"

const parsed = (contents: string): ReadonlyArray<Node> =>
  nodesOf(contents).map((located) => located.node)

test("a record is a mirror when, and only when, it names one", () => {
  expect(parsed(`{"id":"m","ord":"a","mirror":"x"}\n{"id":"x","ord":"b","title":"x"}`)
    .map(isMirror)).toEqual([true, false])
})

test("the mirror shape is exactly the keys of a canonical mirror line", () => {
  expect(parsed(`{"id":"m","parent":"p","ord":"a","mirror":"x"}`)
    .map((node) => new Set(Object.keys(node))))
    .toEqual([new Set(Object.keys(MirrorNode.fields))])
  expect(new Set(Object.keys(MirrorNode.fields)))
    .toEqual(new Set(["id", "parent", "ord", "mirror"]))
})

test("the two shapes share placement and nothing else", () => {
  const mirror = new Set(Object.keys(MirrorNode.fields))
  const regular = new Set(Object.keys(RegularNode.fields))
  const shared = [...mirror].filter((field) => regular.has(field))
  expect(new Set(shared)).toEqual(new Set(["id", "parent", "ord"]))
  expect(regular.has("mirror")).toBe(false)
  expect(mirror.has("title")).toBe(false)
})

test("ID_SHAPE is the mention alphabet, and nothing else admits", () => {
  expect(MENTION_ALPHABET).toContain("A")
  for (const good of ["kitchen-2_a", "work/olai"]) {
    expect(ID_SHAPE.test(good)).toBe(true)
  }
  for (const bad of ["", "has space", "dot.ted", "hash#", "uni¢ode"]) {
    expect(ID_SHAPE.test(bad)).toBe(false)
  }
})

test("the trash and the inbox wear the one suffix", () => {
  expect(TRASH).toBe("Trash")
  expect(INBOX).toBe("Inbox")
})

test("conventions match a node file's stem only directly under _olai", () => {
  expect(inboxIn(TEST_CLAIMS, ["Inbox.olai", "notes/inbox.olai"])).toBeUndefined()
  expect(inboxIn(TEST_CLAIMS, ["_olai/inbox.olai"])).toBe("_olai/inbox.olai")
  expect(inboxIn(TEST_CLAIMS, ["_olai/not-an-Inbox.olai", "_olai/Inbox.md"])).toBeUndefined()
  expect(pinsIn(TEST_CLAIMS, ["_olai/Pins.olai"])).toBe("_olai/Pins.olai")
  expect(pinsIn(TEST_CLAIMS, ["Pins.olai", "notes/Pins.olai"])).toBeUndefined()
  expect(pinsIn(TEST_CLAIMS, [])).toBeUndefined()
})

test("ambiguous convention names never select an arbitrary file", () => {
  for (const files of [["_olai/Pins.olai", "_olai/pins.olai"], ["_olai/pins.olai", "_olai/Pins.olai"]]) {
    expect(pinsIn(TEST_CLAIMS, files)).toBeUndefined()
    expect(pinsIn(TEST_CLAIMS, new Set(files))).toBeUndefined()
  }
})

test("mints combine the convention stem with the configured format suffix", () => {
  expect(OLAI_DIR).toBe("_olai")
  expect(mintedInto(`${PINS}${OUTLINE_EXT}`)).toBe("_olai/Pins.olai")
  expect(mintedInto(`${INBOX}${OUTLINE_EXT}`)).toBe("_olai/Inbox.olai")
  expect(TRASH_FILE(TEST_CLAIMS, "outline-olai")).toBe("_olai/Trash.olai")
  expect(isTrashed(TEST_CLAIMS, TRASH_FILE(TEST_CLAIMS, "outline-olai")!)).toBe(true)
  expect(isTrashed(TEST_CLAIMS, "Trash.olai")).toBe(false)
  expect(isTrashed(TEST_CLAIMS, "Archive.olai")).toBe(false)
})

test("a file olai named for itself is one under _olai/, exactly", () => {
  expect(inOlaiDir(mintedInto(PINS))).toBe(true)
  expect(inOlaiDir(mintedInto(INBOX))).toBe(true)
  expect(inOlaiDir(TRASH_FILE(TEST_CLAIMS, "outline-olai")!)).toBe(true)
  expect(inOlaiDir("house.olai")).toBe(false)
  expect(inOlaiDir("notes/palette.md")).toBe(false)
  expect(inOlaiDir("notes/_olai/Pins.olai")).toBe(false)
  expect(inOlaiDir("_olai.olai")).toBe(false)
  expect(inOlaiDir("_olai")).toBe(false)
})

test("a leftover Archive.olai is dormant by basename, and is not the trash", () => {
  expect(isLeftoverArchive("Archive.olai")).toBe(true)
  expect(isLeftoverArchive("notes/Archive.olai")).toBe(true)
  expect(isLeftoverArchive("garden/plot/Archive.olai")).toBe(true)
  expect(isLeftoverArchive("archive.olai")).toBe(false)
  expect(isLeftoverArchive("Archive.olai.bak")).toBe(false)
  expect(isLeftoverArchive("notes/archive.olai")).toBe(false)
  expect(isLeftoverArchive(TRASH_FILE(TEST_CLAIMS, "outline-olai")!)).toBe(false)
  expect(isLeftoverArchive("house.olai")).toBe(false)
  expect(isTrashed(TEST_CLAIMS, "Archive.olai")).toBe(false)
})

test("the inbox and the shelf are different files", () => {
  const files = ["_olai/Inbox.olai", "_olai/Pins.olai"]
  expect(inboxIn(TEST_CLAIMS, files)).toBe("_olai/Inbox.olai")
  expect(pinsIn(TEST_CLAIMS, files)).toBe("_olai/Pins.olai")
})
