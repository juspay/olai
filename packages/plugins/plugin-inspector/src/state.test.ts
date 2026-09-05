import { expect, test } from "bun:test"
import { createInspectorState } from "./state.ts"

test("inspector history survives presentation replacement but ends with its activation", () => {
  const state = createInspectorState()
  state.door.setOpen(true)
  state.nowRead("extension", "first")
  // A door closing or moving is presentation, not a new authorization reading.
  state.door.setOpen(false)
  state.door.setOpen(true)
  expect(state.read().get("extension")).toBe("first")
  state.close()
  expect(state.door.open()).toBe(false)
  expect(state.read().size).toBe(0)
  expect(() => state.nowRead("extension", "unseen")).toThrow("closed")
  const next = createInspectorState()
  expect(next.read().size).toBe(0)
  expect(next.door.open()).toBe(false)
  next.nowRead("extension", "second")
  expect(next.read().get("extension")).toBe("second")
  expect(state.read().size).toBe(0)
  next.close()
})
