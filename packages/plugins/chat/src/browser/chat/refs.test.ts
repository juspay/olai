import { TEST_CLAIMS } from "@olai/format/testlib"
import { derive, nodeNamed } from "@olai/format"
import { recordsOf, setOf } from "@olai/format/testlib"
import { describe, expect, test } from "bun:test"

import { nodeNamedBy } from "./refs.ts"

const HOUSE = [
  `{"id":"kitchen","ord":"a0","title":"kitchen remodel"}`,
  `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets"}`,
  `{"id":"install","parent":"kitchen","ord":"a2","title":"install them"}`,
  `{"id":"echo","ord":"a1","mirror":"order"}`,
  `{"id":"nowhere","ord":"a2","mirror":"gone"}`,
].join("\n")

const indexes = derive(TEST_CLAIMS, recordsOf(setOf({ "house.olai": HOUSE })))

const resolve = (id: string): string | null =>
  nodeNamed(indexes, id)?.node.id ?? null

describe("an id the agent named", () => {
  test("a span the set declares is a reference", () => {
    expect(nodeNamedBy("order", false, resolve).id).toBe("order")
  })

  test("a span the set does not declare is left as what it is", () => {
    expect(nodeNamedBy("true", false, resolve).id).toBeNull()
    expect(nodeNamedBy("house.olai", false, resolve).id).toBeNull()
    expect(nodeNamedBy("bun test", false, resolve).id).toBeNull()
  })

  test("a fence is a quotation, not a pointer", () => {
    expect(nodeNamedBy("order", true, resolve).id).toBeNull()
  })

  test("an empty span names nothing, and is not asked about", () => {
    expect(nodeNamedBy("", false, resolve).id).toBeNull()
    expect(nodeNamedBy(null, false, resolve).id).toBeNull()
    expect(nodeNamedBy("   ", false, resolve).id).toBeNull()
  })

  test("the id is what the span says, less the space around it", () => {
    expect(nodeNamedBy(" order ", false, resolve).id).toBe("order")
  })

  test("a PLACEMENT the agent named points at the node it shows", () => {
    expect(nodeNamedBy("echo", false, resolve).id).toBe("order")
  })

  test("a placement whose chain is dead names nothing", () => {
    expect(nodeNamedBy("nowhere", false, resolve).id).toBeNull()
  })
})

describe("before the set has answered", () => {
  const nothingYet = (): string | null => null

  test("a span is PLAIN, exactly as one the set does not declare is", () => {
    expect(nodeNamedBy("order", false, nothingYet).id).toBeNull()
  })
})

describe("what the set is asked about", () => {
  const nothing = (): string | null => null

  test("the id is the span's own spelling, never the resolved one", () => {
    expect(nodeNamedBy("echo", false, resolve)).toEqual({ asked: "echo", id: "order" })
  })

  test("a span that could never be marked is never asked about", () => {
    expect(nodeNamedBy("order", true, resolve).asked).toBeNull()
    expect(nodeNamedBy("   ", false, resolve).asked).toBeNull()
    expect(nodeNamedBy(null, false, resolve).asked).toBeNull()
  })

  test("a span IS asked about before anything has answered", () => {
    expect(nodeNamedBy(" order ", false, nothing)).toEqual({ asked: "order", id: null })
  })
})
