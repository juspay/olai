import { describe, expect, test } from "bun:test"

import type { Row } from "@olai/format"

import { foldableKeys } from "./fold.ts"

/** Minimal rows for the walk — only `key` and `children` matter here. */
const leaf = (key: string): Row =>
  ({
    kind: "node",
    key,
    children: [],
    at: { file: "x.jsonl", line: 1, node: { id: key, title: key } },
    status: undefined,
    blocked: [],
    progress: undefined,
    shows: {
      file: "x.jsonl",
      line: 1,
      node: { id: key, title: key },
    },
  }) as unknown as Row

const branch = (key: string, children: ReadonlyArray<Row>): Row =>
  ({
    ...leaf(key),
    children,
  }) as unknown as Row

describe("foldableKeys", () => {
  test("a leaf contributes nothing", () => {
    expect(foldableKeys(leaf("a"))).toEqual([])
  })

  test("a parent contributes itself and every nested parent", () => {
    const tree = branch("root", [
      leaf("a"),
      branch("mid", [leaf("b"), leaf("c")]),
    ])
    expect(foldableKeys(tree)).toEqual(["root", "mid"])
  })
})
