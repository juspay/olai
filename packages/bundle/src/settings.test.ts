/** Audit the real row modules, including rows disabled by the build. */
import { readFileSync } from "node:fs"
import * as path from "node:path"
import ts from "typescript"
import { PACKAGES, sourcesUnder } from "./tree.testlib.ts"
import { expect, test } from "bun:test"
import { Effect, Schema, SchemaAST } from "effect"
import { decodePolicy, policyControl } from "@olai/plugin-api/configuration"
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


test("the agent write reservation set is exactly enablement and definition approval", async () => {
  const { WRITE_RESERVATIONS } = await import("./policy.ts")
  expect(WRITE_RESERVATIONS.map(({ key, file }) => ({ key, file })).sort((a, b) => a.key.localeCompare(b.key))).toEqual([
    { key: "approved", file: undefined }, { key: "on", file: "settings.olai" },
  ])
})

test("every shipped declaration supplies a control for each leaf in schema order", async () => {
  let count = 0
  const kinds = new Set<string>()
  for (const row of ROWS) {
    if (row.browserOnly) continue
    const { default: plugin } = await import(row.name) as { default: Plugin }
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


/** This value-level fence lives with the schema audit: fence.test.ts must run
 * even when a plugin cannot load. Only production code is checked; fixtures may
 * name real settings to exercise the generic renderer. */
const declaredKeys = (ast: SchemaAST.AST, prefix = ""): string[] => ast._tag !== "Objects" ? [] :
  ast.propertySignatures.flatMap(field => {
    const key = String(field.name)
    return [key, prefix + key, ...declaredKeys(field.type, prefix + key + ".")]
  })

const spelledKeys = (source: string, keys: ReadonlySet<string>): string[] => {
  const file = ts.createSourceFile("panel.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const found = new Set<string>()
  const visit = (node: ts.Node): void => {
    // Package paths and type contracts are not configuration lookups.
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) || ts.isTypeNode(node)) return
    if (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) {
      // Array.push is generic collection construction, not a policy key.
      const collectionAppend = ts.isIdentifier(node) && node.text === "push" &&
        ts.isPropertyAccessExpression(node.parent) && node.parent.name === node &&
        ts.isCallExpression(node.parent.parent) && node.parent.parent.expression === node.parent
      if (!collectionAppend && keys.has(node.text)) found.add(node.text)
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return [...found].sort()
}

test("the inspector spells no shipped Config key in its production sources", async () => {
  const keys = new Set<string>()
  for (const row of ROWS) {
    if (row.browserOnly) continue
    const { default: plugin } = await import(row.name) as { default: Plugin }
    for (const key of declaredKeys(plugin.config?.ast ?? Schema.Never.ast)) keys.add(key)
  }
  expect(keys.size).toBeGreaterThan(10)
  const files = sourcesUnder(path.join(PACKAGES, "plugins/plugin-inspector/src"))
    .filter(file => /\.tsx?$/.test(file) && !/\.(test|browsertest|spec|testlib)\.tsx?$/.test(file))
  expect(files.length).toBeGreaterThan(5)
  expect(files.flatMap(file => spelledKeys(readFileSync(file, "utf8"), keys).map(key => ({ file, key })))).toEqual([])
})

test("the key fence catches literals, dotted keys, property reads and local identifiers", () => {
  const keys = new Set(declaredKeys(Schema.Struct({
    commit: Schema.String, watch: Schema.Struct({ "held-for": Schema.String }),
  }).ast))
  for (const source of [
    'reading.key === "commit"', 'reading.key === "held-for"', 'reading.key === "watch.held-for"',
    'reading.commit', 'const commit = () => {}', 'const view = <p>{"held-for"}</p>',
  ]) expect(spelledKeys(source, keys).length, source).toBeGreaterThan(0)
  expect(spelledKeys('// commit\nimport type { commit } from "commit"; rows.push(value)', new Set([...keys, "push"]))).toEqual([])
})
