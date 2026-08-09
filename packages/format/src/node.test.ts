import { expect, test } from "bun:test"
import { Result } from "effect"

import { ID_SHAPE, isMirror, MIRROR_FIELDS, type Node } from "./node.ts"
import { parseOutline } from "./parse.ts"

/** The records of a JSONL fixture, in file order. */
const parsed = (contents: string): ReadonlyArray<Node> => {
  const result = parseOutline("a.jsonl", contents)
  if (Result.isFailure(result)) {
    throw new Error(`fixture does not parse: ${result.failure.map((e) => e.message).join("; ")}`)
  }
  return result.success.nodes.map((located) => located.node)
}

// There are exactly two record shapes, and which one a record is decides
// almost everything downstream — whether it needs a title, whether it can hold
// children, whether it counts toward a parent's status. One field answers it.
test("a record is a mirror when, and only when, it names one", () => {
  expect(parsed(`{"id":"m","ord":"a","mirror":"x"}\n{"id":"x","ord":"b","title":"x"}`)
    .map(isMirror)).toEqual([true, false])
})

// MIRROR_FIELDS is the mirror record spelled out, and it is shared: the parser
// rejects everything outside it and a writer serialises what is inside it.
// Drift between this set and the canonical mirror line is a silently widened
// format, so the two are compared against each other.
test("MIRROR_FIELDS is exactly the keys of a canonical mirror line", () => {
  expect(parsed(`{"id":"m","parent":"p","ord":"a","mirror":"x"}`)
    .map((node) => new Set(Object.keys(node)))).toEqual([new Set(MIRROR_FIELDS)])
})

// The id alphabet is published because ids travel into URLs and wire keys, so
// the layers that mint or accept an id check against this very regex.
test("ID_SHAPE admits slugs and nothing else", () => {
  expect(ID_SHAPE.test("kitchen-2_a")).toBe(true)
  for (const bad of ["", "has space", "dot.ted", "sla/sh", "hash#", "uni¢ode"]) {
    expect(ID_SHAPE.test(bad)).toBe(false)
  }
})
