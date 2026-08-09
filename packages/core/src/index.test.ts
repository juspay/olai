import { expect, test } from "bun:test"

import * as core from "./index.ts"

// The scaffold's own assertion: bun resolves and loads a workspace member's
// TypeScript source. Phase 2 replaces it with tests of the format core.
test("the core package loads", () => {
  expect(core).toBeDefined()
})
