import { expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import { coerceLeaf, policyControl } from "./configuration.ts"

test("boolean and numeric spellings share the decoder; bounds and filters describe controls", () => {
  expect(policyControl(Schema.Boolean.ast)).toEqual({ kind: "switch" })
  expect(coerceLeaf(Schema.Boolean, "yes")).toBe(true)
  expect(coerceLeaf(Schema.Boolean, "no")).toBe(false)
  expect(() => coerceLeaf(Schema.Boolean, "perhaps")).toThrow()
  const number = Schema.Union([Schema.Int, Schema.NumberFromString.check(Schema.isInt())]).check(Schema.isBetween({ minimum: 1, maximum: 10 }))
  expect(policyControl(number.ast)).toEqual({ kind: "number", integer: true, min: 1, max: 10 })
  expect(coerceLeaf(number, "2")).toBe(2)
  expect(coerceLeaf(Schema.NumberFromString, "2.5")).toBe(2.5)
  for (const bad of ["", "0", "11", "1.5", "many"]) expect(() => coerceLeaf(number, bad)).toThrow()
  expect(policyControl(Schema.Number.ast)).toEqual({ kind: "number", integer: false })
  const text = Schema.String.check(Schema.makeFilter(value => value.endsWith("s"), { expected: "seconds with a unit" })).pipe(Schema.withDecodingDefaultKey(Effect.succeed("60s")))
  expect(policyControl(text.ast)).toEqual({ kind: "text", expected: "seconds with a unit" })
  expect(() => coerceLeaf(text, "60")).toThrow("seconds with a unit")
  expect(policyControl(Schema.Array(Schema.String).ast)).toEqual({ kind: "text" })
})
