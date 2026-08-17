/**
 * What an armed id turns into.
 *
 * Value in, value out, over the same kind of fixture {@link ./edit.test.ts}
 * uses and for the same reason: what a browser sends is a NAME, what the agent
 * is told is the set's answer to it, and the whole of the work between them is
 * a lookup and a chain of ancestors. No store, no agent and no socket.
 *
 * The refusals are the half worth the file. An armed node that has gone is not
 * a message to send with one line missing — it is a question about a node that
 * is not there, and the answer has to be the same one a tool call gets for the
 * same id.
 */

import { type OpFailure, type OutlineSet, type Reading } from "@olai/format"
import { readingOf, setOf } from "@olai/format/testlib"
import type { NodeContext } from "@olai/surface"
import { expect, test } from "bun:test"
import { Result } from "effect"

import { contextFor } from "./context.ts"

const HOUSE = [
  `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
  `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets","doing":true}`,
  `{"id":"install","parent":"kitchen","ord":"a2","title":"install them"}`,
  `{"id":"handles","parent":"install","ord":"a0","title":"pick the handles"}`,
  `{"id":"echo","ord":"a2","mirror":"order"}`,
].join("\n")

const reading = (set: OutlineSet = setOf({ "house.olai": HOUSE })): Reading =>
  readingOf(set)

const resolved = (ids: ReadonlyArray<string>): ReadonlyArray<NodeContext> => {
  const outcome = contextFor(reading(), ids)
  if (Result.isFailure(outcome)) {
    throw new Error(
      `expected ${JSON.stringify(ids)} to resolve, and it refused: ` +
        `${outcome.failure._tag} — ${outcome.failure.message}`,
    )
  }
  return outcome.success
}

const refused = (ids: ReadonlyArray<string>): OpFailure => {
  const outcome = contextFor(reading(), ids)
  if (Result.isSuccess(outcome)) {
    throw new Error(`expected ${JSON.stringify(ids)} to be refused, and it resolved`)
  }
  return outcome.failure
}

test("an id becomes the node, where it lives, and what it hangs off", () => {
  expect(resolved(["handles"])).toEqual([
    {
      id: "handles",
      title: "pick the handles",
      file: "house.olai",
      line: 4,
      // Outermost first, and the CANONICAL chain — what makes a bare "pick the
      // handles" mean something in a directory of outlines.
      path: ["Kitchen remodel", "install them"],
    },
  ])
})

test("a node at the top of its outline hangs off nothing", () => {
  expect(resolved(["kitchen"])[0]?.path).toEqual([])
})

test("nothing armed is nothing to resolve", () => {
  expect(resolved([])).toEqual([])
})

test("the order armed is the order sent", () => {
  expect(resolved(["order", "kitchen"]).map((node) => node.id)).toEqual([
    "order",
    "kitchen",
  ])
})

test("an id the set does not declare REFUSES, in the words a tool call gets", () => {
  // Not dropped: a message about a node, sent without the node, is a message
  // whose subject the agent has to guess at.
  const failure = refused(["order", "gone"])
  expect(failure._tag).toBe("NotFoundFailure")
  expect(failure.message).toContain("`gone`")
})

test("a near miss still says what it meant", () => {
  // The ops layer's own "did you mean", because this is the ops layer's own
  // refusal rather than a second one worded here.
  expect(refused(["ordr"]).message).toContain("order")
})

test("a mirror is refused naming the node it shows", () => {
  // Nothing in the panel can arm one — a row arms the node it SHOWS — so this
  // is a guard on a value off the wire rather than a case a person can reach.
  // A placement has no title of its own, so there is nothing to say about one.
  const failure = refused(["echo"])
  expect(failure._tag).toBe("UsageFailure")
  expect(failure.message).toContain("`order`")
})

// WHAT WAS PUT AWAY IS NOT A REFUSAL, and the header says why: archiving moves
// a record into an archive with its id intact, the doors that ask for it reach
// it (#226 took the default presence, never the way to ask), and "why did we
// put this away?" is a question to be able to ask. What the answer carries is
// the fact that changes what the agent should do with it.
test("an archived node resolves, and says that it was put away", () => {
  const set = setOf({
    "house.olai": HOUSE,
    "Archive.olai": `{"id":"tiles","ord":"a0","title":"the tiles nobody liked"}`,
  })
  const outcome = contextFor(readingOf(set), ["tiles"])
  expect(Result.isSuccess(outcome)).toBe(true)
  expect(Result.isSuccess(outcome) ? outcome.success : []).toEqual([
    {
      id: "tiles",
      title: "the tiles nobody liked",
      file: "Archive.olai",
      line: 1,
      path: [],
      archived: true,
    },
  ])
})

test("...and a live node says nothing about it at all", () => {
  // The format's rule for a field that holds nothing, kept on the wire: absent
  // rather than `false`, so an agent reading a corpus of these does not have to
  // filter a "no" out of every line.
  expect(resolved(["order"])[0]).not.toHaveProperty("archived")
})
