import { TEST_CLAIMS } from "@olai/format/testlib"
import { expect, test } from "bun:test"
import { ancestorDirs, dirsIn, fileTree } from "./fileTree.ts"

const files = ["garden.olai", "house.olai", "notes/map.olai", "notes/palette.md", "art/a.png", "b.md", "README", "empty/code.js"]
test("Outlines contains only node claims and drops reference-only and unclaimed folders", () => {
  const rows = fileTree(TEST_CLAIMS, files, "nodes")
  expect(rows.map(row => row.name)).toEqual(["garden", "house", "notes"])
  expect(dirsIn(rows)).toEqual(new Set(["notes"]))
})
test("Reference contains other claimed files and no outline-only folders", () => {
  const rows = fileTree(TEST_CLAIMS, [...files, "work/task.olai"], "reference")
  expect(rows.map(row => row.name)).toEqual(["art", "b", "notes"])
  expect(dirsIn(rows)).toEqual(new Set(["art", "notes"]))
  expect(rows[1]).toEqual({ kind: "file", key: "file:b.md", name: "b", file: "b.md", of: "markdown" })
})
test("a mixed folder belongs to both trees, with separate leaves and one fold path", () => {
  for (const [mode, file] of [["nodes", "notes/map.olai"], ["reference", "notes/palette.md"]] as const) {
    const rows = fileTree(TEST_CLAIMS, ["notes/map.olai", "notes/palette.md"], mode)
    expect(rows).toEqual([{ kind: "dir", key: "dir:notes", name: "notes", path: "notes", children: [{ kind: "file", key: `file:${file}`, name: mode === "nodes" ? "map" : "palette", file, of: mode === "nodes" ? "outline-olai" : "markdown" }] }])
  }
})
test("empty regions have no folders or files", () => {
  expect(fileTree(TEST_CLAIMS, [], "nodes")).toEqual([])
  expect(fileTree(TEST_CLAIMS, ["only.md"], "nodes")).toEqual([])
  expect(fileTree(TEST_CLAIMS, ["only.olai"], "reference")).toEqual([])
})
test("stems determine file order, directories share the alphabetical order", () => {
  const rows = fileTree(TEST_CLAIMS, ["z.md", "beta/a.md", "a.md", "b.md"], "reference")
  expect(rows.map(row => row.name)).toEqual(["a", "b", "beta", "z"])
})
test("input ordering and duplicate paths do not change either tree", () => {
  for (const mode of ["nodes", "reference"] as const) expect(fileTree(TEST_CLAIMS, [...files].reverse().concat(files), mode)).toEqual(fileTree(TEST_CLAIMS, files, mode))
})
test("deep directory chains retain their paths and stable keys", () => {
  const rows = fileTree(TEST_CLAIMS, ["a/b/c.olai"], "nodes")
  expect(dirsIn(rows)).toEqual(new Set(["a", "a/b"]))
  expect(rows[0]?.key).toBe("dir:a")
  const root = rows[0]!
  if (root.kind === "dir") expect(root.children[0]?.key).toBe("dir:a/b")
})
test("ancestry is empty at the root and ordered outside-in", () => {
  expect(ancestorDirs("house.olai")).toEqual([])
  expect(ancestorDirs("notes/palette.md")).toEqual(["notes"])
  expect(ancestorDirs("a/b/c.olai")).toEqual(["a", "a/b"])
})
