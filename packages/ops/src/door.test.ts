/**
 * The remaining session rule as a pure plan judgement.
 *
 * THE FORBIDDEN KEY IS A LITERAL HERE, and it has to be: an open
 * {@link ./door.ts}'s `forbidden` is DATA on a ticket and the caller that
 * fills it is a plugin — `olai-plugin-chat`, with every key its own kind is
 * declared on for this revision. This package spells no plugin's word and
 * there is no core constant left to import, so the bench passes the string a
 * real ticket would carry and asserts what the rule does with it, which is
 * all this file was ever about.
 */
import {
  NO_KINDS,
  type OutlineSet,
  type WriteRequest as Request,
} from "@olai/format"
import { readingOf } from "@olai/format/testlib"
import { describe, expect, test } from "bun:test"
import { Result } from "effect"

import { barred, doorRefusal } from "./door.ts"
import { setOf, steady } from "./fixtures.testlib.ts"
import { plan, scoping } from "./plan.ts"

const vault = (): OutlineSet => setOf({
  "house.olai": [
    `{"id":"house","ord":"a0","title":"House"}`,
    `{"id":"kitchen","parent":"house","ord":"a0","title":"Kitchen"}`,
    `{"id":"sink","parent":"kitchen","ord":"a0","title":"the sink"}`,
    // A node that already CARRIES a forbidden key, so the removal arm has
    // something to remove.
    `{"id":"tap","parent":"kitchen","ord":"a1","title":"the tap","custom":{"approved":"always"}}`,
    `{"id":"roof","parent":"house","ord":"a1","title":"the roof"}`,
  ].join("\n"),
}, [["spare.md", "a document the door may rewrite\n"]])

/** One key a real ticket forbids: the word chat's binding kind claims, which is
 *  what a vault that has declared nothing keeps its bindings under. */
const SEATING = "chat-agent-session"

/** ...and a second, which is what made the table a MAP: a real ticket forbids
 *  the word a person's approval of a vault-defined plugin is written under, for
 *  a completely different reason (`olai-plugin-mcp`'s `tickets.ts` holds both
 *  clauses, because that is where a ticket is minted). The two are here as data
 *  for the same reason the first one is a literal: this package spells nobody's
 *  word, and what it asserts is what the rule DOES with whatever it carries. */
const APPROVAL = "approved"

const SAYS_SEATS = "it is what seats a conversation on a node"
const SAYS_APPROVES = "it is a person's approval of code"

const forbidden = new Map([[SEATING, SAYS_SEATS], [APPROVAL, SAYS_APPROVES]])

const asked = (request: Request, keys: ReadonlyMap<string, string> = forbidden) => {
  const at = readingOf(vault())
  const planned = plan(scoping(at, steady(), NO_KINDS), request)
  if (Result.isFailure(planned)) throw new Error(planned.failure.message)
  return barred(keys, at.derived, planned.success)
}

describe("node-agent write rule", () => {
  test("writes land anywhere in the vault, including outside the seat's subtree", () => {
    expect(asked({ op: "done", id: "kitchen" })).toBeNull()
    expect(asked({ op: "done", id: "sink" })).toBeNull()
    expect(asked({ op: "add", parent: "sink", title: "buy a washer" })).toBeNull()
    expect(asked({ op: "done", id: "roof" })).toBeNull()
    expect(asked({ op: "move", id: "sink", parent: "roof" })).toBeNull()
    expect(asked({ op: "move", id: "roof", parent: "kitchen" })).toBeNull()
  })

  test("a document write and a file delete land", () => {
    expect(asked({ op: "create-doc", file: "notes.md", text: "hello" })).toBeNull()
    expect(asked({ op: "doc", file: "spare.md", text: "rewritten" })).toBeNull()
    expect(asked({ op: "delete", file: "spare.md" })).toBeNull()
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
    // node. The rule judges the RECORDS a plan changed, so all of them land on
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
   *  The rule reads a MOVEMENT rather than a direction, so it is refused with
   *  the rest — and an asymmetric rule here would be one more thing a reader of
   *  the rule has to hold for a capability nothing asks for. */
  test("...and taking one off is writing it, because the rule reads a movement", () => {
    expect(asked({ op: "prop", id: "tap", key: APPROVAL, value: null })?.why).toBe("key")
  })

  test("a closed rule's refusal does not walk the plan", () => {
    expect(doorRefusal({ why: "closed" })).toContain("conversation has been reaped")
  })

  /** THE CLAUSE IS THE TICKET'S, spent verbatim — which is what stops a general
   *  package writing prose about a word a plugin (or a later phase) owns. */
  test("the refusal quotes the clause the rule carried for that key", () => {
    const reached = asked({ op: "prop", id: "kitchen", key: APPROVAL, value: "always" })
    if (reached === null) throw new Error("the forbidden write landed")
    const words = doorRefusal(reached)
    expect(words).toContain(SAYS_APPROVES)
    expect(words).not.toContain(SAYS_SEATS)
    expect(words).not.toContain("nearest node agent")
  })
})
