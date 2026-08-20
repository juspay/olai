/**
 * Which of the agent's backticks are node references.
 *
 * The rule and nothing else — no DOM, because the DOM part is a loop over
 * `querySelectorAll("code")` and the part that can be wrong is this: an agent
 * writes backticks around every kind of thing, and only the ones the SET
 * declares may become pressable. The alternative to asking the set is a syntax
 * nobody emits, which is what this convention exists to avoid.
 *
 * WHO ANSWERS is the server since `vib-3-transcript-ids` (`./declared.ts` asks
 * it, one batch per message) and the rule did not move an inch: it always took
 * the resolution as a function, so what is modelled below is the answer rather
 * than the copy of the set it used to come out of.
 *
 * What a marked span then DOES is the browser suite's
 * (`features/node_context.feature`): a click is a page moving under a reader,
 * and that is not a thing a value can say.
 */

import { derive, nodeNamed } from "@olai/format"
import { recordsOf, setOf } from "@olai/format/testlib"
import { describe, expect, test } from "bun:test"

import { nodeNamedBy } from "./refs.ts"

/**
 * A REAL set, resolved the way the SERVER resolves it — `@olai/ops`' `named`
 * is this function over the same `nodeNamed`, and `./declared.ts` puts its
 * answer behind exactly this signature.
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

const indexes = derive(recordsOf(setOf({ "house.olai": HOUSE })))

/** What `./Entry.tsx` passes: what the set has answered about an id — which is
 *  the format's own rule for what an id names, run on the other side of the
 *  wire. */
const resolve = (id: string): string | null =>
  nodeNamed(indexes, id)?.node.id ?? null

describe("an id the agent named", () => {
  test("a span the set declares is a reference", () => {
    expect(nodeNamedBy("order", false, resolve)).toBe("order")
  })

  test("a span the set does not declare is left as what it is", () => {
    // Everything else an agent writes in backticks: a flag, a file, a word.
    expect(nodeNamedBy("true", false, resolve)).toBeNull()
    expect(nodeNamedBy("house.olai", false, resolve)).toBeNull()
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

describe("before the set has answered", () => {
  /** Nothing answered yet: what `./declared.ts` hands back for every id until
   *  the first batch lands. */
  const nothingYet = (): string | null => null

  test("a span is PLAIN, exactly as one the set does not declare is", () => {
    // The one state the mark has to be in while a question is in flight, and
    // the reason there is no third look: a span marked on a guess and unmarked
    // when the answer arrives is a control that was never there, under a cursor
    // that has already moved to it. Both directions of the pass then agree —
    // marking is what an ANSWER does.
    expect(nodeNamedBy("order", false, nothingYet)).toBeNull()
  })
})
