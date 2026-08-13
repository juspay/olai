/**
 * Which of the agent's backticks are node references.
 *
 * The rule and nothing else — no DOM, because the DOM part is a loop over
 * `querySelectorAll("code")` and the part that can be wrong is this: an agent
 * writes backticks around every kind of thing, and only the ones the SET
 * declares may become pressable. The alternative to asking the set is a syntax
 * nobody emits, which is what this convention exists to avoid.
 *
 * What a marked span then DOES is the browser suite's
 * (`features/node_context.feature`): a click is a page moving under a reader,
 * and that is not a thing a value can say.
 */

import { derive, nodeNamed } from "@olai/format"
import { setOf } from "@olai/format/testlib"
import { describe, expect, test } from "bun:test"

import { nodeNamedBy } from "./refs.ts"

/**
 * A REAL set, resolved the way the panel resolves it.
 *
 * The fake predicate this used to carry could not see the case that matters:
 * `echo` is a placement of `order`, the format resolves it, and what has to
 * end up on the span is the id of the node the reader can be shown. A
 * `(id) => boolean` cannot say that — which is why the rule answers with the
 * id it resolved to rather than with yes.
 */
const HOUSE = [
  `{"id":"kitchen","ord":"a0","title":"kitchen remodel"}`,
  `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets"}`,
  `{"id":"install","parent":"kitchen","ord":"a2","title":"install them"}`,
  `{"id":"echo","ord":"a1","mirror":"order"}`,
  `{"id":"nowhere","ord":"a2","mirror":"gone"}`,
].join("\n")

const indexes = derive(setOf({ "house.jsonl": HOUSE }).nodes)

/** What `./Entry.tsx` passes: the format's own rule for what an id names. */
const resolve = (id: string): string | null =>
  nodeNamed(indexes, id)?.node.id ?? null

describe("an id the agent named", () => {
  test("a span the set declares is a reference", () => {
    expect(nodeNamedBy("order", false, resolve)).toBe("order")
  })

  test("a span the set does not declare is left as what it is", () => {
    // Everything else an agent writes in backticks: a flag, a file, a word.
    expect(nodeNamedBy("true", false, resolve)).toBeNull()
    expect(nodeNamedBy("house.jsonl", false, resolve)).toBeNull()
    expect(nodeNamedBy("bun test", false, resolve)).toBeNull()
  })

  test("a fence is a quotation, not a pointer", () => {
    expect(nodeNamedBy("order", true, resolve)).toBeNull()
  })

  test("an empty span names nothing, and is not asked about", () => {
    expect(nodeNamedBy("", false, resolve)).toBeNull()
    expect(nodeNamedBy(null, false, resolve)).toBeNull()
    expect(nodeNamedBy("   ", false, resolve)).toBeNull()
  })

  test("the id is what the span says, less the space around it", () => {
    expect(nodeNamedBy(" order ", false, resolve)).toBe("order")
  })

  test("a PLACEMENT the agent named points at the node it shows", () => {
    // An agent writes placement ids: `read_node` answers `mirrors` with them
    // and `remove_mirror` takes them. What the span must carry is the id of
    // the node a reader can be SHOWN — no row in the tree is `echo` (a row
    // carries the node it shows), so a span marked `echo` could only ever fail
    // to find a row and leave the page for a node that is right there.
    expect(nodeNamedBy("echo", false, resolve)).toBe("order")
  })

  test("a placement whose chain is dead names nothing", () => {
    // The format resolves it to nothing, so there is nothing to point at —
    // and the span stays a span rather than becoming a control that cannot
    // work.
    expect(nodeNamedBy("nowhere", false, resolve)).toBeNull()
  })
})
