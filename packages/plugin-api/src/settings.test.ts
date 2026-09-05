import { expect, test } from "bun:test"
import { Schema } from "effect"

import { fieldsOf, pageFields, resolve, secretKeysOf, tryDecode } from "./settings.ts"

const Section = Schema.Struct({
  name: Schema.optionalKey(Schema.String),
  count: Schema.optionalKey(Schema.Number),
  on: Schema.optionalKey(Schema.Boolean),
  mode: Schema.optionalKey(Schema.Literals(["off", "on"])),
})

test("fieldsOf reads keys, kinds and choices", () => {
  const fields = fieldsOf(Section as Schema.Schema<unknown>)
  const byKey = Object.fromEntries(fields.map((one) => [one.key, one]))
  expect(byKey["name"]?.kind).toBe("string")
  expect(byKey["count"]?.kind).toBe("number")
  expect(byKey["on"]?.kind).toBe("boolean")
  expect(byKey["mode"]?.kind).toBe("choice")
  expect(byKey["mode"]?.choices).toEqual(["off", "on"])
})

test("a secret annotation is named so register can refuse it", () => {
  const Marked = Schema.Struct({
    name: Schema.optionalKey(Schema.String),
    token: Schema.optionalKey(Schema.String.annotate({ secret: true })),
  })
  expect(secretKeysOf(Marked as Schema.Schema<unknown>)).toEqual(["token"])
  expect(secretKeysOf(Section as Schema.Schema<unknown>)).toEqual([])
})

test("resolve is schema defaults, then the vault", () => {
  const fields = fieldsOf(Section as Schema.Schema<unknown>)
  const judged = resolve(
    Section as Schema.Schema<unknown>,
    { name: "default", count: 1 },
    { count: "3" },
    fields,
  )
  expect(judged.value).toEqual({ name: "default", count: 3 })
  expect(judged.faults).toEqual({})
})

test("a validate refusal is the same drop as an undecodable value", () => {
  const fields = fieldsOf(Section as Schema.Schema<unknown>)
  const judged = resolve(
    Section as Schema.Schema<unknown>,
    { name: "default" },
    { name: "nope" },
    fields,
    (value) => value.name === "nope" ? "bad name" : null,
  )
  expect(judged.value).toEqual({ name: "default" })
  expect(judged.faults["name"]).toContain("`name`")
})

test("an undecodable vault value is dropped and named, and the rest stand", () => {
  const fields = fieldsOf(Section as Schema.Schema<unknown>)
  const judged = resolve(
    Section as Schema.Schema<unknown>,
    { name: "default", count: 1 },
    { count: "nope", name: "ok" },
    fields,
  )
  expect(judged.value).toEqual({ name: "ok", count: 1 })
  expect(judged.faults["count"]).toContain("`count`")
  expect(judged.faults["name"]).toBeUndefined()
})

test("a restart field whose stored value moved is pending", () => {
  const fields = fieldsOf(Section as Schema.Schema<unknown>)
  const page = pageFields(
    fields,
    { name: "new" },
    { name: "old" },
    { name: "restart" },
  )
  expect(page.find((one) => one.key === "name")?.pending).toBe(true)
})

test("a vault value the schema cannot judge is a fault on that field", () => {
  const fields = fieldsOf(Section as Schema.Schema<unknown>)
  const judged = resolve(
    Section as Schema.Schema<unknown>,
    { count: 1 },
    { count: "nope" },
    fields,
  )
  const page = pageFields(
    fields,
    judged.value,
    judged.value,
    {},
    judged.faults,
  )
  const count = page.find((one) => one.key === "count")
  expect(count?.value).toBe(1)
  expect(count?.fault).toContain("`count`")
})

test("tryDecode refuses a value the schema cannot judge", () => {
  expect(tryDecode(Section as Schema.Schema<unknown>, { count: "nope" })).toBeNull()
  expect(tryDecode(Section as Schema.Schema<unknown>, { count: 2 })?.count).toBe(2)
})
