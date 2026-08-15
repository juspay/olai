import { expect, test } from "bun:test"

import { nodesOf } from "./fixtures.testlib.ts"
import {
  ARCHIVE,
  fileKind,
  ID_SHAPE,
  INBOX,
  inboxIn,
  isMirror,
  MirrorNode,
  type Node,
  OUTLINE_EXT,
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

// What belongs to a served set is a statement about the FORMAT, not about
// whatever happened to read the directory: the same answer decides which files
// are outlines, which are the documents `doc` may point at, and which are
// neither. A file that is neither is not part of the set at all — so `null` is
// an answer, not a failure. The suffix is matched exactly as the format writes
// it, so a near miss is a miss.
test("a served file is an outline, a document, or none of the set's business", () => {
  expect(fileKind("plan.olai")).toBe("outline")
  expect(fileKind("sub/dir/plan.olai")).toBe("outline")
  expect(fileKind("notes/cabinets.md")).toBe("document")
  for (const path of ["README", "plan.json", "notes.md.txt", "olai", ".md.bak", "a.OLAI"]) {
    expect({ path, kind: fileKind(path) }).toEqual({ path, kind: null })
  }
})

// The cutover, in the format's own words. Outlines were `.jsonl` files until
// the rename, and what was ruled is that olai simply stops seeing them: no dual
// read, no migration on open, no warning — a `.jsonl` left in a served
// directory is an unclaimed file exactly the way `plan.json` above is, and a
// person renames their vault once by hand (docs/format.md carries the line).
// It is asserted rather than left to follow from the constant because the
// tempting kindness — "claim it too, just for a while" — is a one-word edit
// here, and this is where the argument against it is written down.
test("the extension olai used to have is not claimed, and nothing warns about it", () => {
  expect(fileKind("plan.jsonl")).toBeNull()
  expect(fileKind("sub/dir/plan.jsonl")).toBeNull()
  // Including the two conventional names: an old vault's archive is not an
  // archive to this format, it is a file olai walks past.
  expect(fileKind("Archive.jsonl")).toBeNull()
  expect(inboxIn(["Inbox.jsonl"])).toBeUndefined()
})

// The three rules a served directory is read by all come off ONE constant, so
// that moving it moves them together. Written as a derivation rather than as
// three literals for the reason node.ts gives: a retyped suffix left behind is
// not a type error, it is a file the walk stops claiming.
test("the archive, the inbox and the walk all wear the one suffix", () => {
  expect(ARCHIVE).toBe(`Archive${OUTLINE_EXT}`)
  expect(INBOX).toBe(`Inbox${OUTLINE_EXT}`)
  expect(fileKind(`anything${OUTLINE_EXT}`)).toBe("outline")
  expect(fileKind(ARCHIVE)).toBe("outline")
  expect(fileKind(INBOX)).toBe("outline")
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
