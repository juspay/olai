import { type OpFailure, type OutlineSet, type Reading } from "@olai/format"
import { readingOf, setOf } from "@olai/format/testlib"
import type { NodeContext } from "olai-plugin-chat/wire"
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
  const failure = refused(["order", "gone"])
  expect(failure._tag).toBe("NotFoundFailure")
  expect(failure.message).toContain("`gone`")
})

test("a near miss still says what it meant", () => {
  expect(refused(["ordr"]).message).toContain("order")
})

test("a mirror is refused naming the node it shows", () => {
  const failure = refused(["echo"])
  expect(failure._tag).toBe("UsageFailure")
  expect(failure.message).toContain("`order`")
})

test("an archived node resolves, with the archive it is in as its file", () => {
  const set = setOf({
    "house.olai": HOUSE,
    "_olai/Trash.olai": `{"id":"tiles","ord":"a0","title":"the tiles nobody liked"}`,
  })
  const outcome = contextFor(readingOf(set), ["tiles"])
  expect(Result.isSuccess(outcome)).toBe(true)
  expect(Result.isSuccess(outcome) ? outcome.success : []).toEqual([
    {
      id: "tiles",
      title: "the tiles nobody liked",
      file: "_olai/Trash.olai",
      trashed: true,
      line: 1,
      path: [],
    },
  ])
})
