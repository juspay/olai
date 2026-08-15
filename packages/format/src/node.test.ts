import { expect, test } from "bun:test"

import { nodesOf } from "./fixtures.testlib.ts"
import { OUTLINE_EXT } from "./kinds.ts"
import {
  ARCHIVE,
  ID_SHAPE,
  INBOX,
  inboxIn,
  isMirror,
  MirrorNode,
  type Node,
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

// The old extension does not rescue the two conventional names either, which is
// the assumption worth pinning here: an old vault's inbox is not an inbox. What
// `fileKind` itself claims and stopped claiming is ./kinds.test.ts'.
test("a `.jsonl` inbox is not this format's inbox", () => {
  expect(inboxIn(["Inbox.jsonl"])).toBeUndefined()
})

// The two conventional names are DERIVED from the suffix rather than typed
// beside it, for the reason the registry gives: a retyped suffix left behind is
// not a type error, it is a file the walk stops claiming. `fileKind` needs no
// assertion here — it reads the same constant these two do.
test("the archive and the inbox wear the one suffix", () => {
  expect(ARCHIVE).toBe(`Archive${OUTLINE_EXT}`)
  expect(INBOX).toBe(`Inbox${OUTLINE_EXT}`)
})

// The inbox is the other named file this format knows, and it is read the same
// way the archive is: by NAME, wherever it sits. Both faces resolve a capture
// through this — the web's `+` and an agent capturing by hand — so one
// spelling of the rule is what keeps them landing in the same file.
test("a directory's inbox is whichever outline is called that, wherever it sits", () => {
  expect(inboxIn(["house.olai", "Inbox.olai"])).toBe("Inbox.olai")
  // A name a person typed, so the case they typed it in does not decide.
  expect(inboxIn(["house.olai", "notes/inbox.olai"])).toBe("notes/inbox.olai")
  // A file merely ENDING in the name is a different file.
  expect(inboxIn(["not-an-Inbox.olai"])).toBeUndefined()
  expect(inboxIn([])).toBeUndefined()
})

test("with two inboxes the shallower one wins, so the answer is stable", () => {
  // "First in path order" would let a file three directories down claim the
  // capture from the obvious one beside it.
  expect(inboxIn(["deep/down/Inbox.olai", INBOX, "a/Inbox.olai"])).toBe(INBOX)
  expect(inboxIn(["z/Inbox.olai", "a/Inbox.olai"])).toBe("a/Inbox.olai")
})
