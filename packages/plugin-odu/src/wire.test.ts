/**
 * WHAT THIS PLUGIN'S ONE CELL PROMISES ABOUT ITS OWN SHAPE.
 *
 * The `arrayKey` claim used to be held in `@olai/surface`'s own suite, beside
 * the claims about core's members, because the `ci` cell was declared there.
 * It is declared HERE now, and a claim about a member belongs where the member
 * is — a suite one package over could go on passing while this schema moved
 * under it, which is the drift the whole extraction is about.
 *
 * The walk itself stayed general and is reached through `@olai/surface`'s
 * `./testlib` door: it is a fifty-line schema traversal, and a copy of it here
 * would be a second opinion about the very thing under test.
 */

import { expect, test } from "bun:test"

import { keyings } from "@olai/surface/testlib"

import { surface } from "./wire.ts"

test("the ci cell's key reaches BOTH its arrays — the runs, and the nodes inside each", () => {
  expect(surface.spec.cells.ci.arrayKey).toBe("id")
  const declared = surface.spec.cells.ci.arrayKey
  const found = keyings(
    surface.spec.cells.ci.schema as unknown as { readonly ast: Parameters<typeof keyings>[0]["ast"] },
    declared,
  )
  // One field name, every array at every depth: a run is identified by the
  // board's own `worktree` value and a node by odu's `<namepath>@<platform>`,
  // and both are spelled `id` precisely so one declaration governs both. A
  // coordinator republishes its whole pipeline on every node transition, and
  // an unkeyed inner array would wake every row of a lanes outline for each.
  expect(found.get("runs")).toBe("keyed")
  expect(found.get("runs[].cells")).toBe("keyed")
  // The two string lists are not in this walk at all — it reads arrays of
  // OBJECTS, which is where identity is a question. A lane roster and a
  // scheduling order are sequences of words, and merging them by position is
  // the only thing they could mean.
  expect([...found.keys()].sort()).toEqual(["runs", "runs[].cells"])
})
