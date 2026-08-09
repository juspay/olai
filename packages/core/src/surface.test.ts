import { expect, test } from "bun:test"

import { surface, wireTags } from "./surface.ts"

// The scaffold's own assertion, and the reason it is worth running: this
// fails unless the @kolu/surface sources hydrated from the Nix store resolve
// `effect` out of the root node_modules and assemble a real RPC group. A
// second copy of effect, a missing root dependency, or a stale kolu pin all
// land here rather than in phase 2.
test("the surface claims our cell alongside the framework's own members", () => {
  expect(wireTags()).toContain("surface/greeting/get")
  // surface mints these itself for liveness and identity — seeing them is how
  // we know the group came from the framework and not from our spec alone.
  expect(wireTags()).toContain("surface/system/live")
})

test("a read-only cell claims no write verb", () => {
  expect(surface.group.requests.has("surface/greeting/set")).toBe(false)
})
