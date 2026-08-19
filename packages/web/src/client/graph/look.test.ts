/**
 * The edge table: total over the format's own list, and the one decision it
 * makes — which way leads when a record does both.
 */

import { WAYS } from "@olai/format"
import { expect, test } from "bun:test"

import { EDGE_LOOKS, lookOf } from "./look.ts"

test("there is a look per way, in the format's own order", () => {
  expect(EDGE_LOOKS.map((look) => look.way)).toEqual([...WAYS])
})

test("every look is drawn in theme tokens, never a colour written here", () => {
  for (const look of EDGE_LOOKS) {
    expect(look.stroke).toMatch(/^stroke-[a-z]+$/)
  }
})

// A line cannot be solid and dashed, so the leading way wins — the edge
// somebody wrote with a verb, which is the stronger claim.
test("an edge that is both is drawn as the see", () => {
  expect(lookOf(["see", "mention"]).way).toBe("see")
  expect(lookOf(["mention"]).way).toBe("mention")
  expect(lookOf(["see"]).way).toBe("see")
})
