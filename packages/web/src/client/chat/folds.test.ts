/**
 * What the reader has opened, as state.
 *
 * No DOM: it is a set of keys and two functions over it, which is the whole
 * reason the fold lives outside the row it belongs to. The claim worth holding
 * is the one the KEY makes — a call can rewrite several files, and a file is
 * edited again in a later turn, so opening one diff must never open another.
 */

import { describe, expect, test } from "bun:test"

import { diffKey, isUnfolded, toggleFold } from "./folds.ts"

describe("what the reader has opened", () => {
  test("nothing is open until it is asked for, and a second press shuts it", () => {
    const call = "tool:one"
    expect(isUnfolded(call)).toBe(false)
    toggleFold(call)
    expect(isUnfolded(call)).toBe(true)
    toggleFold(call)
    expect(isUnfolded(call)).toBe(false)
  })

  test("one diff opening leaves every other diff shut", () => {
    // Both halves of the key earn their place here: the same call rewriting
    // two files, and the same file rewritten by two calls.
    const here = diffKey("tool:two", "docs/chat.md")
    toggleFold(here)
    expect(isUnfolded(here)).toBe(true)
    expect(isUnfolded(diffKey("tool:two", "docs/architecture.md"))).toBe(false)
    expect(isUnfolded(diffKey("tool:three", "docs/chat.md"))).toBe(false)
    // ... and it is not the call's own detail that opened.
    expect(isUnfolded("tool:two")).toBe(false)
    toggleFold(here)
  })
})
