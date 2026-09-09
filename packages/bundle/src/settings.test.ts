/** Audit the real row modules, including rows disabled by the build. */
import { expect, test } from "bun:test"
import { Effect, Schema, SchemaAST } from "effect"
import type { Plugin } from "@olai/plugin-api"
import { ROWS } from "./rows.ts"

const audit = (schema: Schema.ConstraintDecoder<unknown, never>, path: string): number => {
  const defaults = Schema.decodeUnknownSync(schema)({}) as Record<string, unknown>
  expect(schema.ast._tag, path).toBe("Objects")
  if (schema.ast._tag !== "Objects") throw new Error(`${path} must declare a struct`)
  let count = 0
  for (const field of schema.ast.propertySignatures) {
    const key = String(field.name)
    expect(Object.hasOwn(defaults, key), `${path}.${key} needs a default`).toBe(true)
    expect(defaults[key], `${path}.${key} default cannot be undefined`).not.toBeUndefined()
    expect(SchemaAST.resolveDescription(field.type)?.trim().length ?? 0, `${path}.${key} needs a description`).toBeGreaterThan(0)
    // The enclosing schema requires no services; its fields inherit that contract.
    const one = Schema.make(field.type) as Schema.ConstraintDecoder<unknown, never>
    if (field.type._tag === "Objects") count += audit(one, `${path}.${key}`)
    else expect(Schema.decodeUnknownSync(one)(String(defaults[key])), `${path}.${key} must decode a vault property`).toEqual(defaults[key])
    count++
  }
  return count
}

test("every Config field declares a usable default and description", async () => {
  const seen: string[] = []
  let fields = 0
  for (const row of ROWS) {
    // A browser-only row has no server configuration declaration.
    if (row.browserOnly) continue
    const module = await import(row.name) as { default: Plugin; Config?: Plugin["config"] }
    expect(module.default.config, row.id).toBe(module.Config)
    if (module.default.config === undefined) continue
    seen.push(row.id)
    fields += audit(module.default.config, row.id)
  }
  expect(seen.length).toBeGreaterThanOrEqual(6)
  expect(fields).toBeGreaterThan(seen.length)
})

test("the audit refuses an optional field without a default and missing prose", () => {
  expect(() => audit(Schema.Struct({ bare: Schema.optionalKey(Schema.String) }), "fixture")).toThrow()
  expect(() => audit(Schema.Struct({ bare: Schema.String.pipe(
    Schema.withDecodingDefaultKey(Effect.succeed("default")),
  ) }), "fixture")).toThrow()
})

test("the audit refuses numeric and nullable fields without a string spelling", () => {
  for (const field of [Schema.Int.pipe(Schema.withDecodingDefaultKey(Effect.succeed(1))), Schema.NullOr(Schema.String).pipe(Schema.withDecodingDefaultKey(Effect.succeed(null)))]) {
    expect(() => audit(Schema.Struct({ value: field.pipe(Schema.annotate({ description: "fixture" })) }), "fixture")).toThrow()
  }
})
