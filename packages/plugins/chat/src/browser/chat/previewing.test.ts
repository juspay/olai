import { expect, test } from "bun:test"

import { createPreviewing } from "./previewing.ts"
const { closePreview, isPreviewing, previewing, togglePreview } = createPreviewing()

test("nothing is open until a door is pressed", () => {
  closePreview()
  expect(previewing()).toBeNull()
  expect(isPreviewing("tool:agent-1")).toBe(false)
})

test("one at a time — opening an agent puts the last one away", () => {
  closePreview()
  togglePreview("tool:agent-1")
  expect(previewing()).toBe("tool:agent-1")
  togglePreview("tool:agent-2")
  expect(previewing()).toBe("tool:agent-2")
  expect(isPreviewing("tool:agent-1")).toBe(false)
})

test("the door is the same control both ways round", () => {
  closePreview()
  togglePreview("tool:agent-1")
  togglePreview("tool:agent-1")
  expect(previewing()).toBeNull()
})

test("and it can be closed by something that is not a door", () => {
  closePreview()
  togglePreview("tool:agent-1")
  closePreview()
  expect(previewing()).toBeNull()
})
