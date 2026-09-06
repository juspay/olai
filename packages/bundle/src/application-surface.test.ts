/**
 * WHAT THIS BUILD'S ROWS DECLARE, and under which tag each of it answers.
 *
 * ## There is no aggregate any more, and that is what this file changed
 *
 * Every case here used to read ONE `defineSurface` — `./surface.ts`, which
 * spread core's members and nine rows' into a single flat spec so the whole
 * application could be asked one question. That module is deleted with #546.
 * A member has one tag now and it carries its owner, so a flat aggregate under
 * BARE names described a wire nothing serves: `surface/outlines/get` was the
 * monolith's tag for the collection outlines answers at
 * `surface/outlines/outlines/keys`, and asserting the first proved nothing
 * about the second. Shrunk to what it still had a right to compose, the
 * aggregate was `@olai/surface`'s own spec on a second identity.
 *
 * So the claims are asked of the ROWS, and each is minted at the tag the
 * composition will actually serve it under — `surface/<row>/<member>/<verb>`,
 * which is `@olai/server`'s `composition.ts`'s one line of arithmetic, spelled
 * here as {@link tagsOf} so a case cannot quietly assert the unscoped form
 * again. Core keeps its unprefixed three-segment tags, because core is the root
 * (`./composition.test.ts`, "a rooted bundle with nothing mounted is olai's own
 * surface, tag for tag").
 *
 * ## Why the bundle is where they live
 *
 * Two reasons, and the second is the one that keeps them out of the rows. The
 * READ-ONLY claims are per row and could go either way. The DECLARATION claim —
 * every `arrayKey` in the build, asserted as one list — cannot: it is the
 * question "is there a member anywhere in this build whose key names a field
 * its schema does not carry", and only the package that knows every row can ask
 * it. A per-row version of it passes by knowing about four members.
 *
 * This package may import the rows' contracts; it is the registry, and the
 * fence's "the registry declares every plugin it imports" is what keeps that
 * from meaning anything else.
 */
import { expect, test } from "bun:test"

import { Schema, SchemaAST } from "effect"

import { keyings, type Keying } from "@olai/surface/testlib"

import {
  ASSET_PREFIX,
  NO_ROSTER,
  PluginRoster,
  surface as core,
  WHO_PATH,
} from "@olai/surface"
import { surface as capture } from "olai-plugin-capture/surface"
import { surface as markdown } from "olai-plugin-markdown/surface"
import { DocumentEntry } from "olai-plugin-markdown/wire"
import { surface as outlines } from "olai-plugin-outlines/surface"
import { surface as pins } from "olai-plugin-pins/surface"
import { surface as definitions } from "olai-plugin-vault-plugins/surface"
import { surface as vault } from "olai-plugin-vault/surface"
import { LOADED, Manifest } from "olai-plugin-vault/wire"

/** One surface, at the tags the composition serves it under. A ROW's are its
 *  own tags with its mount name spliced in after `surface/`; CORE's are its own
 *  unchanged, which is what being the root means. The splice is
 *  `@olai/server`'s `composition.ts`'s, spelled once here rather than per
 *  case — a case that wrote the string itself could write the bare form. */
const tagsOf = (
  surface: { readonly group: { readonly requests: ReadonlyMap<string, unknown> } },
  row?: string,
): ReadonlySet<string> =>
  new Set([...surface.group.requests.keys()].map((tag) =>
    row === undefined ? tag : `surface/${row}/${tag.slice("surface/".length)}`
  ))

const CORE = tagsOf(core)
const OUTLINES = tagsOf(outlines, "outlines")
const MARKDOWN = tagsOf(markdown, "markdown")
const VAULT = tagsOf(vault, "vault")
const DEFINITIONS = tagsOf(definitions, "vault-plugins")

// Inherited from the scaffold, and worth keeping for the same reason: this
// fails unless the @kolu/surface sources hydrated from the Nix store resolve
// `effect` out of the root node_modules and assemble a real RPC group. A
// second copy of effect, a missing root dependency, or a stale kolu pin all
// land here rather than in the browser.
test("core claims its own members alongside the framework's own", () => {
  // Reserved, and the reason this repo declares no process-identity member of
  // its own: the framework answers "which process is this" out of every
  // surface, and the stale-tab handshake on both ends reads THAT id. Who is
  // LOOKING is a different question — per connection, so a procedure, not a
  // cell — and `GET /olai/who` stays for the doors that have no websocket.
  expect(CORE).toContain("surface/system/identity")
  expect(CORE).toContain("surface/who/get")
  // ... and its twin one fact over: what this deployment is CALLED, crossing
  // the same way (`app.ts`).
  expect(CORE).toContain("surface/app/get")
  expect(WHO_PATH).toBe("/olai/who")
  expect(ASSET_PREFIX).toBe("/_olai/assets/")
  // surface mints these itself for liveness and identity — seeing them is how
  // we know the group came from the framework and not from our spec alone.
  expect(CORE).toContain("surface/system/live")
})

// ...and the rows' members answer under their OWNER, which is the whole of
// #546 stated as tags. Every one of these had a bare twin — `surface/errors/get`
// beside `surface/vault/errors/get` — because nine rows registered `root: true`
// to keep the monolith's names alive. There is one name each now, and a client
// that still spells a bare one is calling nothing.
test("a row's members answer under the row's own name, and under no other", () => {
  expect(VAULT).toContain("surface/vault/errors/get")
  expect(VAULT).toContain("surface/vault/manifest/get")
  expect(OUTLINES).toContain("surface/outlines/outlines/keys")
  expect(MARKDOWN).toContain("surface/markdown/documents/keys")
  expect(MARKDOWN).toContain("surface/markdown/documents/get")
  // The bare forms are nobody's, and this is asserted over the union rather
  // than per row: a tag that came back is a row that started answering the
  // monolith's name again, whichever row did it.
  const every = new Set([...CORE, ...OUTLINES, ...MARKDOWN, ...VAULT, ...DEFINITIONS])
  for (const bare of [
    "surface/errors/get",
    "surface/manifest/get",
    "surface/outlines/get",
    "surface/outlines/keys",
    "surface/documents/keys",
    "surface/documents/get",
    "surface/edit/apply",
    "surface/ops/run",
  ]) expect([bare, every.has(bare)]).toEqual([bare, false])
})

// The browser may not write the error list, and a verb the server never serves
// would crash surface's boot walk rather than fail a call.
test("errors is read-only on the wire", () => {
  expect(VAULT.has("surface/vault/errors/set")).toBe(false)
})

// The batched stream is the whole reason `outlines` is a collection: one
// coalesced {upserts, removes} frame per probe tick, keyed by file path. Losing
// the verb would leave a collection served one key at a time, which is the
// stream design with more round trips.
test("outlines is served as batched deltas, and read-only", () => {
  expect(OUTLINES).toContain("surface/outlines/outlines/deltas")
  expect(OUTLINES).toContain("surface/outlines/outlines/keys")
  expect(OUTLINES.has("surface/outlines/outlines/upsert")).toBe(false)
  expect(OUTLINES.has("surface/outlines/outlines/delete")).toBe(false)
})

// A directory belongs to the disk, and so do the facts about it as a whole.
test("the manifest is read-only on the wire", () => {
  expect(VAULT.has("surface/vault/manifest/set")).toBe(false)
})

// The cell every subscription reads on its first frame says ONE thing: whether
// there is a set. It is the value that carried every `.md` body, so a field
// arriving on it is how the corpus would come back — and one that moves per
// revision would also wake every open tab's derivation for nothing.
test("the manifest carries nothing, and knows when it has not changed", () => {
  expect(LOADED).toEqual({})
  expect(Schema.is(Manifest)(LOADED)).toBe(true)
  expect(Schema.is(Manifest)(null)).toBe(true)
  expect(vault.spec.cells.manifest.equals?.(LOADED, {})).toBe(true)
  expect(vault.spec.cells.manifest.equals?.(LOADED, null)).toBe(false)
})

// snapshot-scale, as a test of the DECLARATION. `deltas` opens with a snapshot
// of every entry, and a documents entry is a `.md` body — so declaring it here
// would put the whole corpus back on the first frame of every subscription,
// which is the defect this collection was cut out of the manifest to fix.
// `keys` + `get` is the shape: paths for the sidebar, a body for whoever opens
// one.
test("documents are served keys-first, one body at a time, and read-only", () => {
  expect(MARKDOWN).toContain("surface/markdown/documents/keys")
  expect(MARKDOWN).toContain("surface/markdown/documents/get")
  expect(MARKDOWN.has("surface/markdown/documents/deltas")).toBe(false)
  expect(MARKDOWN.has("surface/markdown/documents/upsert")).toBe(false)
  expect(MARKDOWN.has("surface/markdown/documents/delete")).toBe(false)
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

/** Every member this build declares, from core and from the rows that declare
 *  a keyed one — named `<owner>.<kind>.<member>` so the list below says whose
 *  each declaration is. The aggregate this walked used to make the ownership
 *  invisible, which is exactly the confusion #546 was about. */
const MEMBERS: ReadonlyArray<{
  readonly name: string
  readonly arrayKey: string | undefined
  /** The schema of what one frame of this member CARRIES — a collection's is one
   *  entry's, which is the value its per-key delivery merges. */
  readonly value: { readonly ast: SchemaAST.AST }
}> = ([
  { owner: "core", spec: core.spec },
  { owner: "outlines", spec: outlines.spec },
  { owner: "markdown", spec: markdown.spec },
  { owner: "vault", spec: vault.spec },
  { owner: "pins", spec: pins.spec },
  { owner: "capture", spec: capture.spec },
  // The four kinds are read off a WIDENED spec, and the widening is what the
  // aggregate used to do by spreading: a row declares only the kinds it has, so
  // `cells` is not a property of outlines' spec type at all and `streams` is
  // not one of vault's. The walk asks all three of every row and takes what is
  // there, which is what a composition does with them too.
] as ReadonlyArray<{
  readonly owner: string
  readonly spec: {
    readonly cells?: Readonly<Record<string, unknown>>
    readonly collections?: Readonly<Record<string, unknown>>
    readonly streams?: Readonly<Record<string, unknown>>
  }
}>).flatMap(({ owner, spec }) => [
  ...Object.entries(spec.cells ?? {}).map(([name, one]) => ({
    name: `${owner}.cells.${name}`,
    arrayKey: (one as { readonly arrayKey?: string }).arrayKey,
    value: (one as { readonly schema: unknown }).schema as { readonly ast: SchemaAST.AST },
  })),
  ...Object.entries(spec.collections ?? {}).map(([name, one]) => ({
    name: `${owner}.collections.${name}`,
    arrayKey: (one as { readonly arrayKey?: string }).arrayKey,
    value: (one as { readonly schema: unknown }).schema as { readonly ast: SchemaAST.AST },
  })),
  ...Object.entries(spec.streams ?? {}).map(([name, one]) => ({
    name: `${owner}.streams.${name}`,
    arrayKey: (one as { readonly arrayKey?: string }).arrayKey,
    value: (one as { readonly outputSchema: unknown }).outputSchema as { readonly ast: SchemaAST.AST },
  })),
])

/** The arrays one declaring member's key identifies — its OWN schema and its OWN
 *  field, so a case below cannot end up checking a schema the member no longer
 *  carries. */
const keyingsOf = (name: string): ReadonlyMap<string, Keying> => {
  const member = MEMBERS.find((one) => one.name === name)
  if (member === undefined) throw new Error(`no member ${name} is declared in this build`)
  if (member.arrayKey === undefined) throw new Error(`${name} declares no arrayKey`)
  return keyings(member.value, member.arrayKey)
}

test("every declaration names a field its own schema carries, and no other member declares", () => {
  const declaring = MEMBERS.filter((one) => one.arrayKey !== undefined)
  // THE WHOLE LIST, asserted as a list: this is what says the four below are
  // every one there is, so a fifth member arriving with a declaration cannot
  // slip past a suite that only knows four names.
  //
  // EACH UNDER ITS OWNER, which is the half this list gained when the aggregate
  // went: `cells.pins` was a name with no owner in it, and the same name in two
  // rows would have collided silently in the spread that produced it.
  //
  // Odu's cell is declared — and its two array depths held — in
  // `olai-plugin-odu`'s own suite, and chat's two in `olai-plugin-chat`'s,
  // each against the schema it actually ships. The walk all three suites spend
  // is one walk, published through `@olai/surface`'s `./testlib` door, so there
  // is no second opinion about it.
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
    "core.cells.plugins → name",
    "markdown.streams.documentPage → key",
    "outlines.streams.page → key",
    "pins.cells.pins → id",
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
  expect(outlines.spec.streams.page.arrayKey).toBe("key")
  const found = keyingsOf("outlines.streams.page")
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
  expect(pins.spec.cells.pins.arrayKey).toBe("id")
  // The shelf IS the array — the member's whole value, so the root path.
  expect(keyingsOf("pins.cells.pins").get("")).toBe("keyed")
})

// ── which plugins this build has, and which this serve runs ────────────

// The roster is minted once per serve, so no frame of it repeats and the merge
// has nothing to decide today. It declares anyway, and this is what says the
// declaration reaches the array it is about: a plugin row IS its `name`, which
// is the sibling key every one of that plugin's tags is composed under.
test("the plugin roster is keyed by the one word core knows about a plugin", () => {
  expect(core.spec.cells.plugins.arrayKey).toBe("name")
  expect(keyingsOf("core.cells.plugins").get("built")).toBe("keyed")
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
  expect(core.spec.cells.plugins.default).toEqual(NO_ROSTER)
  expect(NO_ROSTER.built).toEqual([])
  // `null` is nobody having said, which is NOT the empty list: `--plugins=` is
  // somebody saying none out loud, and the row's line says two different things.
  expect(NO_ROSTER.pinned).toBeNull()
  expect(Schema.is(PluginRoster)(NO_ROSTER)).toBe(true)
  expect(Schema.is(PluginRoster)({ built: [], pinned: [] })).toBe(true)
  // A serve too old to send `pin` still decodes; a new one writes the sum.
  expect(Schema.is(PluginRoster)({
    built: [],
    pinned: null,
    pin: { kind: "delta", extra: ["xyne-spaces"], without: null },
  })).toBe(true)
})

/**
 * THE ROSTER IS READ-ONLY AND THE SWITCH IS A PROCEDURE — two members under one
 * word, and the collision is core's own now rather than one this package made.
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
  expect(CORE).toContain("surface/plugins/get")
  expect(CORE).toContain("surface/plugins/set")
  // The cell offers `get` and nothing else — so the tag above is the
  // procedure's, and there is no second member in the build that could mint it.
  expect(core.spec.cells.plugins.verbs).toEqual(["get"])
})

/**
 * ...AND THE SECOND OWNER OF THE WORD `plugins` IS NOT AN OWNER ANY MORE.
 *
 * `./surface.ts` spread core's `plugins` procedures and
 * `olai-plugin-vault-plugins`' into ONE group by hand —
 *
 *     plugins: { ...core.spec.procedures.plugins, ...definitions.spec.procedures.plugins },
 *
 * — so `get`/`set` and `inspect`/`run`/`stop`/`approve` answered under one
 * `surface/plugins/…` namespace with two packages behind it. The merge was
 * written down and deliberate, and this file asserted it as such; what it could
 * not do is say which half a tag belonged to, which is the defect #546 names.
 *
 * The collision simply ends. Core's two keep the root's unprefixed tags because
 * core is the root; the definitions row's four are its own, under its own mount
 * name, and no hand-written spread stands between them. There is nothing left to
 * merge and so nothing left to get wrong — which is why this case asserts the
 * SEPARATION rather than the merge it replaced.
 */
test("the definitions row's plugin verbs are its own, and core's are core's", () => {
  expect(DEFINITIONS).toContain("surface/vault-plugins/plugins/inspect")
  expect(DEFINITIONS).toContain("surface/vault-plugins/plugins/run")
  expect(DEFINITIONS).toContain("surface/vault-plugins/plugins/stop")
  expect(DEFINITIONS).toContain("surface/vault-plugins/plugins/approve")
  // The row mints neither of core's, and core mints none of the row's — which
  // is what one hand-merged group made impossible to state.
  expect(DEFINITIONS.has("surface/plugins/set")).toBe(false)
  expect(DEFINITIONS.has("surface/plugins/get")).toBe(false)
  for (const verb of ["inspect", "run", "stop", "approve"]) {
    expect([verb, CORE.has(`surface/plugins/${verb}`)]).toEqual([verb, false])
  }
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
