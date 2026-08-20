import { expect, test } from "bun:test"

import { Schema } from "effect"

import { PageReading, Pending, Shelf } from "@olai/format"

import { ChatState } from "./chat.ts"
import { LOADED, Manifest, surface } from "./index.ts"

const tags = [...surface.group.requests.keys()].sort()

// Inherited from the scaffold, and worth keeping for the same reason: this
// fails unless the @kolu/surface sources hydrated from the Nix store resolve
// `effect` out of the root node_modules and assemble a real RPC group. A
// second copy of effect, a missing root dependency, or a stale kolu pin all
// land here rather than in the browser.
test("the surface claims our members alongside the framework's own", () => {
  expect(tags).toContain("surface/outlines/get")
  expect(tags).toContain("surface/errors/get")
  expect(tags).toContain("surface/manifest/get")
  // Reserved, and the reason this repo declares no identity member of its own:
  // the framework answers "which process is this" out of every surface, and the
  // stale-tab handshake on both ends reads THAT id.
  expect(tags).toContain("surface/system/identity")
  // surface mints these itself for liveness and identity — seeing them is how
  // we know the group came from the framework and not from our spec alone.
  expect(tags).toContain("surface/system/live")
})

// The browser may not write the error list, and a verb the server never serves
// would crash surface's boot walk rather than fail a call.
test("errors is read-only on the wire", () => {
  expect(surface.group.requests.has("surface/errors/set")).toBe(false)
})

// The batched stream is the whole reason `outlines` is a collection: one
// coalesced {upserts, removes} frame per probe tick, keyed by file path. Losing
// the verb would leave a collection served one key at a time, which is the
// stream design with more round trips.
test("outlines is served as batched deltas, and read-only", () => {
  expect(tags).toContain("surface/outlines/deltas")
  expect(tags).toContain("surface/outlines/keys")
  expect(surface.group.requests.has("surface/outlines/upsert")).toBe(false)
  expect(surface.group.requests.has("surface/outlines/delete")).toBe(false)
})

// A directory belongs to the disk, and so do the facts about it as a whole.
test("the manifest is read-only on the wire", () => {
  expect(surface.group.requests.has("surface/manifest/set")).toBe(false)
})

// The cell every subscription reads on its first frame says ONE thing: whether
// there is a set. It is the value that carried every `.md` body, so a field
// arriving on it is how the corpus would come back — and one that moves per
// revision would also wake every open tab's derivation for nothing.
test("the manifest carries nothing, and knows when it has not changed", () => {
  expect(LOADED).toEqual({})
  expect(Schema.is(Manifest)(LOADED)).toBe(true)
  expect(Schema.is(Manifest)(null)).toBe(true)
  expect(surface.spec.cells.manifest.equals?.(LOADED, {})).toBe(true)
  expect(surface.spec.cells.manifest.equals?.(LOADED, null)).toBe(false)
})

// snapshot-scale, as a test of the DECLARATION. `deltas` opens with a snapshot
// of every entry, and a documents entry is a `.md` body — so declaring it here
// would put the whole corpus back on the first frame of every subscription,
// which is the defect this collection was cut out of the manifest to fix.
// `keys` + `get` is the shape: paths for the sidebar, a body for whoever opens
// one.
test("documents are served keys-first, one body at a time, and read-only", () => {
  expect(tags).toContain("surface/documents/keys")
  expect(tags).toContain("surface/documents/get")
  expect(surface.group.requests.has("surface/documents/deltas")).toBe(false)
  expect(surface.group.requests.has("surface/documents/upsert")).toBe(false)
  expect(surface.group.requests.has("surface/documents/delete")).toBe(false)
})

// ── what identifies a row ──────────────────────────────────────────────

/**
 * WHICH ARRAYS A DECLARED `arrayKey` ACTUALLY KEYS — read off the member's own
 * schema, so a rename has to come to the declaration.
 *
 * The declaration and the field it names live in two places, and a rename of
 * one silently orphans the other: an `arrayKey` no element carries reads as "no
 * identity declared" at the merge, so every row of that member goes back to
 * being REPLACED per frame with nothing red anywhere — which is the audit's
 * 2.11, the finding this pin bump is about, quietly coming back.
 *
 * A PER-SITE GUARD, which is the pattern kolu ships beside its own declaration
 * (`packages/common/src/surface.test.ts`, "names a field the forward schema
 * actually carries") and the reason juspay/kolu#2190 ships no boot-time check:
 * a walk that ran at construction would have to survive every codec an app can
 * write — recursive, `suspend`ed, hand-built — and a FALSE boot crash on a
 * legitimate declaration is worse than the mis-declaration it catches. In a
 * test the walk is safe, because the schemas it walks are named one by one.
 *
 * It checks the harder half too, which kolu's docstrings state and no code
 * enforces: the field must be REQUIRED and NON-NULLABLE. `reconcile` decides
 * keyed-versus-positional for a whole array from its FIRST element's value, so
 * an optional key lets whichever row happens to be first decide for every other
 * row in that frame — which cannot corrupt anything and silently drops that
 * frame back to the undeclared behaviour, which is the whole thing the
 * declaration was for.
 */
type Keying = "keyed" | "positional" | "mixed"

/** Every array inside a schema, and whether `field` identifies its elements:
 *  `keyed` (every arm carries it, required and non-nullable), `positional`
 *  (no arm carries it — merged by index, which is silent on a repeated frame
 *  just the same), or `mixed`, which is the one nobody may ship. */
const keyings = (schema: unknown, field: string): ReadonlyMap<string, Keying> => {
  const found = new Map<string, Keying>()
  const seen = new Set<unknown>()

  /** What a `suspend` is standing in for. Its thunk hands back whatever the
   *  declaration wrote — a Schema (`@olai/format`'s `Row.children`, which is
   *  how a row's subtree is spelled) or the AST itself — so both are unwrapped
   *  here rather than one of them being assumed and the other silently reading
   *  as "an array of nothing". */
  const suspended = (ast: any): unknown => {
    const held = ast.thunk()
    return held !== null && typeof held === "object" && "ast" in held ? held.ast : held
  }

  /** Through a `suspend` and into a union's arms — the shapes an element can
   *  be spelled as before it is an object with fields. */
  const arms = (ast: any): ReadonlyArray<any> => {
    if (ast === null || typeof ast !== "object") return []
    if (ast._tag === "Suspend") return arms(suspended(ast))
    if (ast._tag === "Union") return ast.types.flatMap(arms)
    return [ast]
  }

  const carries = (arm: any): boolean => {
    if (arm._tag !== "Objects") return false
    const property = arm.propertySignatures.find((one: any) => one.name === field)
    if (property === undefined) return false
    // Required and non-nullable, both read off the property's own type: an
    // optional key is `context.isOptional`, and a nullable one is a union with
    // `Null` in it.
    if (property.type.context?.isOptional === true) return false
    return !arms(property.type).some((one: any) => one._tag === "Null")
  }

  const walk = (ast: any, path: string): void => {
    if (ast === null || typeof ast !== "object" || seen.has(ast)) return
    seen.add(ast)
    if (ast._tag === "Suspend") return walk(suspended(ast), path)
    if (ast._tag === "Union") {
      for (const one of ast.types) walk(one, path)
      return
    }
    if (ast._tag === "Arrays") {
      const elements = [...(ast.elements ?? []), ...(ast.rest ?? [])]
      const objects = elements.flatMap(arms).filter((one: any) => one._tag === "Objects")
      if (objects.length > 0) {
        const carrying = objects.filter(carries).length
        found.set(
          path,
          carrying === 0
            ? "positional"
            : carrying === objects.length
            ? "keyed"
            : "mixed",
        )
      }
      for (const one of elements) walk(one, `${path}[]`)
      return
    }
    if (ast._tag === "Objects") {
      for (const property of ast.propertySignatures) {
        walk(property.type, path === "" ? property.name : `${path}.${property.name}`)
      }
    }
  }

  walk((schema as { ast: unknown }).ast, "")
  return found
}

/** The claim every declaration below makes, whatever else it says: the key
 *  identifies some array, and there is no array it identifies HALF of. */
const declares = (
  schema: unknown,
  field: string | undefined,
): ReadonlyMap<string, Keying> => {
  expect(field).toBeString()
  const found = keyings(schema, field as string)
  expect([...found].filter(([, how]) => how === "mixed")).toEqual([])
  expect([...found].filter(([, how]) => how === "keyed").length).toBeGreaterThan(0)
  return found
}

test("the page stream is keyed by the field a Row carries, on every arm", () => {
  const found = declares(PageReading, surface.spec.streams.page.arrayKey)
  expect(surface.spec.streams.page.arrayKey).toBe("key")
  // The tree, and the tree under the tree: a row's `children` is the same
  // shape, so `<Key each={props.row.children} by="key">` is keyed too.
  expect(found.get("shows.rows")).toBe("keyed")
  expect(found.get("shows.rows[].children")).toBe("keyed")
  expect(found.get("shows.zoomed.children")).toBe("keyed")
  expect(found.get("shows.groups[].rows")).toBe("keyed")
  // ...and the lists that carry no `key` merge BY POSITION, which is what the
  // declaration's docstring says they do and what their `<Key by=…>` consumers
  // read them as. `names` is the one the audit's 2.10 is about.
  expect(found.get("names")).toBe("positional")
  expect(found.get("shows.backlinks")).toBe("positional")
  expect(found.get("shows.referrers")).toBe("positional")
})

test("the pins cell is keyed by the field a Pinned carries", () => {
  const found = declares(Shelf, surface.spec.cells.pins.arrayKey)
  expect(surface.spec.cells.pins.arrayKey).toBe("id")
  // The shelf IS the array — the member's whole value, so the root path.
  expect(found.get("")).toBe("keyed")
})

test("the pending cell is keyed by the one name its two row lists share", () => {
  const found = declares(Pending, surface.spec.cells.pending.arrayKey)
  expect(surface.spec.cells.pending.arrayKey).toBe("path")
  // BOTH lists, because one field per member has to key both or key neither —
  // and `@olai/format`'s `Other` already promises they spell it the same way.
  expect(found.get("outlines")).toBe("keyed")
  expect(found.get("others")).toBe("keyed")
  expect(found.get("changes")).toBe("positional")
  expect(found.get("wrote")).toBe("positional")
})

test("the chat cell is keyed by the field both of its lists carry", () => {
  const found = declares(ChatState, surface.spec.cells.chat.arrayKey)
  expect(surface.spec.cells.chat.arrayKey).toBe("name")
  expect(found.get("commands")).toBe("keyed")
  expect(found.get("missing")).toBe("keyed")
})

// The other side of the same pin: a member that declares nothing declares
// nothing ON PURPOSE — each says why where it is declared, and the three
// `deltas` collections share one reason (the batched delivery replaces each
// named leaf whole, so there is no merge there for a key to govern). A
// declaration arriving by accident is exactly as silent as one going missing.
//
// Read through a widening rather than off the literal's inferred type: a spec
// that does not spell the field has no such property to name, so the check has
// to be about the VALUE. It is the same widening `arrayKey` itself is — an
// optional field on the member spec.
const declaredOn = (member: object): string | undefined =>
  (member as { readonly arrayKey?: string }).arrayKey

test("no other member claims an array identity", () => {
  expect(declaredOn(surface.spec.cells.errors)).toBeUndefined()
  expect(declaredOn(surface.spec.cells.manifest)).toBeUndefined()
  expect(declaredOn(surface.spec.cells.git)).toBeUndefined()
  expect(declaredOn(surface.spec.streams.dated)).toBeUndefined()
  expect(declaredOn(surface.spec.streams.owed)).toBeUndefined()
  expect(declaredOn(surface.spec.streams.moving)).toBeUndefined()
  expect(declaredOn(surface.spec.collections.outlines)).toBeUndefined()
  expect(declaredOn(surface.spec.collections.heads)).toBeUndefined()
  expect(declaredOn(surface.spec.collections.documents)).toBeUndefined()
  expect(declaredOn(surface.spec.collections.transcript)).toBeUndefined()
})

// The walk itself, since three tests above rest on it reading a schema
// correctly — and a walk that found nothing would pass every one of them by
// saying nothing at all.
test("the walk can tell a keyed list from a positional one and from a mixed one", () => {
  const Keyed = Schema.Struct({ rows: Schema.Array(Schema.Struct({ key: Schema.String })) })
  const Positional = Schema.Struct({ rows: Schema.Array(Schema.Struct({ id: Schema.String })) })
  const Optional = Schema.Struct({
    rows: Schema.Array(Schema.Struct({ key: Schema.optionalKey(Schema.String) })),
  })
  const Nullable = Schema.Struct({
    rows: Schema.Array(Schema.Struct({ key: Schema.NullOr(Schema.String) })),
  })
  const Mixed = Schema.Struct({
    rows: Schema.Array(
      Schema.Union([Schema.Struct({ key: Schema.String }), Schema.Struct({ id: Schema.String })]),
    ),
  })
  expect(keyings(Keyed, "key").get("rows")).toBe("keyed")
  expect(keyings(Positional, "key").get("rows")).toBe("positional")
  // An OPTIONAL or NULLABLE key is not an identity: the merge reads the first
  // element's value to pick keyed-versus-positional for the whole array, so a
  // row that happens to be first and happens to be missing its key decides for
  // every other row in that frame.
  expect(keyings(Optional, "key").get("rows")).toBe("positional")
  expect(keyings(Nullable, "key").get("rows")).toBe("positional")
  expect(keyings(Mixed, "key").get("rows")).toBe("mixed")
})
