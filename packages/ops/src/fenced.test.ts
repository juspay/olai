/** The node-agent fence as a pure plan judgement. */
import {
  AGENT_PROP,
  inboxIn,
  NO_KINDS,
  type OutlineSet,
  outlineNames,
  outlinePaths,
  type WriteRequest as Request,
} from "@olai/format"
import { readingOf } from "@olai/format/testlib"
import { describe, expect, test } from "bun:test"
import { Result } from "effect"

import { type Fence, outsideFence } from "./fenced.ts"
import { setOf, steady } from "./fixtures.testlib.ts"
import { plan, scoping } from "./plan.ts"
import { fenceRefusal } from "./refusals.ts"

const vault = (): OutlineSet => setOf({
  "house.olai": [
    `{"id":"house","ord":"a0","title":"House"}`,
    `{"id":"kitchen","parent":"house","ord":"a0","title":"Kitchen"}`,
    `{"id":"sink","parent":"kitchen","ord":"a0","title":"the sink"}`,
    `{"id":"roof","parent":"house","ord":"a1","title":"the roof"}`,
  ].join("\n"),
})

const kitchen: Fence = {
  under: "kitchen",
  ask: () => "“House” (`house`)",
  forbidden: new Set([AGENT_PROP]),
}

const asked = (request: Request, fence: Fence = kitchen) => {
  const at = readingOf(vault())
  const planned = plan(scoping(at, steady(), NO_KINDS), request)
  if (Result.isFailure(planned)) throw new Error(planned.failure.message)
  return outsideFence(
    fence,
    at.derived,
    outlineNames(at.set),
    inboxIn(outlinePaths(at.set)),
    planned.success,
  )
}

describe("node-agent write fence", () => {
  test("writes at or beneath the seat land", () => {
    expect(asked({ op: "done", id: "kitchen" })).toBeNull()
    expect(asked({ op: "done", id: "sink" })).toBeNull()
    expect(asked({ op: "add", parent: "sink", title: "buy a washer" })).toBeNull()
  })

  test("outside records and both directions of an outside move are refused", () => {
    expect(asked({ op: "done", id: "roof" })).toEqual({
      why: "record",
      id: "roof",
      title: "the roof",
      file: "house.olai",
    })
    expect(asked({ op: "move", id: "sink", parent: "roof" })?.why).toBe("record")
    expect(asked({ op: "move", id: "roof", parent: "kitchen" })?.why).toBe("record")
  })

  test("the seating property is forbidden even on the agent's own node", () => {
    expect(asked({ op: "prop", id: "kitchen", key: AGENT_PROP, value: "claude:s2" }))
      .toEqual({ why: "key", id: "kitchen", title: "Kitchen", key: AGENT_PROP })
  })

  test("a released ticket is a closed door", () => {
    expect(asked({ op: "done", id: "sink" }, {
      under: null,
      ask: () => null,
      forbidden: new Set(),
    })).toEqual({ why: "closed" })
  })

  test("the refusal names the nearest node agent above", () => {
    const outside = asked({ op: "done", id: "roof" })
    if (outside === null) throw new Error("the outside write landed")
    const words = fenceRefusal(readingOf(vault()).derived, kitchen, outside)
    expect(words).toContain("Ask “House” (`house`), the nearest node agent above you")
  })
})
