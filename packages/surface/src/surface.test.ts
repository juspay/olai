import { expect, test } from "bun:test"

import { Schema, SchemaAST } from "effect"

import { type GitState, LOADED, Manifest, surface } from "./index.ts"

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

// The OTHER half of the one survey the header's git indicator draws.
//
// `pending` declares an `equals` so the server's thirty-second sweep does not
// frame every open tab with what it already knew. This cell is recomputed by
// the SAME statement on the SAME two clocks (`server/runtime.ts`'s
// `republishGit` sets both), and a derivation is a fresh object every time — so
// without one of its own it framed every tab twice a minute saying `repo`,
// which is what restarted Auto-commit's quiet window on a frame nobody typed.
test("what git is doing knows when it has not changed", () => {
  const healthy: GitState = { status: "repo", said: null }
  expect(surface.spec.cells.git.equals?.(healthy, { status: "repo", said: null }))
    .toBe(true)
  // ... and the two states it must still tell apart: the fault, and the words
  // on it, which are the whole of what #108 fought for.
  expect(surface.spec.cells.git.equals?.(healthy, { status: "error", said: null }))
    .toBe(false)
  expect(
    surface.spec.cells.git.equals?.(
      { status: "error", said: "no user.email" },
      { status: "error", said: "gpg failed" },
    ),
  ).toBe(false)
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
 *  just the same), or `mixed`, which is the one nobody may ship.
 *
 *  Over `SchemaAST`, which `effect` exports with the union and the narrowing
 *  guards already on it — there is nothing here to hand-roll but the question. */
const keyings = (
  schema: { readonly ast: SchemaAST.AST },
  field: string,
): ReadonlyMap<string, Keying> => {
  const found = new Map<string, Keying>()
  const seen = new Set<SchemaAST.AST>()

  /** Through a `suspend` and into a union's arms — the shapes an element can be
   *  spelled as before it is an object with fields. */
  const arms = (ast: SchemaAST.AST): ReadonlyArray<SchemaAST.AST> =>
    SchemaAST.isSuspend(ast)
      ? arms(ast.thunk())
      : SchemaAST.isUnion(ast)
      ? ast.types.flatMap(arms)
      : [ast]

  const carries = (arm: SchemaAST.AST): boolean => {
    if (!SchemaAST.isObjects(arm)) return false
    const property = arm.propertySignatures.find((one) => one.name === field)
    if (property === undefined) return false
    // Required and non-nullable, both asked of the property's own type through
    // the module that owns the answer: optionality moved off the node between
    // effect 3 and 4, and reading `context.isOptional` by hand is a guard that
    // would quietly start saying "not optional" the next time it moves.
    if (SchemaAST.isOptional(property.type)) return false
    return !arms(property.type).some(SchemaAST.isNull)
  }

  const walk = (ast: SchemaAST.AST, path: string): void => {
    // A row's `children` is the same array wherever it is reached from, and it
    // holds rows, so the walk would not otherwise end.
    if (seen.has(ast)) return
    seen.add(ast)
    if (SchemaAST.isSuspend(ast)) return walk(ast.thunk(), path)
    if (SchemaAST.isUnion(ast)) {
      for (const one of ast.types) walk(one, path)
      return
    }
    if (SchemaAST.isArrays(ast)) {
      const elements = [...ast.elements, ...ast.rest]
      const objects = elements.flatMap(arms).filter(SchemaAST.isObjects)
      if (objects.length > 0) {
        const carrying = objects.filter(carries).length
        found.set(
          path,
          carrying === 0 ? "positional" : carrying === objects.length ? "keyed" : "mixed",
        )
      }
      for (const one of elements) walk(one, `${path}[]`)
      return
    }
    if (SchemaAST.isObjects(ast)) {
      for (const property of ast.propertySignatures) {
        const name = String(property.name)
        walk(property.type, path === "" ? name : `${path}.${name}`)
      }
    }
  }

  walk(schema.ast, "")
  return found
}

/**
 * EVERY MEMBER, and the schema whose arrays its key would govern — read off the
 * spec rather than written down beside it.
 *
 * The docstring above says the hazard is "a declaration and the field it names
 * live in two places". A guard that imported four schemas by hand and named four
 * members by hand would be a third place, with the same failure: point `pins` at
 * a different schema and the check goes on passing against the old one, and add
 * a member tomorrow with a key its value does not carry and nothing is red.
 *
 * `arrayKey` is read through a widening because the spec is a LITERAL: a member
 * that does not spell the field has no such property to name, so the question
 * has to be asked of the value.
 */
const MEMBERS: ReadonlyArray<{
  readonly name: string
  readonly arrayKey: string | undefined
  /** The schema of what one frame of this member CARRIES — a collection's is one
   *  entry's, which is the value its per-key delivery merges. */
  readonly value: { readonly ast: SchemaAST.AST }
}> = [
  ...Object.entries(surface.spec.cells).map(([name, spec]) => ({
    name: `cells.${name}`,
    arrayKey: (spec as { readonly arrayKey?: string }).arrayKey,
    value: spec.schema as unknown as { readonly ast: SchemaAST.AST },
  })),
  ...Object.entries(surface.spec.collections).map(([name, spec]) => ({
    name: `collections.${name}`,
    arrayKey: (spec as { readonly arrayKey?: string }).arrayKey,
    value: spec.schema as unknown as { readonly ast: SchemaAST.AST },
  })),
  ...Object.entries(surface.spec.streams).map(([name, spec]) => ({
    name: `streams.${name}`,
    arrayKey: (spec as { readonly arrayKey?: string }).arrayKey,
    value: spec.outputSchema as unknown as { readonly ast: SchemaAST.AST },
  })),
]

/** The arrays one declaring member's key identifies — its OWN schema and its OWN
 *  field, so a case below cannot end up checking a schema the member no longer
 *  carries. */
const keyingsOf = (name: string): ReadonlyMap<string, Keying> => {
  const member = MEMBERS.find((one) => one.name === name)
  if (member === undefined) throw new Error(`the surface declares no member ${name}`)
  if (member.arrayKey === undefined) throw new Error(`${name} declares no arrayKey`)
  return keyings(member.value, member.arrayKey)
}

test("every declaration names a field its own schema carries, and no other member declares", () => {
  const declaring = MEMBERS.filter((one) => one.arrayKey !== undefined)
  // THE WHOLE LIST, asserted as a list: this is what says the four below are
  // every one there is, so a fifth member arriving with a declaration cannot
  // slip past a suite that only knows four names. The members that declare
  // NOTHING declare nothing on purpose and each says why where it is declared —
  // `errors` has no field that identifies a row, and `outlines`, `heads` and
  // `transcript` are read through the batched `deltas` delivery, which replaces
  // each named leaf whole rather than merging, so there is no merge for a key to
  // govern. `documents` is served per key and would honour one, but a document
  // entry is a revision and a body; `manifest`, `git`, `dated`, `owed` and
  // `moving` carry no array of objects at all.
  expect(declaring.map((one) => `${one.name} → ${one.arrayKey}`).sort()).toEqual([
    "cells.chat → name",
    "cells.pending → path",
    "cells.pins → id",
    "streams.page → key",
  ])
  for (const one of declaring) {
    const found = keyings(one.value, one.arrayKey as string)
    // The key identifies SOMETHING — a declaration the schema does not carry
    // reads as no declaration at all at the merge, silently...
    expect([one.name, [...found].filter(([, how]) => how === "keyed").length > 0])
      .toEqual([one.name, true])
    // ...and there is no array it identifies HALF of, which is the shape the
    // merge decides for a whole array from its first element's value.
    expect([one.name, [...found].filter(([, how]) => how === "mixed")])
      .toEqual([one.name, []])
  }
})

test("the page stream is keyed by the field a Row carries, on every arm", () => {
  expect(surface.spec.streams.page.arrayKey).toBe("key")
  const found = keyingsOf("streams.page")
  // The tree, and the tree under the tree: a row's `children` is the same
  // shape, so `<Key each={props.row.children} by="key">` is keyed too.
  expect(found.get("shows.rows")).toBe("keyed")
  expect(found.get("shows.rows[].children")).toBe("keyed")
  expect(found.get("shows.zoomed.children")).toBe("keyed")
  expect(found.get("shows.groups[].rows")).toBe("keyed")
  // ...and the lists that carry no `key` merge BY POSITION, which is what the
  // declaration's docstring says they do and what their `<Key by=…>` consumers
  // read them as. `names` is the one the audit's 2.10 is about.
  //
  // EVERY ONE OF THEM IS NAMED, and the two that are easy to leave out are the
  // reason: the crumb trail and a day's entries are `Situated` and `DayEntry`,
  // which carry no `key` TODAY. A field of that name added to either would
  // silently start keying them — the merge reads values, and a positional list
  // quietly becoming a keyed one is exactly the kind of change nothing else
  // here would notice. So the claim is the whole partition rather than the
  // interesting half of it.
  expect(found.get("names")).toBe("positional")
  expect(found.get("shows.backlinks")).toBe("positional")
  expect(found.get("shows.referrers")).toBe("positional")
  expect(found.get("shows.zoomed.trail")).toBe("positional")
  expect(found.get("shows.groups[].nodes")).toBe("positional")
  // The partition itself: every array this reading carries is one or the other,
  // and the four keyed ones are the four named above. A new array arriving in a
  // page reading lands in this list rather than nowhere.
  expect([...found].filter(([, how]) => how === "keyed").map(([at]) => at).sort())
    .toEqual([
      "shows.groups[].rows",
      "shows.rows",
      "shows.rows[].children",
      "shows.zoomed.children",
    ])
})

test("the pins cell is keyed by the field a Pinned carries", () => {
  expect(surface.spec.cells.pins.arrayKey).toBe("id")
  // The shelf IS the array — the member's whole value, so the root path.
  expect(keyingsOf("cells.pins").get("")).toBe("keyed")
})

test("the pending cell is keyed by the one name its two row lists share", () => {
  expect(surface.spec.cells.pending.arrayKey).toBe("path")
  const found = keyingsOf("cells.pending")
  // BOTH lists, because one field per member has to key both or key neither —
  // and `@olai/format`'s `Other` already promises they spell it the same way.
  expect(found.get("outlines")).toBe("keyed")
  expect(found.get("others")).toBe("keyed")
  expect(found.get("changes")).toBe("positional")
  expect(found.get("wrote")).toBe("positional")
  // `file` is the near-miss, and it is not a taste: it keys `outlines` too, and
  // it REPEATS inside `changes` — several node changes per file, since
  // `changesOf` matches by id across files — which is a key that decides
  // identity by collision, exactly as `file` would on `errors`.
  const pending = MEMBERS.find((one) => one.name === "cells.pending")!
  expect(keyings(pending.value, "file").get("changes")).toBe("keyed")
})

test("the chat cell is keyed by the field both of its lists carry", () => {
  expect(surface.spec.cells.chat.arrayKey).toBe("name")
  const found = keyingsOf("cells.chat")
  expect(found.get("commands")).toBe("keyed")
  expect(found.get("missing")).toBe("keyed")
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
