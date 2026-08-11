/**
 * The allowlist, as a fence rather than as a claim.
 *
 * Two things are being held still here, and neither is "the map has the entries
 * we typed" — that is a tautology. What is worth a test is what a FUTURE editor
 * would break without noticing:
 *
 *   - that the projection is what {@link ./expose.ts} says it is, member by
 *     member, so an upstream change to how a collection is addressed is caught
 *     here and not by an agent whose URIs stopped resolving;
 *   - that nothing reaches the wire that was not named, which is the difference
 *     between default-deny being the framework's behaviour and being ours. The
 *     assertion is written as an EXACT set for that reason: adding a member to
 *     the surface must not quietly widen what agents can see.
 *
 * The wire-COST half of the rule in `expose.ts` — that reading the collection
 * resource yields paths and not the corpus — cannot be seen from the expose map
 * alone, because it is a property of the adapter's verb choice. That fence lives
 * where a real server can be read: `face.test.ts`.
 */

import { expect, test } from "bun:test"
import { resolveExpose } from "@kolu/surface-mcp"
import { surface } from "@olai/surface"

import { EXPOSE } from "./expose.ts"

const resolved = () => resolveExpose(surface.spec, EXPOSE)

test("the outlines collection is a key-set resource plus an item template", () => {
  const { resources, resourceTemplates } = resolved()

  // The key set: one URI, read through the collection's `keys` verb.
  expect(resources).toContainEqual(
    expect.objectContaining({
      uri: "surface://collections/outlines",
      kind: "collection",
      key: "outlines",
    }),
  )
  // And one file at a time. The `{id}` is a root-relative, `/`-spelled path —
  // the same spelling the store's keys and every `file:line` use — which the
  // adapter parses by splitting on the FIRST `/` after the collection name, so
  // a nested `notes/todo.jsonl` addresses without escaping.
  expect(resourceTemplates).toContainEqual(
    expect.objectContaining({
      uriTemplate: "surface://collections/outlines/{id}",
      key: "outlines",
    }),
  )
})

test("errors is a cell resource", () => {
  expect(resolved().resources).toContainEqual(
    expect.objectContaining({ uri: "surface://cells/errors", kind: "cell", key: "errors" }),
  )
})

test("nothing else is exposed, and the set is exact", () => {
  const { resources, resourceTemplates, tools } = resolved()

  expect(resources.map((r) => r.uri).sort()).toEqual([
    "surface://cells/errors",
    "surface://collections/outlines",
  ])
  expect(resourceTemplates.map((t) => t.uriTemplate)).toEqual([
    "surface://collections/outlines/{id}",
  ])
  // No procedure is exposed at all: the only ones declared are the chat's, and
  // an agent does not drive the human's conversation. The tool surface arrives
  // separately, as bespoke tools over @olai/ops' own table.
  expect(tools).toEqual([])
})

test("the manifest cell is not exposed, because it IS the .md corpus", () => {
  // Not a restatement of the test above. This one names the member and the
  // reason, so re-adding it trips a failure that explains itself rather than a
  // diff on a URI list. `Manifest` is `NullOr({ documents: Array({ file, text }) })`
  // — exposing it as a cell would ship every document body on every read.
  // Documents arrive as a COLLECTION when `snapshot-scale` lands.
  expect(Object.keys(EXPOSE)).not.toContain("manifest")
  expect(resolved().resources.map((r) => r.key)).not.toContain("manifest")
})

test("the chat's state and transcript are not exposed", () => {
  const keys = resolved().resources.map((r) => r.key)
  expect(keys).not.toContain("chat")
  expect(keys).not.toContain("transcript")
})

test("every exposed key names something the spec actually declares", () => {
  // `resolveExpose` throws on a key that names no member, so this is the boot
  // check run early: a typo in the map is a failing test here rather than a
  // server that will not start on somebody's machine.
  expect(() => resolved()).not.toThrow()
})
