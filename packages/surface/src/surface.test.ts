import { expect, test } from "bun:test"

import { Schema, SchemaAST } from "effect"

import { keyings, type Keying } from "./keyings.testlib.ts"

import {
  ASSET_PREFIX,
  DocumentEntry,
  LOADED,
  Manifest,
  NO_ROSTER,
  PluginRoster,
  surface,
  WHO_PATH,
} from "./index.ts"

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
  // Reserved, and the reason this repo declares no process-identity member of
  // its own: the framework answers "which process is this" out of every
  // surface, and the stale-tab handshake on both ends reads THAT id. Who is
  // LOOKING is a different question — per connection, so a procedure, not a
  // cell — and `GET /olai/who` stays for the doors that have no websocket.
  expect(tags).toContain("surface/system/identity")
  expect(tags).toContain("surface/who/get")
  // ... and its twin one fact over: what this deployment is CALLED, crossing
  // the same way (`app.ts`).
  expect(tags).toContain("surface/app/get")
  expect(WHO_PATH).toBe("/olai/who")
  expect(ASSET_PREFIX).toBe("/_olai/assets/")
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

// A frame that never carried `refused` is a body that opened, not a decode
// error. The field is optional with a default of false so a new client
// reading an old server, and an old client dropping a field it does not
// know, are both legal.
test("a document entry without refused decodes as not refused", () => {
  const decode = Schema.decodeUnknownSync(DocumentEntry)
  expect(decode({ rev: 1, text: "hello" })).toEqual({
    rev: 1,
    text: "hello",
    refused: false,
  })
  expect(decode({ rev: 1, text: null, refused: true })).toEqual({
    rev: 1,
    text: null,
    refused: true,
  })
})

// ── what identifies a row ──────────────────────────────────────────────

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
  // every one there is, so a sixth member arriving with a declaration cannot
  // slip past a suite that only knows four names.
  //
  // CORE'S OWN MEMBERS, and only those. `cells.ci` was on this list until the
  // extraction, and `cells.chat` and `cells.agents` came off it when chat
  // became a row: neither is a member this spec declares any more, because a
  // plugin brings a whole surface of its own and core composes it as a sibling.
  // Odu's cell is declared — and its two array depths held — in
  // `olai-plugin-odu`'s own suite, and chat's two in `olai-plugin-chat`'s,
  // each against the schema it actually ships. The walk all three suites spend
  // is one walk, published through this package's `./testlib` door, so there is
  // no second opinion about it.
  //
  // The members that declare NOTHING declare nothing on purpose and each says
  // why where it is declared —
  // `errors` has no field that identifies a row, and `outlines` and `heads`
  // are read through the batched `deltas` delivery, which replaces
  // each named leaf whole rather than merging, so there is no merge for a key to
  // govern. `documents` is served per key and would honour one, but a document
  // entry is a revision and a body; `manifest`, `dated`, `owed`,
  // `inbox` and `moving` carry no array of objects at all. Git's cells left
  // with the plugin (`olai-plugin-git`'s own suite holds them).
  expect(declaring.map((one) => `${one.name} → ${one.arrayKey}`).sort()).toEqual([
    "cells.pins → id",
    "cells.plugins → name",
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
  // ...and the doors table beside it, which is the one that had to be NAMED to
  // stay that way: a `Door` says which property key it is about, and a field
  // called `key` on it would have made this array keyed by the property — one
  // `brief` standing in for every `brief` on the page. It is `prop`
  // (`@olai/format`'s `meaning.ts`), and this line is what says so.
  expect(found.get("doors")).toBe("positional")
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

// ── which plugins this build has, and which this serve runs ────────────

// The roster is minted once per serve, so no frame of it repeats and the merge
// has nothing to decide today. It declares anyway, and this is what says the
// declaration reaches the array it is about: a plugin row IS its `name`, which
// is the sibling key every one of that plugin's tags is composed under.
test("the plugin roster is keyed by the one word core knows about a plugin", () => {
  expect(surface.spec.cells.plugins.arrayKey).toBe("name")
  expect(keyingsOf("cells.plugins").get("built")).toBe("keyed")
})

/**
 * WHAT A PAGE HOLDS BEFORE IT HAS HEARD, and it is deliberately not "every
 * plugin, off".
 *
 * A seed listing the build's plugins as `running: false` would flash "kolu is
 * off" at a serve that is running kolu, on the panel whose whole job is saying
 * which are on. An empty roster draws no rows at all, which is also exactly
 * what a runtime composing no plugins publishes.
 */
test("a page that has heard nothing has no plugin rows and no flag to name", () => {
  expect(surface.spec.cells.plugins.default).toEqual(NO_ROSTER)
  expect(NO_ROSTER.built).toEqual([])
  // `null` is nobody having said, which is NOT the empty list: `--plugins=` is
  // somebody saying none out loud, and the row's line says two different things.
  expect(NO_ROSTER.pinned).toBeNull()
  expect(Schema.is(PluginRoster)(NO_ROSTER)).toBe(true)
  expect(Schema.is(PluginRoster)({ built: [], pinned: [] })).toBe(true)
})

/**
 * THE ROSTER IS READ-ONLY AND THE SWITCH IS A PROCEDURE — two members under one
 * word, which is the `git` arrangement and is why the collision is worth
 * asserting rather than merely allowing.
 *
 * This case used to say there was no verb at all: *a plugin's enablement is
 * CLI/nix only — no settings file, no browser toggle — so there is no verb for a
 * tab to call, the way there is none for `--commit`.* The loader surface gave it
 * one, and the shape it gave it is the interesting half. The cell keeps `get`
 * alone, because a `set` on it would mean "make the roster say this", which is a
 * browser telling a serve what its own fibers are doing; the PROCEDURE is an act
 * with a subject and a refusal, and what comes back from it is the cell moving.
 *
 * ## The tag is the procedure's, and nothing else may mint it
 *
 * A cell's verbs and a procedure group's members compose into the same
 * `surface/<word>/<verb>` space, so `surface/plugins/set` would be ambiguous the
 * day somebody added `set` to the cell's `verbs`. It is not ambiguous today and
 * must not become so — which the framework enforces at boot, since a rooted
 * bundle counts both axes and refuses a duplicated tag. This asserts the state
 * that refusal is protecting: one `set`, and it is the act.
 */
test("the roster cell is read-only and the switch is the procedure beside it", () => {
  expect(tags).toContain("surface/plugins/get")
  expect(tags).toContain("surface/plugins/set")
  expect(tags).toContain("surface/settings/get")
  expect(tags).toContain("surface/settings/set")
  expect(surface.spec.cells.settings.verbs).toEqual(["get"])
  // The cell offers `get` and nothing else — so the tag above is the
  // procedure's, and there is no second member in the build that could mint it.
  expect(surface.spec.cells.plugins.verbs).toEqual(["get"])
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
