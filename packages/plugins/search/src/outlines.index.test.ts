import { expect, test } from "bun:test"
import { isOutlineHit, NO_KINDS, type SearchRequest } from "@olai/format"
import { readingOf, setOf } from "@olai/format/testlib"
import { search } from "./matcher.ts"
import { open } from "./table.ts"

test("outline hits share indexed and walked answers without changing the existing differential suites", () => {
  const index = open()
  try {
    const vault = readingOf(setOf({
      "Home.olai": '{"id":"note","ord":"a0","title":"Remember","desc":"home"}',
      "work/Q4.olai": '',
      "_olai/Pins.olai": '',
    }, [["Home.md", "# Home"]]))
    for (const text of ["Home", "Q4", "work/", "is:done", "-is:done", "prop:pr", "-prop:pr", "Home OR is:done", "_olai/Pins.olai"]) {
      for (const kind of [undefined, "node", "document", "outline", "file"] as const) {
        const request: SearchRequest = { text, ...(kind === undefined ? {} : { kind }) }
        expect(search(vault, request, "2026-09-10", NO_KINDS, index)).toEqual(search(vault, request, "2026-09-10", NO_KINDS))
      }
    }
    const all = search(vault, { text: "Home" }, "2026-09-10", NO_KINDS)
    expect(all.hits.filter(isOutlineHit).map(hit => String(hit.at.path))).toEqual(["Home.olai"])
    expect(search(vault, { text: "Home", kind: "file" }, "2026-09-10", NO_KINDS).total).toBe(2)
    expect(search(vault, { text: "Home", kind: "document" }, "2026-09-10", NO_KINDS).total).toBe(1)
    for (const scope of [{ file: "Home.olai" }, { under: "note" }]) {
      expect(search(vault, { text: "Home", kind: "outline", ...scope }, "2026-09-10", NO_KINDS).hits).toEqual([])
    }
  } finally { index.close() }
})
