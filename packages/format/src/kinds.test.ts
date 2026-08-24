import { expect, test } from "bun:test"

import {
  bodyKind,
  DOCUMENT_EXT,
  FILE_KINDS,
  fileKind,
  type FileKind,
  isFetched,
  OUTLINE_EXT,
  UNKEPT_KINDS,
  SVG_EXT,
  textKind,
  unkept,
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
  expect(fileKind("data/sales.csv")).toBe("csv")
  expect(fileKind("reports/q3.pdf")).toBe("pdf")
  // EVERY spelling of a picture is the one kind, which is what a kind with more
  // than one suffix is FOR: what olai does with a `.png` and a `.webp` is the
  // same thing, so they are one row of the table and one glyph and one face.
  expect(fileKind("art/handle.png")).toBe("image")
  expect(fileKind("art/shot.jpeg")).toBe("image")
  expect(fileKind("art/diagram.svg")).toBe("image")
  // ...and the exact match is exact for the new kinds too: a camera's
  // `IMG_1234.JPG` is a file no kind claims, exactly as `a.OLAI` is. One rule
  // for the whole registry rather than a case-folded corner of it.
  for (
    const path of [
      "README",
      "plan.json",
      "notes.md.txt",
      "olai",
      ".md.bak",
      "a.OLAI",
      "IMG_1234.JPG",
      "sheet.CSV",
    ]
  ) {
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
  const exts = Object.values(FILE_KINDS).flatMap((claim) => claim.exts)
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
    // EVERY suffix of it, not just the first: a kind with more than one
    // spelling is a kind with more than one way to be missed.
    for (const ext of claim.exts) {
      expect({ kind, ext, claims: fileKind(`a/b/thing${ext}`) })
        .toEqual({ kind, ext, claims: kind })
    }
  }
})

// `bodyKind` is `fileKind` with the outlines taken out, and it has to stay
// exactly that: the codec decodes by it (a body is carried verbatim, everything
// else is parsed as records), and the client picks a page by it. Spelled as the
// ANSWERS rather than derived from the table beside it — a loop over `holds`
// would re-run the implementation and could only fail if somebody rewrote that
// one line into something else.
test("a bodied file is a claimed file that is not an outline, and nothing else", () => {
  expect(bodyKind("notes/cabinets.md")).toBe("document")
  expect(bodyKind("report.html")).toBe("hypertext")
  expect(bodyKind("data/sales.csv")).toBe("csv")
  expect(bodyKind("art/handle.png")).toBe("image")
  expect(bodyKind("reports/q3.pdf")).toBe("pdf")
  // An outline is claimed and is NOT a body: it decodes to records, and the
  // page that draws one is a tree rather than a rendering.
  expect(bodyKind("plan.olai")).toBeNull()
  expect(bodyKind("README")).toBeNull()
})

// The narrower question the body wire asks, and the reason it is not
// `bodyKind`: a picture and a `.pdf` have a page like any other bodied file and
// there is nothing in either this process may read as a string. Announcing one
// as a body somebody could ask for would promise a megabyte of binary decoded
// as UTF-8, which is neither the file nor an error.
test("a file whose body is TEXT is the bodied ones something here can read", () => {
  expect(textKind("notes/cabinets.md")).toBe("document")
  expect(textKind("report.html")).toBe("hypertext")
  expect(textKind("data/sales.csv")).toBe("csv")
  expect(textKind("art/handle.png")).toBeNull()
  expect(textKind("reports/q3.pdf")).toBeNull()
  expect(textKind("plan.olai")).toBeNull()
  expect(textKind("README")).toBeNull()
})

// WHICH FILES A BROWSER FETCHES ITSELF — the column the media route's allowlist
// is made of (`./documents.ts`'s `isAsset`). Spelled as the answers for the
// reason every other sweep here is: a loop over `fetched` would re-run the one
// line this pins.
//
// The `.csv` is the entry worth reading twice. It holds text and the set keeps
// none of it, exactly like a `.html` — and it is still `false`, because its
// page is handed the file's text on the wire, so serving the same bytes raw
// would be a second way to read a file that already has a page.
test("the files a browser fetches are the ones whose page points at them", () => {
  expect(isFetched("report.html")).toBe(true)
  expect(isFetched("art/handle.png")).toBe(true)
  expect(isFetched(`art/diagram${SVG_EXT}`)).toBe(true)
  expect(isFetched("reports/q3.pdf")).toBe(true)
  expect(isFetched("data/sales.csv")).toBe(false)
  expect(isFetched("notes/cabinets.md")).toBe(false)
  expect(isFetched("plan.olai")).toBe(false)
  expect(isFetched("README")).toBe(false)
})

// What one loaded directory COSTS to hold, file by file, spelled as the answers
// for the same reason `bodyKind`'s are: three layers that cannot see each other
// branch on this (the store's probe, which does not read what nothing will keep;
// the codec that decodes such a file from its name; the server that reads the
// body when a reader opens it), and a loop over `kept` would re-run the one line
// this is here to pin. The four kinds olai only SHOWS are the ones that are not
// kept, and they are the ones that can be megabytes.
test("the shown kinds are the ones the set holds the path of and not the content", () => {
  expect(unkept("report.html")).toBe(true)
  expect(unkept("data/sales.csv")).toBe(true)
  expect(unkept("art/handle.png")).toBe(true)
  expect(unkept("reports/q3.pdf")).toBe(true)
  expect(unkept("notes/cabinets.md")).toBe(false)
  expect(unkept("plan.olai")).toBe(false)
  // A file no kind claims is not in the set at all, so there is nothing the set
  // is declining to hold — and the server asks this of a KEY, which may be
  // anything a caller subscribed to.
  expect(unkept("README")).toBe(false)
})

// The two suffixes the ops layer mints paths with come off the table rather than
// being retyped beside it — the whole failure PR #177 was written against, in
// the one direction a type checker cannot see. Read as the STRINGS a refusal
// message and a minted path will carry, because that is what a caller sees.
test("the minting constants are the suffixes the walk claims", () => {
  expect(fileKind(`a${OUTLINE_EXT}`)).toBe("outline")
  expect(fileKind(`a${DOCUMENT_EXT}`)).toBe("document")
  // The third spelled constant is the one a SECOND rule has to name and not
  // one anything mints: markdown may point at a picture and deliberately not
  // at this one (`./documents.ts`'s `PICTURE_EXTENSIONS`).
  expect(fileKind(`a${SVG_EXT}`)).toBe("image")
})

// The arm of the sum that is a face and nothing else is built from THIS list
// (`./document.ts`'s `Shown`), so a kind that belongs in it and is missing from
// here is an arm that cannot hold a file the sidebar lists. Derived from
// `kept` over the bodied kinds, and asserted as the answer.
test("the shown kinds are the bodied ones the set keeps no content of", () => {
  expect([...UNKEPT_KINDS].sort()).toEqual(["csv", "hypertext", "image", "pdf"])
})
