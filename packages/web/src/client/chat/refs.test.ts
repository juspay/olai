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

import { describe, expect, test } from "bun:test"

import { nodeNamedBy } from "./refs.ts"

/** The loaded set, as the only question this rule asks of one. */
const declares = (id: string): boolean =>
  ["order", "kitchen", "install"].includes(id)

describe("an id the agent named", () => {
  test("a span the set declares is a reference", () => {
    expect(nodeNamedBy("order", false, declares)).toBe("order")
  })

  test("a span the set does not declare is left as what it is", () => {
    // Everything else an agent writes in backticks: a flag, a file, a word.
    expect(nodeNamedBy("true", false, declares)).toBeNull()
    expect(nodeNamedBy("house.jsonl", false, declares)).toBeNull()
    expect(nodeNamedBy("bun test", false, declares)).toBeNull()
  })

  test("a fence is a quotation, not a pointer", () => {
    expect(nodeNamedBy("order", true, declares)).toBeNull()
  })

  test("an empty span names nothing, and is not asked about", () => {
    expect(nodeNamedBy("", false, declares)).toBeNull()
    expect(nodeNamedBy(null, false, declares)).toBeNull()
    expect(nodeNamedBy("   ", false, declares)).toBeNull()
  })

  test("the id is what the span says, less the space around it", () => {
    expect(nodeNamedBy(" order ", false, declares)).toBe("order")
  })
})
