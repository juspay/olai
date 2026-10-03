import { expect, test } from "bun:test"
import { createMemo, createRoot } from "solid-js"
import { createDrafts } from "./drafts.ts"

test("typing and clearing a question wakes only its changed fields", () => {
  createRoot(dispose => {
    try {
      const drafts = createDrafts()
      const reads = [0, 0, 0]
      const fields = [["first", "name"], ["first", "choice"], ["second", "name"]] as const
      const values = fields.map(([ask, field], i) => createMemo(() => {
        reads[i]!++
        return drafts.draftOf(ask, field).join(",")
      }))
      drafts.setDraft("first", "name", ["one"])
      expect(values.map(read => read())).toEqual(["one", "", ""])
      expect(reads).toEqual([2, 1, 1])
      drafts.setDraft("second", "name", ["two"])
      expect(reads).toEqual([2, 1, 2])
      drafts.forgetDraft("first")
      expect(values.map(read => read())).toEqual(["", "", "two"])
      expect(reads).toEqual([3, 1, 2])
      expect(drafts.empty()).toBe(false)
      drafts.forgetDraft("second")
      expect(drafts.empty()).toBe(true)
    } finally { dispose() }
  })
})
