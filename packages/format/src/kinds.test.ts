import { expect, test } from "bun:test"

import {
  bodyKind,
  DOCUMENT_EXT,
  FILE_KINDS,
  fileKind,
  type FileKind,
  holdsText,
  OUTLINE_EXT,
} from "./kinds.ts"

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
  // The conventional name does not rescue it: an old vault's archive is not an
  // archive to this format. It is a file olai walks past.
  expect(fileKind("Archive.jsonl")).toBeNull()
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
// else is parsed as records), so a kind that answered to both would be a file
// parsed as an outline and carried as text at once.
test("a bodied file is a claimed file whose content is text, and nothing else", () => {
  for (const [kind, claim] of ENTRIES) {
    const body = bodyKind(`thing${claim.ext}`)
    expect({ kind, itself: body === kind, none: body === null }).toEqual({
      kind,
      itself: claim.holds === "text",
      none: claim.holds !== "text",
    })
    expect(holdsText(kind)).toBe(claim.holds === "text")
  }
  expect(bodyKind("README")).toBeNull()
})

// The two suffixes the ops layer mints paths with are the table's own, rather
// than a second spelling that could drift from what the walk claims — the whole
// failure PR #177 was written against, in the one direction a type checker
// cannot see.
test("the minting constants are the table's entries", () => {
  expect(OUTLINE_EXT).toBe(FILE_KINDS.outline.ext)
  expect(DOCUMENT_EXT).toBe(FILE_KINDS.document.ext)
})
