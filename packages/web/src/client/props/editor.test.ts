/**
 * The editor's button: what it says, and whether pressing it would write
 * anything.
 *
 * `../date/pick.ts`'s test for `../date/pick.ts`'s button, one panel over.
 */

import { expect, test } from "bun:test"

import { pressOf } from "./editor.ts"

test("adding says so, and changing one says Save", () => {
  expect(pressOf(null, "pr", "https://x/1").label).toBe("Add property")
  expect(pressOf({ key: "pr", value: "https://x/1" }, "pr", "https://x/2").label).toBe("Save")
})

test("a key that is nothing but space is not a key", () => {
  // Dead rather than sent to be refused: the ops layer says "a property needs a
  // key" in exactly those words, and there is nothing here for it to say it
  // about.
  expect(pressOf(null, "", "value").writes).toBe(false)
  expect(pressOf(null, "   ", "value").writes).toBe(false)
  expect(pressOf(null, "pr", "").writes).toBe(true)
})

test("changing nothing writes nothing", () => {
  // The date picker's rule, and for the same reason: a write that asks for what
  // is already there is a commit nobody meant to make.
  expect(pressOf({ key: "pr", value: "https://x/1" }, "pr", "https://x/1").writes).toBe(false)
  // ...and emptying the box IS a change: it is how the drawer says "take this
  // off", which the ops layer reads as the removal `null` is.
  expect(pressOf({ key: "pr", value: "https://x/1" }, "pr", "").writes).toBe(true)
})
