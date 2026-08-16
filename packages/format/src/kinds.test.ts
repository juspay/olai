import { expect, test } from "bun:test"

import {
  bodyKind,
  DOCUMENT_EXT,
  FILE_KINDS,
  fileKind,
  type FileKind,
  isKept,
  OUTLINE_EXT,
} from "./kinds.ts"
import { inboxIn } from "./node.ts"

/** The table as pairs, with the keys still narrowed to what they are — plain
 *  `Object.entries` widens them to `string`, which would turn every sweep below
 *  into an assertion about strings rather than about the kinds. */
const ENTRIES = Object.entries(FILE_KINDS) as ReadonlyArray<
  readonly [FileKind, (typeof FILE_KINDS)[FileKind]]
>

// What belongs to a served set is a statement about the FORMAT, not about
// whatever happened to read the directory: the same answer decides which files
// are outlines, which are the documents `doc` may point at, and which are
// neither. A file that is neither is not part of the set at all — so `null` is
// an answer, not a failure. The suffix is matched exactly as the registry
// writes it, so a near miss is a miss.
test("a served file is one of the registry's kinds, or none of the set's business", () => {
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
// It is asserted rather than left to follow from the table because the tempting
// kindness — "claim it too, just for a while" — is a one-line edit there, and
// this is where the argument against it is written down.
test("the extension olai used to have is not claimed, and nothing warns about it", () => {
  expect(fileKind("plan.jsonl")).toBeNull()
  // The conventional names do not rescue it, which is the assumption worth
  // pinning: an old vault's archive is not an archive to this format, and its
  // inbox is not an inbox. They are files olai walks past.
  expect(fileKind("Archive.jsonl")).toBeNull()
  expect(inboxIn(["Inbox.jsonl"])).toBeUndefined()
})

// THE PROPERTY THE TABLE RESTS ON, and the one thing about it a reader cannot
// see by looking: `fileKind` walks the entries in order and answers with the
// first suffix that matches, so two kinds whose extensions end alike would make
// the answer depend on where in the table somebody typed the new row. Nothing
// today does — but the whole point of the registry is that a fourth kind is one
// line, and a `.old.md` written in that line would silently take every `.md` in
// the directory (or be shadowed by them) with no other test in this repository
// going red.
test("no kind's suffix ends in another kind's, so the table's order decides nothing", () => {
  const exts = Object.values(FILE_KINDS).map((claim) => claim.ext)
  for (const one of exts) {
    for (const other of exts) {
      if (one === other) continue
      expect({ one, other, shadows: one.endsWith(other) }).toEqual({
        one,
        other,
        shadows: false,
      })
    }
  }
})

// Every registered kind is CLAIMED by the function that reads the table — the
// round trip, so an entry that is in the table and answered for by nothing is a
// failure here rather than a file the sidebar lists and no page can open.
test("every kind in the registry claims a file named for it", () => {
  for (const [kind, claim] of ENTRIES) {
    expect({ kind, claims: fileKind(`a/b/thing${claim.ext}`) }).toEqual({ kind, claims: kind })
  }
})

// `bodyKind` is `fileKind` with the outlines taken out, and it has to stay
// exactly that: the codec decodes by it (a body is carried verbatim, everything
// else is parsed as records), and the client picks a page by it. Spelled as the
// ANSWERS rather than derived from the table beside it — a loop over `holds`
// would re-run the implementation and could only fail if somebody rewrote that
// one line into something else.
test("a bodied file is a claimed file whose content is text, and nothing else", () => {
  expect(bodyKind("notes/cabinets.md")).toBe("document")
  expect(bodyKind("report.html")).toBe("hypertext")
  // An outline is claimed and is NOT a body: it decodes to records, and the
  // page that draws one is a tree rather than a rendering.
  expect(bodyKind("plan.olai")).toBeNull()
  expect(bodyKind("README")).toBeNull()
})

// What one loaded directory COSTS to hold, kind by kind, spelled as the answers
// for the same reason `bodyKind`'s are: three layers that cannot see each other
// branch on this (the store's probe, which does not read what nothing will keep;
// the codec that decodes such a file from its name; the server that reads the
// body when a reader opens it), and a loop over `kept` would re-run the one line
// this is here to pin. Hypertext is the one that is not kept, and it is the one
// that can be megabytes.
test("every kind's content is kept but hypertext's, which is read when it is wanted", () => {
  expect(isKept("outline")).toBe(true)
  expect(isKept("document")).toBe(true)
  expect(isKept("hypertext")).toBe(false)
})

// The two suffixes the ops layer mints paths with come off the table rather than
// being retyped beside it — the whole failure PR #177 was written against, in
// the one direction a type checker cannot see. Read as the STRINGS a refusal
// message and a minted path will carry, because that is what a caller sees.
test("the minting constants are the suffixes the walk claims", () => {
  expect(fileKind(`a${OUTLINE_EXT}`)).toBe("outline")
  expect(fileKind(`a${DOCUMENT_EXT}`)).toBe("document")
})
