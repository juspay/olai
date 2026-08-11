import { expect, test } from "bun:test"

import { fileTree } from "./fileTree.ts"

test("a flat directory is one list of files, outlines and documents mixed", () => {
  expect(fileTree(["garden.jsonl", "house.jsonl"], ["finishes.md"])).toEqual([
    { kind: "file", name: "finishes.md", file: "finishes.md", of: "document" },
    { kind: "file", name: "garden.jsonl", file: "garden.jsonl", of: "outline" },
    { kind: "file", name: "house.jsonl", file: "house.jsonl", of: "outline" },
  ])
})

test("a nested path becomes a directory node with the basename as the leaf", () => {
  expect(fileTree(["house.jsonl"], ["notes/palette.md", "finishes.md"])).toEqual([
    { kind: "file", name: "finishes.md", file: "finishes.md", of: "document" },
    { kind: "file", name: "house.jsonl", file: "house.jsonl", of: "outline" },
    {
      kind: "dir",
      name: "notes",
      path: "notes",
      children: [
        {
          kind: "file",
          name: "palette.md",
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
    fileTree(
      ["Daily/2026-08.jsonl", "house.jsonl"],
      ["Daily/notes.md", "finishes.md"],
    ),
  ).toEqual([
    {
      kind: "dir",
      name: "Daily",
      path: "Daily",
      children: [
        {
          kind: "file",
          name: "2026-08.jsonl",
          file: "Daily/2026-08.jsonl",
          of: "outline",
        },
        {
          kind: "file",
          name: "notes.md",
          file: "Daily/notes.md",
          of: "document",
        },
      ],
    },
    { kind: "file", name: "finishes.md", file: "finishes.md", of: "document" },
    { kind: "file", name: "house.jsonl", file: "house.jsonl", of: "outline" },
  ])
})

test("depth is preserved: a chain of directories is a chain of dir nodes", () => {
  expect(fileTree(["a/b/c.jsonl"], [])).toEqual([
    {
      kind: "dir",
      name: "a",
      path: "a",
      children: [
        {
          kind: "dir",
          name: "b",
          path: "a/b",
          children: [
            { kind: "file", name: "c.jsonl", file: "a/b/c.jsonl", of: "outline" },
          ],
        },
      ],
    },
  ])
})

test("children sort by name, dirs and files together", () => {
  // `notes` (dir) sorts after `house.jsonl` and before `zebra.md` by name.
  expect(
    fileTree(["house.jsonl", "notes/inner.jsonl"], ["zebra.md", "alpha.md"]),
  ).toEqual([
    { kind: "file", name: "alpha.md", file: "alpha.md", of: "document" },
    { kind: "file", name: "house.jsonl", file: "house.jsonl", of: "outline" },
    {
      kind: "dir",
      name: "notes",
      path: "notes",
      children: [
        {
          kind: "file",
          name: "inner.jsonl",
          file: "notes/inner.jsonl",
          of: "outline",
        },
      ],
    },
    { kind: "file", name: "zebra.md", file: "zebra.md", of: "document" },
  ])
})

test("empty inputs are an empty tree", () => {
  expect(fileTree([], [])).toEqual([])
})
