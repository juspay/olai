import { expect, test } from "bun:test"

import { nodesOf } from "./fixtures.testlib.ts"
import { OUTLINE_EXT } from "./kinds.ts"
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
  expect(TRASH).toBe(`Trash${OUTLINE_EXT}`)
  expect(INBOX).toBe(`Inbox${OUTLINE_EXT}`)
})

// The inbox is the other named file this format knows, and it is read by NAME,
// wherever it sits. Both faces resolve a capture
// through this — the web's `+` and an agent capturing by hand — so one
// spelling of the rule is what keeps them landing in the same file.
test("a directory's inbox is whichever outline is called that, wherever it sits", () => {
  expect(inboxIn(["house.org", "Inbox.org"])).toBe("Inbox.org")
  // A name a person typed, so the case they typed it in does not decide.
  expect(inboxIn(["house.org", "notes/inbox.org"])).toBe("notes/inbox.org")
  // A file merely ENDING in the name is a different file.
  expect(inboxIn(["not-an-Inbox.org"])).toBeUndefined()
  expect(inboxIn([])).toBeUndefined()
})

test("with two inboxes the shallower one wins, so the answer is stable", () => {
  // "First in path order" would let a file three directories down claim the
  // capture from the obvious one beside it.
  expect(inboxIn(["deep/down/Inbox.org", INBOX, "a/Inbox.org"])).toBe(INBOX)
  expect(inboxIn(["z/Inbox.org", "a/Inbox.org"])).toBe("a/Inbox.org")
})
// The shelf is the THIRD named file, and it is read by the same walk — which
// is the whole reason `outlineCalled` exists rather than a second filter
// beside the inbox's. A directory that keeps its pins under `notes/` gets the
// file it has, exactly as it does for a capture.
test("a directory's shelf is whichever outline is called that, wherever it sits", () => {
  expect(PINS).toBe(`Pins${OUTLINE_EXT}`)
  expect(pinsIn(["house.org", "Pins.org"])).toBe("Pins.org")
  expect(pinsIn(["house.org", "notes/pins.org"])).toBe("notes/pins.org")
  expect(pinsIn(["my-Pins.org"])).toBeUndefined()
  expect(pinsIn([])).toBeUndefined()
  // Shallowest first, then path order — the inbox's rule, because it is the
  // same walk.
  expect(pinsIn(["deep/down/Pins.org", PINS, "a/Pins.org"])).toBe(PINS)
  // TWO SPELLINGS OF ONE NAME at one depth is the tie the walk actually has to
  // break, and it breaks it on path order like any other pair: `P` sorts before
  // `p`. Pinned here because the walk is a running minimum rather than a sort
  // (`outlineCalled`), so "which of these two" is a comparison somebody could
  // get backwards without any list looking wrong.
  expect(pinsIn(["pins.org", "Pins.org"])).toBe("Pins.org")
  expect(pinsIn(["Pins.org", "pins.org"])).toBe("Pins.org")
  // …and it is a MINIMUM and not a first-match, so the order the caller hands
  // the files over in cannot change the answer. A map's keys and a set are
  // both legal here, which is what the two readers of a derivation pass.
  expect(pinsIn(new Set(["a/Pins.org", "Pins.org"]))).toBe("Pins.org")
  expect(pinsIn(new Map([["a/Pins.org", 1], ["Pins.org", 2]]).keys())).toBe("Pins.org")
})

// WHERE OLAI MINTS ONE is a different question from where it FINDS one, and
// only the first moved (human, 2026-08-19). A dot-directory would not do:
// `@olai/store`'s walk prunes those, so a shelf under one would never be read
// back.
test("olai mints its own files under _olai/, and finds them anywhere", () => {
  expect(OLAI_DIR).toBe("_olai")
  expect(mintedInto(PINS)).toBe("_olai/Pins.org")
  expect(OLAI_DIR.startsWith(".")).toBe(false)
  // The reading is untouched: a shelf already at the root, or under `notes/`,
  // or in the mint directory is the one that answers.
  expect(pinsIn(["_olai/Pins.org"])).toBe("_olai/Pins.org")
  expect(pinsIn([PINS, "_olai/Pins.org"])).toBe(PINS)
})

// The TRASH and the INBOX are both minted under `_olai/` now — the inbox's
// half REVERSES the 2026-08-19 ruling that kept it at the root (human,
// 2026-08-20). The NAME is untouched, which is the whole of what `inboxIn`
// reads: only the mint moved.
test("the trash and the inbox are minted under _olai/, under their own names", () => {
  expect(TRASH_FILE).toBe("_olai/Trash.org")
  expect(mintedInto(TRASH)).toBe(TRASH_FILE)
  expect(isTrashed(TRASH_FILE)).toBe(true)
  expect(isTrashed("Archive.org")).toBe(false)
  expect(isTrashed("notes/Archive.org")).toBe(false)
  expect(isTrashed("Trash.org")).toBe(false)
  expect(INBOX).toBe("Inbox.org")
  expect(mintedInto(INBOX)).toBe("_olai/Inbox.org")
  // And the READING is untouched by the move, exactly as the shelf's was: a
  // directory already keeping one at the root goes on capturing into it, and
  // a minted one is found by the same walk.
  expect(inboxIn(["_olai/Inbox.org"])).toBe("_olai/Inbox.org")
  expect(inboxIn([INBOX, "_olai/Inbox.org"])).toBe(INBOX)
})

// WHICH FILES OLAI NAMED FOR ITSELF, as one predicate — the question the
// sidebar asks of every path (`@olai/web`'s `Sidebar.tsx`: tree or vault
// group). It is the mint read backwards rather than a second spelling of
// `_olai/`, which is why it is here beside it.
test("a file olai named for itself is one under _olai/, exactly", () => {
  expect(inOlaiDir(mintedInto(PINS))).toBe(true)
  expect(inOlaiDir(mintedInto(INBOX))).toBe(true)
  expect(inOlaiDir(TRASH_FILE)).toBe(true)
  expect(inOlaiDir("house.org")).toBe(false)
  expect(inOlaiDir("notes/palette.md")).toBe(false)
  // The mint is at the ROOT, so a `_olai` a person made under a folder of
  // their own is their directory and not olai's — and a file merely NAMED
  // for it is a file.
  expect(inOlaiDir("notes/_olai/Pins.org")).toBe(false)
  expect(inOlaiDir("_olai.org")).toBe(false)
  expect(inOlaiDir("_olai")).toBe(false)
})

// Leftover per-directory Archive.org: basename exactly, not trash, not an
// ordinary live outline. `archive.org` is a different file.
test("a leftover Archive.org is dormant by basename, and is not the trash", () => {
  expect(isLeftoverArchive("Archive.org")).toBe(true)
  expect(isLeftoverArchive("notes/Archive.org")).toBe(true)
  expect(isLeftoverArchive("garden/plot/Archive.org")).toBe(true)
  expect(isLeftoverArchive("archive.org")).toBe(false)
  expect(isLeftoverArchive("Archive.org.bak")).toBe(false)
  expect(isLeftoverArchive("notes/archive.org")).toBe(false)
  expect(isLeftoverArchive(TRASH_FILE)).toBe(false)
  expect(isLeftoverArchive("house.org")).toBe(false)
  expect(isTrashed("Archive.org")).toBe(false)
})

// The two conventions are two files and never one, which is what a directory
// holding both has to be able to say.
test("the inbox and the shelf are different files", () => {
  const files = ["Inbox.org", "Pins.org"]
  expect(inboxIn(files)).toBe("Inbox.org")
  expect(pinsIn(files)).toBe("Pins.org")
})
