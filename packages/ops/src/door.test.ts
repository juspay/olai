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

import { readingOf, setOf, steady } from "./fixtures.testlib.ts"
import { TEST_CLAIMS } from "olai-plugin-outline-olai/testlib"
import {
  NO_KINDS,
  type OutlineSet,
  type WriteRequest as Request,
} from "@olai/format"

import { describe, expect, test } from "bun:test"
import { Result } from "effect"

import { type Barred, barred, doorRefusal } from "./door.ts"

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

/** The clause a fence carries, in the words whoever raised it wrote. */
const SAYS_TIDY = "olai is tidying this node's memory, and a turn nobody is watching writes only inside it"

const asked = (request: Request, keys: ReadonlyMap<string, string> = forbidden) => {
  const at = readingOf(vault())
  const planned = plan(scoping(at, steady(), NO_KINDS, "outline-olai"), request)
  if (Result.isFailure(planned)) throw new Error(planned.failure.message)
  return barred(keys, at.derived, planned.success)
}

/** A chain eleven nodes long — the confined node at its head and ten levels
 *  under it — written DEEPEST FIRST.
 *
 *  The order is the point. `derived.children` is keyed in the order the rows
 *  are read, so a file written in tree order lets one round of a round-counted
 *  walk cascade the whole chain, and a round count only bites where a real
 *  outline bites: rows are matched by ID across the corpus and moves, edits and
 *  splits leave a memory in no order at all. */
const deep = (): OutlineSet => setOf({
  "chain.olai": Array.from({ length: 11 }, (_, at) => 10 - at)
    .map((level) =>
      `{"id":"d${level}"${level === 0 ? "" : `,"parent":"d${level - 1}"`},"ord":"a0","title":"level ${level}"}`)
    .join("\n"),
}, [["spare.md", "a document the door may rewrite\n"]])

/** The same judgement, with a fence up over one node's subtree — and, where a
 *  case needs it, the other node agents whose own subtrees are not this one's. */
const askedUnder = (request: Request, under: string, set: OutlineSet = vault(), stop?: ReadonlySet<string>) => {
  const at = readingOf(set)
  const planned = plan(scoping(at, steady(), NO_KINDS, "outline-olai"), request)
  if (Result.isFailure(planned)) throw new Error(planned.failure.message)
  return barred(forbidden, at.derived, planned.success, undefined, { under, says: SAYS_TIDY, stop })
}

/**
 * THE FENCE A PASS RAISES over the node it is tidying: while its turn runs, the
 * session that turn belongs to writes inside that subtree and nowhere else. The
 * reason is in `./door.ts`'s `Confinement`: an injected row can talk an
 * unattended turn with suppressed alerts into rewriting or trashing anything in
 * the directory, and those writes land outside the pass's own commit.
 */
describe("a confined session", () => {
  test("writes inside the subtree land, wherever the file is", () => {
    expect(askedUnder({ op: "done", id: "kitchen" }, "kitchen")).toBeNull()
    expect(askedUnder({ op: "done", id: "sink" }, "kitchen")).toBeNull()
    expect(askedUnder({ op: "add", parent: "sink", title: "buy a washer" }, "kitchen")).toBeNull()
    // The key table still applies inside the fence: the two rules are not
    // alternatives. (`tap` already carries `approved: "always"`, so this is a
    // movement — writing the same value back is nothing at all.)
    expect(askedUnder({ op: "prop", id: "tap", key: APPROVAL, value: "no" }, "kitchen"))
      .toEqual({ why: "key", id: "tap", title: "the tap", key: APPROVAL, says: SAYS_APPROVES })
  })

  test("a write outside is refused, and so is a row carried out of it", () => {
    expect(askedUnder({ op: "done", id: "roof" }, "kitchen"))
      .toEqual({ why: "outside", id: "roof", title: "the roof", says: SAYS_TIDY })
    expect(askedUnder({ op: "done", id: "house" }, "kitchen"))
      .toEqual({ why: "outside", id: "house", title: "House", says: SAYS_TIDY })
    // THE DESTINATION COUNTS TOO: this changes only `sink`'s own record, and
    // `sink` is inside — but the parent it lands under is not, so the row would
    // be written into a file the pass's commit does not name.
    expect(askedUnder({ op: "move", id: "sink", parent: "roof" }, "kitchen"))
      .toEqual({ why: "outside", id: "sink", title: "the sink", says: SAYS_TIDY })
    // ...and a move that stays inside is the pass's own work.
    expect(askedUnder({ op: "move", id: "sink", parent: "tap" }, "kitchen")).toBeNull()
  })

  test("the fence reaches the bottom of a chain ten deep", () => {
    // The descent used to be eight rounds of the children map, so a row deeper
    // than eight was judged outside and a legitimate write down there refused.
    expect(askedUnder({ op: "done", id: "d10" }, "d0", deep())).toBeNull()
    expect(askedUnder({ op: "add", parent: "d10", title: "one deeper" }, "d0", deep())).toBeNull()
    // ...and it is still a fence: the head of the same chain is outside when the
    // fence is up over the node at its bottom.
    expect(askedUnder({ op: "done", id: "d0" }, "d10", deep()))
      .toEqual({ why: "outside", id: "d0", title: "level 0", says: SAYS_TIDY })
  })

  test("a nested node agent's own subtree is outside the fence", () => {
    // WHERE A MEMORY ENDS IS ONE LINE: the commit the pass makes names exactly
    // the files the walk finds with the same exclusions, so a fence that stopped
    // only at the outer boundary would permit the one write the instruction
    // forbids — a write into a nested agent's memory, landing outside the commit
    // that is the undo.
    const others = new Set(["sink"])
    expect(askedUnder({ op: "done", id: "tap" }, "kitchen", vault(), others)).toBeNull()
    expect(askedUnder({ op: "done", id: "sink" }, "kitchen", vault(), others))
      .toEqual({ why: "outside", id: "sink", title: "the sink", says: SAYS_TIDY })
  })

  test("the refusal says why, in the fence's own words", () => {
    expect(doorRefusal({ why: "outside", id: "roof", title: "the roof", says: SAYS_TIDY }))
      .toContain(SAYS_TIDY)
    expect(doorRefusal({ why: "trash", says: SAYS_TIDY })).toContain(SAYS_TIDY)
  })
})

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
   * subtree by construction — so `outlines_prop approved` was a legal write through
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

describe("file-scoped agent reservation", () => {
  const file = "_olai/Settings.olai"
  const keys = new Map([["on", { file: "settings.olai", says: "a person's choice" }]])
  const check = (request: Request, value?: string) => {
    const at = readingOf(setOf({
      [file]: JSON.stringify({ id: "example", ord: "a0", title: "example",
        ...(value === undefined ? {} : { custom: { on: value } }) }),
      "notes.olai": '{"id":"notes","ord":"a0","title":"notes"}',
    }))
    const result = plan(scoping(at, steady(), NO_KINDS, "outline-olai"), request)
    if (Result.isFailure(result)) throw new Error(result.failure.message)
    return barred(keys, at.derived, result.success, at.set.documents.map(one => one.path))
  }

  /** The KEY arm's own key, for the assertions below: `Barred` gained two arms
   *  that are not about a key at all (`./door.ts`'s confinement). */
  const keyOf = (reached: Barred | null): string | undefined =>
    reached !== null && reached.why === "key" ? reached.key : undefined

  test("both directions, removal, and a batch reach the same reservation", () => {
    for (const value of ["yes", "no", null]) {
      expect(keyOf(check({ op: "prop", id: "example", key: "on", value }, value === "yes" ? "no" : "yes"))).toBe("on")
    }
    expect(keyOf(check({ op: "apply", ops: [{ op: "prop", id: "example", key: "on", value: "yes" }] }))).toBe("on")
  })

  test("behaviour knobs and ordinary files remain writable", () => {
    expect(check({ op: "prop", id: "example", key: "interval", value: "30s" }, "yes")).toBeNull()
    expect(check({ op: "prop", id: "notes", key: "on", value: "yes" })).toBeNull()
  })

  test("moving or trashing its namespace cannot remove the choice", () => {
    expect(keyOf(check({ op: "trash", id: "example" }, "yes"))).toBe("on")
    expect(keyOf(check({ op: "move", id: "example", parent: "notes" }, "yes"))).toBe("on")
  })

  test("a duplicate namespace cannot shadow an existing choice", () => {
    const at = readingOf(setOf({ [file]: '{"id":"example","ord":"a1","title":"example","custom":{"on":"no"}}' }))
    const nodes = at.derived.nodes.map(one => one.node)
    const shadow = readingOf(setOf({ [file]: '{"id":"shadow","ord":"a0","title":"example"}' })).derived.nodes[0]!.node
    expect(keyOf(barred(keys, at.derived, { files: [{ file, nodes: [shadow, ...nodes] }], id: "shadow", title: "example", file, summary: "shadow" }))).toBe("on")
  })

  test("a shallower empty file cannot mask an existing choice", () => {
    const at = readingOf(setOf({ [file]: '{"id":"example","ord":"a0","title":"example","custom":{"on":"no"}}' }))
    expect(keyOf(barred(keys, at.derived, { files: [{ file: "SETTINGS.olai", nodes: [] }], id: "", title: "", file: "SETTINGS.olai", summary: "mask file" }))).toBe("on")
  })
})
