/**
 * A WRITE READS THE TEXTS IT CHANGED AND NO OTHERS — on the planner's side too.
 * `encoded` reads the planned file back; handed the document the file stood
 * at, every record whose title and note the op left alone keeps the reading
 * it had, the same object, and only the changed one is read again.
 */
import { expect, test } from "bun:test"

import { isMirror, recordRead, type RegularNode } from "@olai/format"
import { FIXTURE_FILE, outlineOf } from "@olai/format/testlib"
import { Result } from "effect"

import { encoded } from "./encode.ts"
import { TEST_CLAIMS } from "./fixtures.testlib.ts"

const STANDING = outlineOf([
  `{"id":"kitchen","ord":"a0","title":"kitchen, see [the brief](brief.md)","desc":"tiles"}`,
  `{"id":"porch","ord":"a1","title":"porch"}`,
  `{"id":"garden","ord":"a2","title":"garden [[beds]]"}`,
].join("\n") + "\n")

const regular = (nodes: ReadonlyArray<{ readonly node: unknown }>): ReadonlyArray<RegularNode> =>
  nodes.flatMap(({ node }) => isMirror(node as RegularNode) ? [] : [node as RegularNode])

const planned = regular(STANDING.nodes).map((node) => node.id === "porch" ? { ...node, title: "porch, painted" } : node)

const readBack = (previous: typeof STANDING | undefined): ReadonlyArray<RegularNode> => {
  const read = encoded(TEST_CLAIMS, FIXTURE_FILE, planned, previous)
  if (Result.isFailure(read)) throw new Error(read.failure.reason)
  return regular(read.success.outline.nodes)
}

test("handed the standing document, an untouched record keeps its reading and a changed one is read", () => {
  const before = new Map(regular(STANDING.nodes).map((node) => [node.id, recordRead(node)]))
  const after = readBack(STANDING)
  expect(after.map((node) => [node.id, recordRead(node) === before.get(node.id)])).toEqual([
    ["kitchen", true],
    ["porch", false],
    ["garden", true],
  ])
  expect(recordRead(after[1]!).title.firstLine).toBe("porch, painted")
})

test("a file the op mints has nothing to carry, and every record is read", () => {
  const before = new Map(regular(STANDING.nodes).map((node) => [node.id, recordRead(node)]))
  expect(readBack(undefined).some((node) => recordRead(node) === before.get(node.id))).toBe(false)
})
