import { expect, test } from "bun:test"

import { surface } from "./index.ts"

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
