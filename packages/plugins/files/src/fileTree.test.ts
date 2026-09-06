import { expect, test } from "bun:test"

import { ancestorDirs, dirsIn, fileTree } from "./fileTree.ts"

test("a flat directory is one list of files, outlines and documents mixed", () => {
  expect(fileTree(["garden.olai", "house.olai", "finishes.md"])).toEqual([
    {
      kind: "file",
      key: "file:finishes.md",
      name: "finishes",
      file: "finishes.md",
      of: "document",
    },
    {
      kind: "file",
      key: "file:garden.olai",
      name: "garden",
      file: "garden.olai",
      of: "outline",
    },
    {
      kind: "file",
      key: "file:house.olai",
      name: "house",
      file: "house.olai",
      of: "outline",
    },
  ])
})

// WHAT KIND each row is comes off the name, not off which list the caller had
// it in — one list goes in, and `@olai/format`'s registry answers for every
// path in it. A path no kind claims is dropped rather than drawn: the wire
// cannot produce one (every collection it comes from is built from that same
// registry), and a row with no kind would have no glyph and nowhere to link.
test("a row's kind is read off its name, and an unclaimed path is not a row", () => {
  expect(fileTree(["b.md", "a.olai", "README", "notes/rows.tsv"])).toEqual([
    {
      kind: "file",
      key: "file:a.olai",
      name: "a",
      file: "a.olai",
      of: "outline",
    },
    {
      kind: "file",
      key: "file:b.md",
      name: "b",
      file: "b.md",
      of: "document",
    },
  ])
})

test("a nested path becomes a directory node with the stem as the leaf", () => {
  expect(fileTree(["house.olai", "notes/palette.md", "finishes.md"])).toEqual([
    {
      kind: "file",
      key: "file:finishes.md",
      name: "finishes",
      file: "finishes.md",
      of: "document",
    },
    {
      kind: "file",
      key: "file:house.olai",
      name: "house",
      file: "house.olai",
      of: "outline",
    },
    {
      kind: "dir",
      key: "dir:notes",
      name: "notes",
      path: "notes",
      children: [
        {
          kind: "file",
          key: "file:notes/palette.md",
          name: "palette",
          file: "notes/palette.md",
          of: "document",
        },
      ],
    },
  ])
})

// The whole reason this is a tree: one folder holds BOTH kinds, the way a
// reader of the directory sees it — not an outlines section and a documents
// section that each re-spell the path.
test("a directory mixes outlines and documents under one node", () => {
  expect(
    fileTree([
      "Daily/2026-08.olai",
      "house.olai",
      "Daily/notes.md",
      "finishes.md",
    ]),
  ).toEqual([
    {
      kind: "dir",
      key: "dir:Daily",
      name: "Daily",
      path: "Daily",
      children: [
        {
          kind: "file",
          key: "file:Daily/2026-08.olai",
          name: "2026-08",
          file: "Daily/2026-08.olai",
          of: "outline",
        },
        {
          kind: "file",
          key: "file:Daily/notes.md",
          name: "notes",
          file: "Daily/notes.md",
          of: "document",
        },
      ],
    },
    {
      kind: "file",
      key: "file:finishes.md",
      name: "finishes",
      file: "finishes.md",
      of: "document",
    },
    {
      kind: "file",
      key: "file:house.olai",
      name: "house",
      file: "house.olai",
      of: "outline",
    },
  ])
})

test("depth is preserved: a chain of directories is a chain of dir nodes", () => {
  expect(fileTree(["a/b/c.olai"])).toEqual([
    {
      kind: "dir",
      key: "dir:a",
      name: "a",
      path: "a",
      children: [
        {
          kind: "dir",
          key: "dir:a/b",
          name: "b",
          path: "a/b",
          children: [
            {
              kind: "file",
              key: "file:a/b/c.olai",
              name: "c",
              file: "a/b/c.olai",
              of: "outline",
            },
          ],
        },
      ],
    },
  ])
})

test("children sort by name, dirs and files together", () => {
  // `notes` (dir) sorts after `house.olai` and before `zebra.md` by name.
  expect(
    fileTree(["house.olai", "notes/inner.olai", "zebra.md", "alpha.md"]),
  ).toEqual([
    {
      kind: "file",
      key: "file:alpha.md",
      name: "alpha",
      file: "alpha.md",
      of: "document",
    },
    {
      kind: "file",
      key: "file:house.olai",
      name: "house",
      file: "house.olai",
      of: "outline",
    },
    {
      kind: "dir",
      key: "dir:notes",
      name: "notes",
      path: "notes",
      children: [
        {
          kind: "file",
          key: "file:notes/inner.olai",
          name: "inner",
          file: "notes/inner.olai",
          of: "outline",
        },
      ],
    },
    {
      kind: "file",
      key: "file:zebra.md",
      name: "zebra",
      file: "zebra.md",
      of: "document",
    },
  ])
})

test("empty inputs are an empty tree", () => {
  expect(fileTree([])).toEqual([])
})

// Keys are unique across dirs and files, and stable for a path — the drawer
// keys rows by them so a membership change does not rebuild untouched places.
test("every row's key names its place", () => {
  const tree = fileTree(["Daily/2026-08.olai", "notes/palette.md"])
  const keys = (rows: ReturnType<typeof fileTree>): string[] =>
    rows.flatMap((row) =>
      row.kind === "dir" ? [row.key, ...keys(row.children)] : [row.key],
    )
  expect(keys(tree)).toEqual([
    "dir:Daily",
    "file:Daily/2026-08.olai",
    "dir:notes",
    "file:notes/palette.md",
  ])
})

// The open file's parent chain — what the sidebar force-opens so a
// collapsed-by-default tree never hides the selection.
test("ancestorDirs is the directory chain above a nested file", () => {
  expect(ancestorDirs("house.olai")).toEqual([])
  expect(ancestorDirs("notes/palette.md")).toEqual(["notes"])
  expect(ancestorDirs("a/b/c.olai")).toEqual(["a", "a/b"])
})

// Which folders EXIST, read off the tree the sidebar draws — what the memory of
// open folders is pruned against (`fold/folders.ts`). Off the rows rather than
// off the paths, so there is one answer rather than two that could disagree.
test("dirsIn is every folder the tree draws, nested ones included", () => {
  expect(dirsIn(fileTree(["house.olai"]))).toEqual(new Set())
  expect(
    dirsIn(fileTree(["Daily/2026/08.olai", "house.olai", "notes/palette.md"])),
  ).toEqual(new Set(["Daily", "Daily/2026", "notes"]))
})
