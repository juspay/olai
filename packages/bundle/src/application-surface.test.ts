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

test("core claims its own members alongside the framework's own", () => {
  expect(CORE).toContain("surface/system/identity")
  expect(CORE).toContain("surface/who/get")
  expect(CORE).toContain("surface/app/get")
  expect(WHO_PATH).toBe("/olai/who")
  expect(ASSET_PREFIX).toBe("/_olai/assets/")
  expect(CORE).toContain("surface/system/live")
})

test("a row's members answer under the row's own name, and under no other", () => {
  expect(VAULT).toContain("surface/vault/errors/get")
  expect(VAULT).toContain("surface/vault/manifest/get")
  expect(OUTLINES).toContain("surface/outlines/outlines/keys")
  expect(MARKDOWN).toContain("surface/markdown/documents/keys")
  expect(MARKDOWN).toContain("surface/markdown/documents/get")
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

test("errors is read-only on the wire", () => {
  expect(VAULT.has("surface/vault/errors/set")).toBe(false)
})

test("outlines is served as batched deltas, and read-only", () => {
  expect(OUTLINES).toContain("surface/outlines/outlines/deltas")
  expect(OUTLINES).toContain("surface/outlines/outlines/keys")
  expect(OUTLINES.has("surface/outlines/outlines/upsert")).toBe(false)
  expect(OUTLINES.has("surface/outlines/outlines/delete")).toBe(false)
})

test("the manifest is read-only on the wire", () => {
  expect(VAULT.has("surface/vault/manifest/set")).toBe(false)
})

test("the manifest carries nothing, and knows when it has not changed", () => {
  expect(LOADED).toEqual({})
  expect(Schema.is(Manifest)(LOADED)).toBe(true)
  expect(Schema.is(Manifest)(null)).toBe(true)
  expect(vault.spec.cells.manifest.equals?.(LOADED, {})).toBe(true)
  expect(vault.spec.cells.manifest.equals?.(LOADED, null)).toBe(false)
})

test("documents are served keys-first, one body at a time, and read-only", () => {
  expect(MARKDOWN).toContain("surface/markdown/documents/keys")
  expect(MARKDOWN).toContain("surface/markdown/documents/get")
  expect(MARKDOWN.has("surface/markdown/documents/deltas")).toBe(false)
  expect(MARKDOWN.has("surface/markdown/documents/upsert")).toBe(false)
  expect(MARKDOWN.has("surface/markdown/documents/delete")).toBe(false)
})

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

const MEMBERS: ReadonlyArray<{
  readonly name: string
  readonly arrayKey: string | undefined
  readonly value: { readonly ast: SchemaAST.AST }
}> = ([
  { owner: "core", spec: core.spec },
  { owner: "outlines", spec: outlines.spec },
  { owner: "markdown", spec: markdown.spec },
  { owner: "vault", spec: vault.spec },
  { owner: "pins", spec: pins.spec },
  { owner: "capture", spec: capture.spec },
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

const keyingsOf = (name: string): ReadonlyMap<string, Keying> => {
  const member = MEMBERS.find((one) => one.name === name)
  if (member === undefined) throw new Error(`no member ${name} is declared in this build`)
  if (member.arrayKey === undefined) throw new Error(`${name} declares no arrayKey`)
  return keyings(member.value, member.arrayKey)
}

test("every declaration names a field its own schema carries, and no other member declares", () => {
  const declaring = MEMBERS.filter((one) => one.arrayKey !== undefined)
  expect(declaring.map((one) => `${one.name} → ${one.arrayKey}`).sort()).toEqual([
    "core.cells.plugins → name",
    "markdown.streams.documentPage → key",
    "outlines.streams.page → key",
    "pins.cells.pins → id",
    "vault.streams.bodyPage → key",
  ])
  for (const one of declaring) {
    const found = keyings(one.value, one.arrayKey as string)
    expect([one.name, [...found].filter(([, how]) => how === "keyed").length > 0])
      .toEqual([one.name, true])
    expect([one.name, [...found].filter(([, how]) => how === "mixed")])
      .toEqual([one.name, []])
  }
})

test("the page stream is keyed by the field a Row carries, on every arm", () => {
  expect(outlines.spec.streams.page.arrayKey).toBe("key")
  const found = keyingsOf("outlines.streams.page")
  expect(found.get("shows.rows")).toBe("keyed")
  expect(found.get("shows.rows[].children")).toBe("keyed")
  expect(found.get("shows.zoomed.children")).toBe("keyed")
  expect(found.get("shows.groups[].rows")).toBe("keyed")
  expect(found.get("names")).toBe("positional")
  expect(found.get("doors")).toBe("positional")
  expect(found.get("shows.backlinks")).toBe("positional")
  expect(found.get("shows.referrers")).toBe("positional")
  expect(found.get("shows.zoomed.trail")).toBe("positional")
  expect(found.get("shows.groups[].nodes")).toBe("positional")
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
  expect(keyingsOf("pins.cells.pins").get("")).toBe("keyed")
})

test("the plugin roster is keyed by the one word core knows about a plugin", () => {
  expect(core.spec.cells.plugins.arrayKey).toBe("name")
  expect(keyingsOf("core.cells.plugins").get("built")).toBe("keyed")
})

test("a page that has heard nothing has no plugin rows", () => {
  expect(core.spec.cells.plugins.default).toEqual(NO_ROSTER)
  expect(NO_ROSTER).toEqual({ built: [] })
  expect(Schema.is(PluginRoster)(NO_ROSTER)).toBe(true)
})

test("the roster cell is read-only and the switch is the procedure beside it", () => {
  expect(CORE).toContain("surface/plugins/get")
  expect(CORE).toContain("surface/plugins/set")
  expect(core.spec.cells.plugins.verbs).toEqual(["get"])
})

test("the vault-plugins row's plugin verbs are its own, and core's are core's", () => {
  const VERBS = ["guide", "inspect", "write", "run", "stop", "approve", "mint", "ask"]
  for (const verb of VERBS) expect([verb, DEFINITIONS.has(`surface/vault-plugins/plugins/${verb}`)]).toEqual([verb, true])
  expect(DEFINITIONS.has("surface/plugins/set")).toBe(false)
  expect(DEFINITIONS.has("surface/plugins/get")).toBe(false)
  for (const verb of VERBS) {
    expect([verb, CORE.has(`surface/plugins/${verb}`)]).toEqual([verb, false])
  }
})

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
  expect(keyings(Optional, "key").get("rows")).toBe("positional")
  expect(keyings(Nullable, "key").get("rows")).toBe("positional")
  expect(keyings(Mixed, "key").get("rows")).toBe("mixed")
})

test("older rosters with retired pin fields still decode", () => {
  const older = { built: [{ name: "old-row", running: true }], pin: { kind: "only", names: ["old-row"] }, pinned: true }
  expect(Schema.decodeUnknownSync(PluginRoster)(older)).toEqual({ built: [{ name: "old-row", running: true }] })
})

test("a serve instance without hostname provenance remains decodable", () => {
  const older = { built: [], instance: { hostname: "old-host", host: "127.0.0.1", port: 3000,
    hostAuthor: "default", portAuthor: "default", policy: [], origins: [], bearer: { set: true } } }
  expect(Schema.decodeUnknownSync(PluginRoster)(older).instance?.hostnameAuthor).toBeUndefined()
})
