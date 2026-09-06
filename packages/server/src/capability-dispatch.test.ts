/**
 * EVERY WRITE VARIANT IN THE BUNDLE HAS EXACTLY ONE OWNING ROW — every arm of
 * `WriteRequest` and every arm of `Edit`, claimed by exactly one plugin's
 * `dispatch` const.
 *
 * WHAT STOPPED BEING THIS TEST'S BUSINESS: disjointness used to be a statement
 * about a SHARED WIRE TAG. Nine rows registered `root: true`, so six of them
 * answered under one bare `surface/edit/apply` beside their own scoped tag, and
 * `./composition.ts` had to pick a single handler per incoming verb — two rows
 * claiming `add` was an ambiguous route on a real wire. The short names are
 * deleted; a row's members answer only under `surface/<row>/<member>/<verb>`,
 * and no two rows share a tag for anything to be ambiguous ON.
 *
 * WHAT STILL MATTERS, AND WHY THIS TEST IS THE ONLY THING HOLDING IT: the
 * browser routes an edit by VERB, not by tag. `@olai/edit-history`'s
 * `writing.ts` keeps one flat `Map<Edit["verb"], EditWriter>` that every row's
 * `browser.tsx` fills from `dispatch["edit.apply"].cases`. A verb no row claims
 * has no writer, so `writeEdit` fails at runtime with "the capability for X is
 * not active" — the schema would still accept the edit, and nothing before this
 * test would notice. A verb two rows claim makes the second `registerWriter`
 * throw at mount. Coverage and no-duplicates are therefore both live claims;
 * only the sentence explaining WHY has changed.
 *
 * THE PAIRS ARE KEYED BY MEMBER PATH NOW (`ops.run`, `edit.apply`) rather than
 * by wire tag, because that is how the consts are keyed: see any of the six
 * `surface.ts` files for why the key stopped being a tag.
 *
 * AND AN ENTRY IS A BARE LIST NOW. It used to be `{ field, cases }`, and this
 * test asserted the `field` — because `./composition.ts`'s envelope read it off
 * the payload to pick an owner, and `packages/plugins/mcp/src/catalog.ts` gated
 * a tool on it matching, so a row declaring the wrong word silently hid its own
 * tools. Both of those readers are deleted, and the discriminator is implied by
 * the member anyway. What replaced the assertion is the table below: it names
 * the field ONCE, per member, and the coverage check is against THAT union — so
 * a row listing `WriteRequest.op`s under `edit.apply` fails as a verb the union
 * does not have, which is the same defect caught one step later and with no
 * second copy of the word anywhere.
 */
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

// Reading BundleModules imports the complete catalog, including process-backed
// providers. Its cold load shares the fleet with the browser shards.
test("every canonical operation and edit intent has one declared capability owner", () => Effect.runPromise(Effect.scoped(Effect.gen(function*() {
  const plugins = yield* openPlugins({ vars: {}, now: () => "2026-09-05T00:00:00Z" })
  yield* mountBundle(plugins.host, { kind: "exact", names: [] }, [])
  const modules = yield* offered(plugins.host, BundleModules)!.read
  // `member` is a path into the row's own surface, not a wire tag — the header
  // says why. A row that owns neither member declares no entry and is skipped.
  for (const [member, field, schema] of [
    ["ops.run", "op", WriteRequest], ["edit.apply", "verb", Edit],
  ] as const) {
    const declarations = modules.flatMap(module =>
      (module.exports as { dispatch?: Record<string, readonly string[]> }).dispatch?.[member] ?? [])
    // COVERAGE: every arm of the schema is claimed by somebody, so no verb
    // reaches `writeEdit` unrouted.
    expect(declarations.toSorted()).toEqual(variants(schema.ast, field).toSorted())
    // NO DUPLICATES: nobody claims an arm twice, so `registerWriter` never
    // throws on a second owner for one verb.
    expect(new Set(declarations).size).toBe(declarations.length)
  }
}))), 30_000)
