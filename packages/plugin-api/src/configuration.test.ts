import { createRequire } from "node:module"
import { expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import type { Plugin } from "./index.ts"
import { coerceLeaf, decodePolicy, policyControl } from "./configuration.ts"

test("every shipped declaration supplies a control for each leaf in schema order", async () => {
  const registry = "@olai/bundle"
  const { ROWS } = await import(registry) as { ROWS: ReadonlyArray<{ name: string; browserOnly?: boolean }> }
  let count = 0
  const kinds = new Set<string>()
  for (const row of ROWS) {
    if (row.browserOnly) continue
    const { default: plugin } = await import(createRequire(import.meta.resolve("@olai/bundle")).resolve(row.name)) as { default: Plugin }
    if (plugin.config === undefined) continue
    const walk = (schema: Schema.ConstraintDecoder<unknown, never>, prefix = ""): string[] => {
      if (schema.ast._tag !== "Objects") throw new Error("expected a declaration")
      return schema.ast.propertySignatures.flatMap(field => {
        const key = prefix + String(field.name)
        if (field.type._tag === "Objects") return walk(Schema.make(field.type) as Schema.ConstraintDecoder<unknown, never>, key + ".")
        const control = policyControl(field.type)
        kinds.add(control.kind)
        if (field.type._tag === "Union" && field.type.types.every(one => one._tag === "Literal")) {
          expect(control).toEqual({ kind: "choice", options: field.type.types.map(one => one._tag === "Literal" ? String(one.literal) : "") })
        }
        const checks = field.type.checks ?? []
        const expected = checks.flatMap(check => typeof check.annotations?.expected === "string" ? [check.annotations.expected] : [])
        if (control.kind === "text" && expected.length) expect(control.expected).toBe(expected.join("; "))
        count++
        return [key]
      })
    }
    const keys = walk(plugin.config)
    const values = decodePolicy(plugin.config, [], undefined, () => {}).values
    expect(values.map(one => one.key)).toEqual(keys)
    for (const value of values) expect(value.control.kind).toBeDefined()
  }
  expect(count).toBeGreaterThan(10)
  expect([...kinds].sort()).toEqual(["choice", "number", "text"])
})

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
