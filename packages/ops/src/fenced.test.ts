/**
 * The node-agent fence as a pure plan judgement.
 *
 * THE FORBIDDEN KEY IS A LITERAL HERE, and it has to be: `Fence.forbidden` is
 * DATA on a ticket ({@link ./fenced.ts}) and the caller that fills it is a
 * plugin — `olai-plugin-chat`, with every key its own kind is declared on for
 * this revision. This package spells no plugin's word and there is no core
 * constant left to import, so the bench passes the string a real ticket would
 * carry and asserts what the fence does with it, which is all this file was
 * ever about.
 */
import {
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
    // A node inside the seat that already CARRIES a forbidden key, so the
    // removal arm has something to remove.
    `{"id":"tap","parent":"kitchen","ord":"a1","title":"the tap","custom":{"approved":"always"}}`,
    `{"id":"roof","parent":"house","ord":"a1","title":"the roof"}`,
  ].join("\n"),
})

/** One key a real ticket forbids: the word chat's binding kind claims, which is
 *  what a vault that has declared nothing keeps its bindings under. */
const SEATING = "chat-agent-session"

/** ...and a second, which is what made the table a MAP: a real ticket forbids
 *  the word a person's approval of a vault-defined plugin is written under, for
 *  a completely different reason (`@olai/server`'s `mcp/tickets.ts` holds both
 *  clauses, because that is where a ticket is minted). The two are here as data
 *  for the same reason the first one is a literal: this package spells nobody's
 *  word, and what it asserts is what the fence DOES with whatever it carries. */
const APPROVAL = "approved"

const SAYS_SEATS = "it is what seats a conversation on a node"
const SAYS_APPROVES = "it is a person's approval of code"

const kitchen: Fence = {
  under: "kitchen",
  ask: () => "“House” (`house`)",
  forbidden: new Map([[SEATING, SAYS_SEATS], [APPROVAL, SAYS_APPROVES]]),
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

  test("a forbidden property is forbidden even on the agent's own node", () => {
    expect(asked({ op: "prop", id: "kitchen", key: SEATING, value: "claude:s2" }))
      .toEqual({ why: "key", id: "kitchen", title: "Kitchen", key: SEATING, says: SAYS_SEATS })
  })

  /**
   * THE HOLE PHASE 12 HAD, as a plan judgement.
   *
   * A vault-defined plugin's approval is an ordinary custom property on an
   * ordinary node, and a definition an agent wrote is inside that agent's own
   * subtree by construction — so `set_prop approved` was a legal write through
   * the door the agent already held, and the plugin mounted having been read by
   * nobody. The verb was closed on the face and the fact was not.
   */
  test("...and the approval one is refused on a node the agent otherwise owns", () => {
    expect(asked({ op: "prop", id: "kitchen", key: APPROVAL, value: "always" }))
      .toEqual({ why: "key", id: "kitchen", title: "Kitchen", key: APPROVAL, says: SAYS_APPROVES })
    // Every shape that carries a custom key, not only the one verb: an `apply`
    // is the ops each of its entries is, and an `add` mints its props with the
    // node. The fence judges the RECORDS a plan changed, so all of them land on
    // the same comparison rather than on a list of verbs to keep in step.
    expect(asked({
      op: "apply",
      ops: [{ op: "prop", id: "sink", key: APPROVAL, value: "always" }],
    })?.why).toBe("key")
    expect(
      asked({ op: "add", parent: "sink", title: "a plugin", props: { [APPROVAL]: "always" } })?.why,
    ).toBe("key")
  })

  /** Un-approving is the fail-safe direction and would be defensible to allow.
   *  The fence reads a MOVEMENT rather than a direction, so it is refused with
   *  the rest — and an asymmetric rule here would be one more thing a reader of
   *  the fence has to hold for a capability nothing asks for. */
  test("...and taking one off is writing it, because the fence reads a movement", () => {
    expect(asked({ op: "prop", id: "tap", key: APPROVAL, value: null })?.why).toBe("key")
  })

  test("a released ticket is a closed door", () => {
    expect(asked({ op: "done", id: "sink" }, {
      under: null,
      ask: () => null,
      forbidden: new Map(),
    })).toEqual({ why: "closed" })
  })

  test("the refusal names the nearest node agent above", () => {
    const outside = asked({ op: "done", id: "roof" })
    if (outside === null) throw new Error("the outside write landed")
    const words = fenceRefusal(readingOf(vault()).derived, kitchen, outside)
    expect(words).toContain("Ask “House” (`house`), the nearest node agent above you")
  })

  /** THE CLAUSE IS THE TICKET'S, spent verbatim — which is what stops a general
   *  package writing prose about a word a plugin (or a later phase) owns. */
  test("the refusal quotes the clause the fence carried for that key", () => {
    const outside = asked({ op: "prop", id: "kitchen", key: APPROVAL, value: "always" })
    if (outside === null) throw new Error("the forbidden write landed")
    const words = fenceRefusal(readingOf(vault()).derived, kitchen, outside)
    expect(words).toContain(SAYS_APPROVES)
    expect(words).not.toContain(SAYS_SEATS)
  })
})
