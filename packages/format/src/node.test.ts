const OUTLINE_EXT = mintExt(TEST_CLAIMS, "olai")!
import { TEST_CLAIMS } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { nodesOf } from "./fixtures.testlib.ts"
import { mintExt } from "./kinds.ts"
import {
  TRASH,
  TRASH_FILE,
  ID_SHAPE,
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

/** The records of a JSONL fixture, in file order. */
const parsed = (contents: string): ReadonlyArray<Node> =>
  nodesOf(contents).map((located) => located.node)

// There are exactly two record shapes, and which one a record is decides
// almost everything downstream — whether it needs a title, whether it can hold
// children, whether it counts toward a parent's status. One field answers it,
// and `isMirror` is the one place that question is asked.
test("a record is a mirror when, and only when, it names one", () => {
  expect(parsed(`{"id":"m","ord":"a","mirror":"x"}\n{"id":"x","ord":"b","title":"x"}`)
    .map(isMirror)).toEqual([true, false])
})

// The mirror struct is the mirror record spelled out, and it is shared: the
// parser admits exactly its keys and a writer serialises exactly its keys.
// Drift between the schema and the canonical mirror line is a silently widened
// format, so the two are compared against each other.
test("the mirror shape is exactly the keys of a canonical mirror line", () => {
  expect(parsed(`{"id":"m","parent":"p","ord":"a","mirror":"x"}`)
    .map((node) => new Set(Object.keys(node))))
    .toEqual([new Set(Object.keys(MirrorNode.fields))])
  // Spelled out once, so a field added to either struct has to be added here
  // deliberately rather than arriving unnoticed.
  expect(new Set(Object.keys(MirrorNode.fields)))
    .toEqual(new Set(["id", "parent", "ord", "mirror"]))
})

// Two structs, not one with an optional `mirror`: the illegal combinations are
// unrepresentable rather than scanned for. What the two share is placement, and
// nothing else — every descriptive field belongs to the regular arm alone.
test("the two shapes share placement and nothing else", () => {
  const mirror = new Set(Object.keys(MirrorNode.fields))
  const regular = new Set(Object.keys(RegularNode.fields))
  const shared = [...mirror].filter((field) => regular.has(field))
  expect(new Set(shared)).toEqual(new Set(["id", "parent", "ord"]))
  expect(regular.has("mirror")).toBe(false)
  expect(mirror.has("title")).toBe(false)
})

// The id alphabet is published because ids travel into URLs and wire keys, so
// the layers that mint or accept an id check against this very regex.
test("ID_SHAPE admits slugs and nothing else", () => {
  expect(ID_SHAPE.test("kitchen-2_a")).toBe(true)
  for (const bad of ["", "has space", "dot.ted", "sla/sh", "hash#", "uni¢ode"]) {
    expect(ID_SHAPE.test(bad)).toBe(false)
  }
})

// The two conventional names are DERIVED from the suffix rather than typed
// beside it, for the reason the registry gives: a retyped suffix left behind is
// not a type error, it is a file the walk stops claiming. `fileKind` needs no
// assertion here — it reads the same constant these two do.
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
  expect(TRASH_FILE(TEST_CLAIMS, "olai")).toBe("_olai/Trash.olai")
  expect(isTrashed(TEST_CLAIMS, TRASH_FILE(TEST_CLAIMS, "olai")!)).toBe(true)
  expect(isTrashed(TEST_CLAIMS, "Trash.olai")).toBe(false)
  expect(isTrashed(TEST_CLAIMS, "Archive.olai")).toBe(false)
})

// WHICH FILES OLAI NAMED FOR ITSELF, as one predicate — the question the
// sidebar asks of every path (`@olai/web`'s `Sidebar.tsx`: tree or vault
// group). It is the mint read backwards rather than a second spelling of
// `_olai/`, which is why it is here beside it.
test("a file olai named for itself is one under _olai/, exactly", () => {
  expect(inOlaiDir(mintedInto(PINS))).toBe(true)
  expect(inOlaiDir(mintedInto(INBOX))).toBe(true)
  expect(inOlaiDir(TRASH_FILE(TEST_CLAIMS, "olai")!)).toBe(true)
  expect(inOlaiDir("house.olai")).toBe(false)
  expect(inOlaiDir("notes/palette.md")).toBe(false)
  // The mint is at the ROOT, so a `_olai` a person made under a folder of
  // their own is their directory and not olai's — and a file merely NAMED
  // for it is a file.
  expect(inOlaiDir("notes/_olai/Pins.olai")).toBe(false)
  expect(inOlaiDir("_olai.olai")).toBe(false)
  expect(inOlaiDir("_olai")).toBe(false)
})

// Leftover per-directory Archive.olai: basename exactly, not trash, not an
// ordinary live outline. `archive.olai` is a different file.
test("a leftover Archive.olai is dormant by basename, and is not the trash", () => {
  expect(isLeftoverArchive("Archive.olai")).toBe(true)
  expect(isLeftoverArchive("notes/Archive.olai")).toBe(true)
  expect(isLeftoverArchive("garden/plot/Archive.olai")).toBe(true)
  expect(isLeftoverArchive("archive.olai")).toBe(false)
  expect(isLeftoverArchive("Archive.olai.bak")).toBe(false)
  expect(isLeftoverArchive("notes/archive.olai")).toBe(false)
  expect(isLeftoverArchive(TRASH_FILE(TEST_CLAIMS, "olai")!)).toBe(false)
  expect(isLeftoverArchive("house.olai")).toBe(false)
  expect(isTrashed(TEST_CLAIMS, "Archive.olai")).toBe(false)
})

// The two conventions are two files and never one, which is what a directory
// holding both has to be able to say.
test("the inbox and the shelf are different files", () => {
  const files = ["_olai/Inbox.olai", "_olai/Pins.olai"]
  expect(inboxIn(TEST_CLAIMS, files)).toBe("_olai/Inbox.olai")
  expect(pinsIn(TEST_CLAIMS, files)).toBe("_olai/Pins.olai")
})
