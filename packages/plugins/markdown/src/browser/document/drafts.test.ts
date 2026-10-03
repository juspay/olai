import { expect, test } from "bun:test"
import { createRoot } from "solid-js"
import { createDocumentEditors } from "./drafts.ts"

test("drafts stay with their live pane and are abandoned on navigation or close", () => {
  const owned = createRoot(dispose => ({ ...createDocumentEditors(), dispose }))
  const first = owned.editor("a", "one.md")
  first.open()
  first.draft("base").setText("unsent")
  const other = owned.editor("b", "one.md")
  expect(other.editing()).toBe(false)
  owned.retain(new Map([["a", "one.md"], ["b", "one.md"]]))
  expect(owned.editor("a", "one.md")).toBe(first)
  expect(first.draft("changed baseline").text()).toBe("unsent")
  owned.retain(new Map([["a", "two.md"], ["b", "one.md"]]))
  expect(owned.editor("a", "one.md")).not.toBe(first)
  expect(owned.editor("b", "one.md")).toBe(other)
  owned.retain(new Map())
  expect(owned.editor("b", "one.md")).not.toBe(other)
  owned.dispose()
})
