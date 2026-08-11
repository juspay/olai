/**
 * The allowlist, as a shape rather than as a claim in a comment.
 *
 * ./sanitise.ts opens exactly one hole in the default schema — a single class
 * VALUE on `a` — and the way that stops being true is not a rewrite anybody
 * would review. It is a `...defaultSchema.attributes` that grows an entry, a
 * `className` that quietly loses its value list, or an upgrade of
 * `hast-util-sanitize` that reshapes the default underneath us. None of those
 * look like a security change in a diff, and all three are red here.
 *
 * Written against the DEFAULT rather than against a literal copy of it, so
 * this asserts "one value more than upstream" and not "the list I happened to
 * see".
 */

import { expect, test } from "bun:test"
import { defaultSchema } from "rehype-sanitize"

import { ANCHOR_CLASS } from "./anchors.ts"
import { SANITISE } from "./sanitise.ts"

const listed = (schema: typeof defaultSchema, tag: string) => schema.attributes?.[tag] ?? []

/** The values an attribute is restricted to, or `undefined` where the schema
 *  names it with no restriction at all. */
const values = (entries: ReturnType<typeof listed>, attribute: string): unknown[] | undefined => {
  const entry = entries.find((one) => (Array.isArray(one) ? one[0] : one) === attribute)
  return Array.isArray(entry) ? [...entry] : undefined
}

test("`a` may carry the anchor's class, and no other class of its own", () => {
  const before = listed(defaultSchema, "a")
  const after = listed(SANITISE, "a")

  // Same entries, in the same order: nothing was added to the tag and nothing
  // dropped from it.
  expect(after.map((entry) => (Array.isArray(entry) ? entry[0] : entry)))
    .toEqual(before.map((entry) => (Array.isArray(entry) ? entry[0] : entry)))

  // A VALUE list, still, and one longer. `undefined` on either side would mean
  // the default had stopped restricting `className` — or stopped naming it, in
  // which case the anchor's class is being stripped and the page is unstyled.
  // Both are the quiet failure ./sanitise.ts describes, and both are this
  // line.
  expect(values(before, "className")).toBeDefined()
  expect(values(after, "className")).toEqual([...(values(before, "className") ?? []), ANCHOR_CLASS])
})

test("no other tag's allowlist moved", () => {
  const tags = new Set([
    ...Object.keys(defaultSchema.attributes ?? {}),
    ...Object.keys(SANITISE.attributes ?? {}),
  ])
  for (const tag of tags) {
    if (tag === "a") continue
    expect([tag, listed(SANITISE, tag)]).toEqual([tag, listed(defaultSchema, tag)])
  }
})

// Everything else about the schema is upstream's. `tagNames` especially: the
// anchor is an `a`, which was already allowed, and needing a new TAG would have
// been a different conversation.
test("nothing but the attributes was touched", () => {
  expect(SANITISE.tagNames).toEqual(defaultSchema.tagNames)
  expect(SANITISE.protocols).toEqual(defaultSchema.protocols)
  expect(SANITISE.clobber).toEqual(defaultSchema.clobber)
  // Off, as it has been since footnotes: ./rewrite.ts mints every id on the
  // page against the block it is in, which is the stronger rule.
  expect(SANITISE.clobberPrefix).toBe("")
})
