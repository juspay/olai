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
  // surface mints these itself for liveness and identity — seeing them is how
  // we know the group came from the framework and not from our spec alone.
  expect(tags).toContain("surface/system/live")
})

// The browser may not write the error list, and a verb the server never serves
// would crash surface's boot walk rather than fail a call.
test("errors is read-only on the wire", () => {
  expect(surface.group.requests.has("surface/errors/set")).toBe(false)
})
