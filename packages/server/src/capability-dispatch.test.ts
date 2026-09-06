/** The bundle must assign every legacy write variant exactly once. */
import { expect, test } from "bun:test"
import { Effect, SchemaAST } from "effect"
import { WriteRequest } from "@olai/format"
import { Edit } from "@olai/surface"
import { BundleModules, openPlugins } from "@olai/plugin-api/services"
import { mountBundle, offered } from "@olai/bundle/bundle"

const arms = (ast: SchemaAST.AST): readonly SchemaAST.AST[] =>
  SchemaAST.isUnion(ast) ? ast.types.flatMap(arms) : SchemaAST.isSuspend(ast) ? arms(ast.thunk()) : [ast]
const variants = (ast: SchemaAST.AST, field: string) => arms(ast).flatMap(arm => {
  if (!SchemaAST.isObjects(arm)) throw new Error("Expected request object")
  const property = arm.propertySignatures.find(one => one.name === field)
  if (!property) throw new Error(`Missing ${field}`)
  return arms(property.type).map(value => {
    if (!SchemaAST.isLiteral(value) || typeof value.literal !== "string") throw new Error(`Nonliteral ${field}`)
    return value.literal
  })
})

test("every canonical operation and edit intent has one declared capability owner", () => Effect.runPromise(Effect.scoped(Effect.gen(function*() {
  const plugins = yield* openPlugins({ vars: {}, now: () => "2026-09-05T00:00:00Z" })
  yield* mountBundle(plugins.host, { kind: "exact", names: [] }, [])
  const modules = yield* offered(plugins.host, BundleModules)!.read
  for (const [tag, field, schema] of [
    ["surface/ops/run", "op", WriteRequest], ["surface/edit/apply", "verb", Edit],
  ] as const) {
    const declarations = modules.flatMap(module => {
      const dispatch = (module.exports as { dispatch?: Record<string, {field: string; cases: readonly string[]}> }).dispatch?.[tag]
      if (!dispatch) return []
      expect(dispatch.field).toBe(field)
      return dispatch.cases
    })
    expect(declarations.toSorted()).toEqual(variants(schema.ast, field).toSorted())
    expect(new Set(declarations).size).toBe(declarations.length)
  }
}))))
