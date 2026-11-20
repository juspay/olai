const OUTLINE_EXT = mintExt(TEST_CLAIMS, "outline-olai")!
import { TEST_CLAIMS } from "@olai/format/testlib"
import { describe, expect, test } from "bun:test"

import type { NodeChange } from "./changes.ts"
import { noteDateOf } from "./dates.ts"
import { bareOf, mintExt, nameOf, stemOf } from "./kinds.ts"
import { composed } from "./message.ts"

const bySpelling = (file: string): string => {
  const name = file.slice(file.lastIndexOf("/") + 1)
  return name.endsWith(OUTLINE_EXT) ? name.slice(0, -OUTLINE_EXT.length) : name
}

const byFinding = (file: string): string => {
  const name = file.slice(file.lastIndexOf("/") + 1)
  return name.slice(0, name.lastIndexOf("."))
}

const AGREE: ReadonlyArray<readonly [path: string, stem: string]> = [
  ["roadmap.olai", "roadmap"],
  ["docs/roadmap.olai", "roadmap"],
  ["a/deep/tree/house.olai", "house"],
  ["Archive.olai", "Archive"],
  ["notes.v2.olai", "notes.v2"],
  [OUTLINE_EXT, ""],
]

const DIVERGE: ReadonlyArray<
  readonly [path: string, spelled: string, found: string, unified: string]
> = [
  ["2026-08-11.md", "2026-08-11.md", "2026-08-11", "2026-08-11"],
  ["Daily/2026/08/2026-08-12.md", "2026-08-12.md", "2026-08-12", "2026-08-12"],
  ["report.html", "report.html", "report", "report"],
  ["notes/report.html", "report.html", "report", "report"],
  ["shot.png", "shot.png", "shot", "shot"],
  ["art/diagram.svg", "diagram.svg", "diagram", "diagram"],
  ["house.olai.bak", "house.olai.bak", "house.olai", "house.olai.bak"],
  ["plan.json", "plan.json", "plan", "plan.json"],
  ["README", "README", "READM", "README"],
  ["docs/README", "README", "READM", "README"],
  ["justfile", "justfile", "justfil", "justfile"],
]

describe("the two suffix rules", () => {
  test("agree on an outline, which is the only name they agree on", () => {
    for (const [path, stem] of AGREE) {
      expect(bySpelling(path), path).toBe(stem)
      expect(byFinding(path), path).toBe(stem)
    }
  })

  test("and part company everywhere else, exactly here", () => {
    for (const [path, spelled, found] of DIVERGE) {
      expect(bySpelling(path), path).toBe(spelled)
      expect(byFinding(path), path).toBe(found)
      expect(spelled === found, `${path} is listed as a divergence`).toBe(false)
    }
  })
})

describe("the one rule they became", () => {
  test("is both of them on an outline, which is where they already agreed", () => {
    for (const [path, stem] of AGREE) {
      expect(stemOf(TEST_CLAIMS, path), path).toBe(stem)
    }
  })

  test("and takes the side of whichever was right about the file, on every other", () => {
    for (const [path, spelled, found, unified] of DIVERGE) {
      expect(stemOf(TEST_CLAIMS, path), path).toBe(unified)
      expect(
        unified === spelled || unified === found,
        `${path}: the merged rule invented an answer neither rule gave`,
      ).toBe(true)
    }
  })
})

describe("what each caller actually passes", () => {
  test("a commit subject names an outline's stem, with the suffix gone", () => {
    const change: NodeChange = {
      file: "docs/roadmap.olai",
      id: "x",
      title: "a node",
      fields: [],
      sort: "done",
    }
    expect(composed(TEST_CLAIMS, [change]).split("\n")[0]).toBe(
      "olai: 1 edit to roadmap — a node done",
    )
  })

  test("a daily note is read off a document, dots inside the name and all", () => {
    expect(noteDateOf(TEST_CLAIMS, "2026-08-11.md")).toBe("2026-08-11")
    expect(noteDateOf(TEST_CLAIMS, "Daily/2026/08/2026-08-12.md")).toBe("2026-08-12")
    expect(noteDateOf(TEST_CLAIMS, "notes.v2.md")).toBeNull()
    expect(noteDateOf(TEST_CLAIMS, "2026-08-11.olai")).toBeNull()
    expect(noteDateOf(TEST_CLAIMS, "2026-08-11.html")).toBeNull()
    expect(noteDateOf(TEST_CLAIMS, "2026-08-11")).toBeNull()
  })
})

describe("the suffix off a path, and the same off a name", () => {
  test("bareOf keeps every directory above the file", () => {
    expect(bareOf(TEST_CLAIMS, "notes/plan.md")).toBe("notes/plan")
    expect(bareOf(TEST_CLAIMS, "Daily/2026/08/2026-08-12.md")).toBe("Daily/2026/08/2026-08-12")
    expect(bareOf(TEST_CLAIMS, "plan.olai")).toBe("plan")
    expect(bareOf(TEST_CLAIMS, "report.html")).toBe("report")
    expect(bareOf(TEST_CLAIMS, "art/handle.png")).toBe("art/handle")
    expect(bareOf(TEST_CLAIMS, "art/diagram.svg")).toBe("art/diagram")
  })

  test("a file no kind claims is handed back whole, path and all", () => {
    expect(bareOf(TEST_CLAIMS, "notes/README")).toBe("notes/README")
    expect(bareOf(TEST_CLAIMS, "plan v1.2")).toBe("plan v1.2")
    expect(bareOf(TEST_CLAIMS, "data/rows.tsv")).toBe("data/rows.tsv")
  })

  test("a stem is this answer over the basename", () => {
    for (const path of ["notes/plan.md", "a/b/c.olai", "README", "x/y/plan v1.2", "r.html"]) {
      expect({ path, stem: stemOf(TEST_CLAIMS, path) }).toEqual({
        path,
        stem: bareOf(TEST_CLAIMS, path.slice(path.lastIndexOf("/") + 1)),
      })
    }
  })
})

test("a document is named by its stem, any other file by its basename", () => {
  expect(nameOf(TEST_CLAIMS, "notes/garden.olai")).toBe("garden")
  expect(nameOf(TEST_CLAIMS, "notes/plan.md")).toBe("plan")
  expect(nameOf(TEST_CLAIMS, "art/report.pdf")).toBe("report.pdf")
  expect(nameOf(TEST_CLAIMS, "art/handle.png")).toBe("handle.png")
  expect(nameOf(TEST_CLAIMS, "rows.csv")).toBe("rows.csv")
  expect(nameOf(TEST_CLAIMS, "notes/README")).toBe("README")
})
