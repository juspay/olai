import { expect, test } from "bun:test"

import { nodeRef } from "./ref.ts"

test("a node id is a code span, and nothing else", () => {
  expect(nodeRef("lane-a")).toBe("`lane-a`")
  expect(nodeRef("step")).toBe("`step`")
})
