import { describe, expect, test } from "bun:test"

import { createFolds, diffKey } from "./folds.ts"
const { isUnfolded, toggleFold } = createFolds()

describe("what the reader has opened", () => {
  test("nothing is open until it is asked for, and a second press shuts it", () => {
    const call = "tool:one"
    expect(isUnfolded(call)).toBe(false)
    toggleFold(call)
    expect(isUnfolded(call)).toBe(true)
    toggleFold(call)
    expect(isUnfolded(call)).toBe(false)
  })

  test("one block opening leaves every other block shut", () => {
    const here = diffKey("tool:two", 0, "docs/chat.md")
    toggleFold(here)
    expect(isUnfolded(here)).toBe(true)
    expect(isUnfolded(diffKey("tool:two", 0, "docs/architecture.md"))).toBe(false)
    expect(isUnfolded(diffKey("tool:three", 0, "docs/chat.md"))).toBe(false)
    expect(isUnfolded(diffKey("tool:two", 1, "docs/chat.md"))).toBe(false)
    expect(isUnfolded("tool:two")).toBe(false)
    toggleFold(here)
  })

  test("a block's name is its own, whatever the parts hold", () => {
    expect(diffKey("a", 1, "b")).not.toBe(diffKey("a", 11, "b"))
    expect(diffKey("a", 1, "0b")).not.toBe(diffKey("a", 10, "b"))
  })
})
