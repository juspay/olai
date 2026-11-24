import { TEST_CLAIMS } from "@olai/format/testlib"
import { expect, test } from "bun:test"
import { ancestorDirs, dirsIn, fileTree, listed } from "./fileTree.ts"

const files = ["garden.olai", "house.olai", "notes/map.olai", "notes/palette.md", "art/a.png", "b.md", "README", "empty/code.js"]
test("one tree holds every claimed file and drops unclaimed files with their folders", () => {
  const rows = fileTree(TEST_CLAIMS, files)
  expect(rows.map(row => row.name)).toEqual(["art", "b", "garden", "house", "notes"])
  expect(dirsIn(rows)).toEqual(new Set(["art", "notes"]))
  expect(rows[1]).toEqual({ kind: "file", key: "file:b.md", name: "b", file: "b.md", of: "markdown" })
})
test("a mixed folder is one folder holding both kinds by name", () => {
  expect(fileTree(TEST_CLAIMS, ["notes/palette.md", "notes/map.olai"])).toEqual([{
    kind: "dir", key: "dir:notes", name: "notes", path: "notes", children: [
      { kind: "file", key: "file:notes/map.olai", name: "map", file: "notes/map.olai", of: "outline-olai" },
      { kind: "file", key: "file:notes/palette.md", name: "palette", file: "notes/palette.md", of: "markdown" },
    ],
  }])
})
test("names order the tree across kinds, folders and files together", () => {
  const rows = fileTree(TEST_CLAIMS, ["z.md", "beta/a.md", "a.olai", "b.md", "c.pdf"])
  expect(rows.map(row => row.name)).toEqual(["a", "b", "beta", "c.pdf", "z"])
})
test("an empty directory has no folders or files", () => {
  expect(fileTree(TEST_CLAIMS, [])).toEqual([])
  expect(fileTree(TEST_CLAIMS, ["README", "empty/code.js"])).toEqual([])
})
test("the archive, olai's own files and a kind reached elsewhere are not listed", () => {
  const served = ["house.olai", "_olai/Trash.olai", "_olai/Settings.olai", "plugins/swatch/server.ts", "plugins/swatch/README.md", "toolbox.ts"]
  const kept = served.filter(file => listed(TEST_CLAIMS, file))
  expect(kept).toEqual(["house.olai", "plugins/swatch/README.md", "toolbox.ts"])
  // `toolbox.ts` passes the ruling but no kind claims it outside `plugins/`, so the tree drops it.
  const rows = fileTree(TEST_CLAIMS, kept)
  expect(rows.map(row => row.name)).toEqual(["house", "plugins"])
})
test("input ordering and duplicate paths do not change the tree", () => {
  expect(fileTree(TEST_CLAIMS, [...files].reverse().concat(files))).toEqual(fileTree(TEST_CLAIMS, files))
})
test("deep directory chains retain their paths and stable keys", () => {
  const rows = fileTree(TEST_CLAIMS, ["a/b/c.olai"])
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
