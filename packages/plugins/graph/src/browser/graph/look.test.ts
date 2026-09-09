/**
 * The edge table: total over the format's own list, the one decision it makes
 * — which way leads when a record writes both — and the two claims the four
 * of them read as.
 */

import { WAYS_DRAWN } from "@olai/format"
import { expect, test } from "bun:test"

import { EDGE_LOOKS, lookOf } from "./look.ts"

test("there is a look per way, in the format's own order", () => {
  expect(EDGE_LOOKS.map((look) => look.way)).toEqual([...WAYS_DRAWN])
})

test("every look is drawn in theme tokens, never a colour written here", () => {
  for (const look of EDGE_LOOKS) {
    expect(look.stroke).toMatch(/^stroke-[a-z]+$/)
  }
})

// The two claims: written relations wear the accent, prose wears the muted
// ink, and only the unclaimed one is dashed.
test("the written relations share the accent and the prose stays quiet", () => {
  expect(lookOf(["see"]).hollow).toBe(false)
  expect(lookOf(["doc"]).hollow).toBe(true)
  expect(lookOf(["link"]).dashes).toBeUndefined()
  expect(lookOf(["mention"]).dashes).toBeDefined()
})

// A line cannot be solid and dashed, so the leading way wins — the strongest
// claim the writer made, which is the stronger reading of the two.
test("an edge carrying two ways is drawn as the stronger one", () => {
  expect(lookOf(["see", "mention"]).way).toBe("see")
  expect(lookOf(["doc", "link"]).way).toBe("doc")
  expect(lookOf(["link", "mention"]).way).toBe("link")
  expect(lookOf(["mention"]).way).toBe("mention")
})
