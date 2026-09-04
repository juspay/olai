import { expect, test } from "bun:test"
import { Schema } from "effect"

import { fieldsOf, pageFields, resolve, secret, tryDecode } from "./settings.ts"

const Section = Schema.Struct({
  name: Schema.optionalKey(Schema.String),
  count: Schema.optionalKey(Schema.Number),
  on: Schema.optionalKey(Schema.Boolean),
  mode: Schema.optionalKey(Schema.Literals(["off", "on"])),
  token: Schema.optionalKey(secret(Schema.String)),
})

test("fieldsOf reads keys, kinds, choices and the secret annotation", () => {
  const fields = fieldsOf(Section as Schema.Schema<unknown>)
  const byKey = Object.fromEntries(fields.map((one) => [one.key, one]))
  expect(byKey["name"]?.kind).toBe("string")
  expect(byKey["count"]?.kind).toBe("number")
  expect(byKey["on"]?.kind).toBe("boolean")
  expect(byKey["mode"]?.kind).toBe("choice")
  expect(byKey["mode"]?.choices).toEqual(["off", "on"])
  expect(byKey["token"]?.secret).toBe(true)
  expect(byKey["name"]?.secret).toBe(false)
})

test("resolve is schema defaults, then row config, then the vault", () => {
  const fields = fieldsOf(Section as Schema.Schema<unknown>)
  const resolved = resolve(
    Section as Schema.Schema<unknown>,
    { name: "default", count: 1 },
    { name: "row" },
    { count: "3" },
    fields,
  )
  expect(resolved).toEqual({ name: "row", count: 3 })
})

test("a secret field never carries its value onto the page", () => {
  const fields = fieldsOf(Section as Schema.Schema<unknown>)
  const page = pageFields(
    fields,
    { name: "shown", token: "s3cret" },
    { name: "shown", token: "s3cret" },
    { token: "s3cret" },
    {},
    {},
    new Set(["token"]),
  )
  const token = page.find((one) => one.key === "token")
  expect(token?.secret).toBe(true)
  expect(token?.set).toBe(true)
  expect(token?.value).toBeUndefined()
  const name = page.find((one) => one.key === "name")
  expect(name?.value).toBe("shown")
})

test("a restart field whose stored value moved is pending", () => {
  const fields = fieldsOf(Section as Schema.Schema<unknown>)
  const page = pageFields(
    fields,
    { name: "new" },
    { name: "old" },
    { name: "new" },
    {},
    { name: "restart" },
    new Set(),
  )
  expect(page.find((one) => one.key === "name")?.pending).toBe(true)
})

test("tryDecode refuses a value the schema cannot judge", () => {
  expect(tryDecode(Section as Schema.Schema<unknown>, { count: "nope" })).toBeNull()
  expect(tryDecode(Section as Schema.Schema<unknown>, { count: 2 })?.count).toBe(2)
})
