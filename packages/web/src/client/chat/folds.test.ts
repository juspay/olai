/**
 * What the reader has opened, as state.
 *
 * No DOM: it is a set of keys and two functions over it, which is the whole
 * reason the fold lives outside the row it belongs to. The claim worth holding
 * is the one the KEY makes — a call can rewrite several files, one file is
 * edited again in a later turn, and ONE CALL REPORTS SEVERAL BLOCKS ABOUT ONE
 * FILE — so opening one block must never open another.
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

  test("one block opening leaves every other block shut", () => {
    // All three parts of the key earn their place here: the same call rewriting
    // two files, the same file rewritten by two calls, and — the part this key
    // grew for — the same call reporting the same file TWICE, which is what an
    // `Edit` that landed in two places arrives as.
    const here = diffKey("tool:two", 0, "docs/chat.md")
    toggleFold(here)
    expect(isUnfolded(here)).toBe(true)
    expect(isUnfolded(diffKey("tool:two", 0, "docs/architecture.md"))).toBe(false)
    expect(isUnfolded(diffKey("tool:three", 0, "docs/chat.md"))).toBe(false)
    expect(isUnfolded(diffKey("tool:two", 1, "docs/chat.md"))).toBe(false)
    // ... and it is not the call's own detail that opened.
    expect(isUnfolded("tool:two")).toBe(false)
    toggleFold(here)
  })

  test("a block's name is its own, whatever the parts hold", () => {
    // The separator is what makes that true, and it is the reason it is a
    // character no part can contain: a call id and a path that could each
    // absorb the other's boundary would let two different blocks mint one
    // name — the collapse this whole key exists to refuse.
    expect(diffKey("a", 1, "b")).not.toBe(diffKey("a", 11, "b"))
    expect(diffKey("a", 1, "0b")).not.toBe(diffKey("a", 10, "b"))
  })
})
