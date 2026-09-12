import { expect, test } from "bun:test"
import { advertisedFrom } from "./catalogue.ts"

test("catalogue walks the current roster, preserving ownership, absence and replacement", () => {
  let rows = [{ name: "notes", tools: [{ name: "read", title: "Read a note" }] }]
  const advertised = advertisedFrom(() => rows)
  expect(advertised("olai", "notes_read")).toEqual({ title: "Read a note", owner: "notes" })
  expect(advertised("foreign", "notes_read")).toBeNull()
  expect(advertised("olai", "missing")).toBeNull()
  rows = []
  expect(advertised("olai", "notes_read")).toBeNull()
  rows = [{ name: "notes", tools: [{ name: "read", title: "Read the replacement" }] }]
  expect(advertised("olai", "notes_read")?.title).toBe("Read the replacement")
})
