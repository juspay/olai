import { noClaimFor, unclaimedFileMessage } from "./kinds.ts"
import { TEST_CLAIMS } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { bodyKind, fileKind, isFetched, textKind, unkept, mintExt } from "./kinds.ts"
import { inboxIn } from "./node.ts"
const ENTRIES = [...TEST_CLAIMS.byKind.entries()]
const OUTLINE_EXT = mintExt(TEST_CLAIMS, "outline-olai")!
const DOCUMENT_EXT = mintExt(TEST_CLAIMS, "markdown")!
const SVG_EXT = TEST_CLAIMS.byKind.get("image")!.inert![0]!

test("a served file is one of the registry's kinds, or none of the set's business", () => {
  expect(fileKind(TEST_CLAIMS, "plan.olai")).toBe("outline-olai")
  expect(fileKind(TEST_CLAIMS, "sub/dir/plan.olai")).toBe("outline-olai")
  expect(fileKind(TEST_CLAIMS, "notes/cabinets.md")).toBe("markdown")
  expect(fileKind(TEST_CLAIMS, "data/sales.csv")).toBe("csv")
  expect(fileKind(TEST_CLAIMS, "reports/q3.pdf")).toBe("pdf")
  expect(fileKind(TEST_CLAIMS, "art/handle.png")).toBe("image")
  expect(fileKind(TEST_CLAIMS, "art/shot.jpeg")).toBe("image")
  expect(fileKind(TEST_CLAIMS, "art/diagram.svg")).toBe("image")
  for (
    const path of [
      "README",
      "plan.json",
      "notes.md.txt",
      "outline-olai",
      ".md.bak",
      "a.OLAI",
      "IMG_1234.JPG",
      "sheet.CSV",
    ]
  ) {
    expect({ path, kind: fileKind(TEST_CLAIMS, path) }).toEqual({ path, kind: null })
  }
})

test("the extension olai used to have is not claimed, and nothing warns about it", () => {
  expect(fileKind(TEST_CLAIMS, "plan.jsonl")).toBeNull()
  expect(fileKind(TEST_CLAIMS, "Archive.jsonl")).toBeNull()
  expect(inboxIn(TEST_CLAIMS, ["Inbox.jsonl"])).toBeUndefined()
})

test("no kind's suffix ends in another kind's, so the table's order decides nothing", () => {
  const exts = [...TEST_CLAIMS.byKind.values()].flatMap((claim) => claim.exts)
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

test("every kind in the registry claims a file named for it", () => {
  for (const [kind, claim] of ENTRIES) {
    for (const ext of claim.exts) {
      const path = `${claim.under ?? ""}a/b/thing${ext}`
      expect({ kind, ext, claims: fileKind(TEST_CLAIMS, path) })
        .toEqual({ kind, ext, claims: kind })
    }
  }
})

test("a scoped claim reaches inside its folder and nowhere else", () => {
  for (const [kind, claim] of ENTRIES) {
    if (claim.under === undefined) continue
    for (const ext of claim.exts) {
      expect({ kind, ext, inside: fileKind(TEST_CLAIMS, `${claim.under}one/half${ext}`) })
        .toEqual({ kind, ext, inside: kind })
      expect({ kind, ext, outside: fileKind(TEST_CLAIMS, `src/index${ext}`) })
        .toEqual({ kind, ext, outside: null })
      expect({ kind, ext, nested: fileKind(TEST_CLAIMS, `app/${claim.under}one/half${ext}`) })
        .toEqual({ kind, ext, nested: null })
    }
  }
})

test("a bodied file is a claimed file that is not an outline, and nothing else", () => {
  expect(bodyKind(TEST_CLAIMS, "notes/cabinets.md")).toBe("markdown")
  expect(bodyKind(TEST_CLAIMS, "report.html")).toBe("hypertext")
  expect(bodyKind(TEST_CLAIMS, "data/sales.csv")).toBe("csv")
  expect(bodyKind(TEST_CLAIMS, "art/handle.png")).toBe("image")
  expect(bodyKind(TEST_CLAIMS, "reports/q3.pdf")).toBe("pdf")
  expect(bodyKind(TEST_CLAIMS, "plan.olai")).toBeNull()
  expect(bodyKind(TEST_CLAIMS, "README")).toBeNull()
})

test("a file whose body is TEXT is the bodied ones something here can read", () => {
  expect(textKind(TEST_CLAIMS, "notes/cabinets.md")).toBe("markdown")
  expect(textKind(TEST_CLAIMS, "report.html")).toBe("hypertext")
  expect(textKind(TEST_CLAIMS, "data/sales.csv")).toBe("csv")
  expect(textKind(TEST_CLAIMS, "art/handle.png")).toBeNull()
  expect(textKind(TEST_CLAIMS, "reports/q3.pdf")).toBeNull()
  expect(textKind(TEST_CLAIMS, "plan.olai")).toBeNull()
  expect(textKind(TEST_CLAIMS, "README")).toBeNull()
})

test("the files a browser fetches are the ones whose page points at them", () => {
  expect(isFetched(TEST_CLAIMS, "report.html")).toBe(true)
  expect(isFetched(TEST_CLAIMS, "art/handle.png")).toBe(true)
  expect(isFetched(TEST_CLAIMS, `art/diagram${SVG_EXT}`)).toBe(true)
  expect(isFetched(TEST_CLAIMS, "reports/q3.pdf")).toBe(true)
  expect(isFetched(TEST_CLAIMS, "data/sales.csv")).toBe(false)
  expect(isFetched(TEST_CLAIMS, "notes/cabinets.md")).toBe(false)
  expect(isFetched(TEST_CLAIMS, "plan.olai")).toBe(false)
  expect(isFetched(TEST_CLAIMS, "README")).toBe(false)
})

test("the shown kinds are the ones the set holds the path of and not the content", () => {
  expect(unkept(TEST_CLAIMS, "report.html")).toBe(true)
  expect(unkept(TEST_CLAIMS, "data/sales.csv")).toBe(true)
  expect(unkept(TEST_CLAIMS, "art/handle.png")).toBe(true)
  expect(unkept(TEST_CLAIMS, "reports/q3.pdf")).toBe(true)
  expect(unkept(TEST_CLAIMS, "notes/cabinets.md")).toBe(false)
  expect(unkept(TEST_CLAIMS, "plan.olai")).toBe(false)
  expect(unkept(TEST_CLAIMS, "README")).toBe(false)
})

test("the minting constants are the suffixes the walk claims", () => {
  expect(fileKind(TEST_CLAIMS, `a${OUTLINE_EXT}`)).toBe("outline-olai")
  expect(fileKind(TEST_CLAIMS, `a${DOCUMENT_EXT}`)).toBe("markdown")
  expect(fileKind(TEST_CLAIMS, `a${SVG_EXT}`)).toBe("image")
})

test("the shown kinds are the bodied ones the set keeps no content of", () => {
  expect([...TEST_CLAIMS.byKind.values()].filter(claim => !claim.kept).map(claim => claim.kind).sort()).toEqual(["csv", "hypertext", "image", "pdf"])
})

test("unclaimed suffix wording never takes a dotted directory as a file suffix", () => {
  expect(noClaimFor("dir.d/name")).toBe("no row claims a path without a suffix")
  expect(noClaimFor("dir.d/name.org")).toBe("no row claims `.org`")
  expect(unclaimedFileMessage("dir.d/name.org")).toBe("The directory holds nothing by the name dir.d/name.org. No row claims `.org`.")
})
