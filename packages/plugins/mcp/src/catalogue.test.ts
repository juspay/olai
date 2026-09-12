import { expect, test } from "bun:test"
import { advertisedFrom } from "./catalogue.ts"

test("catalogue walks the current roster, preserving ownership, absence and replacement", () => {
  let rows = [{ name: "notes", tools: [{ name: "read", title: "Read a note" }] }]
  const advertised = advertisedFrom("olai", () => rows)
  expect(advertised("olai", "notes_read")).toEqual({ title: "Read a note", owner: "notes" })
  expect(advertised("foreign", "notes_read")).toBeNull()
  expect(advertised("olai", "missing")).toBeNull()
  rows = []
  expect(advertised("olai", "notes_read")).toBeNull()
  rows = [{ name: "notes", tools: [{ name: "read", title: "Read the replacement" }] }]
  expect(advertised("olai", "notes_read")?.title).toBe("Read the replacement")
})

test("the composition supplies server identity independently of the endpoint", () => {
  const advertised = advertisedFrom("configured", () => [{ name: "notes", tools: [{ name: "read", title: "Read" }] }])
  expect(advertised("configured", "notes_read")).toEqual({ title: "Read", owner: "notes" })
  expect(advertised("olai", "notes_read")).toBeNull()
})
