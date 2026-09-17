import { expect, test } from "bun:test"
import { createRoot } from "solid-js"
import { createFolding, holdFolding, unfold, unfolded, fold } from "./folding.ts"

test("folds are independent and a rebuilt activation starts closed", () => {
  createRoot(dispose => {
    const release = holdFolding(createFolding())
    unfold("one")
    unfold("two")
    fold("one")
    expect(unfolded("one")).toBe(false)
    expect(unfolded("two")).toBe(true)
    const replacement = holdFolding(createFolding())
    expect(unfolded("two")).toBe(false)
    unfold("replacement")
    release()
    expect(unfolded("replacement")).toBe(true)
    replacement()
    expect(unfolded("replacement")).toBe(false)
    dispose()
  })
})
