import { NO_KINDS } from "@olai/format"
import { NO_SEARCH } from "@olai/ops"
import { CALLS, escapedIn, gaveOf, paragraphsIn, readsOf, uncalled } from "@olai/ops/testlib/tools"
import { expect, test } from "bun:test"
import { Effect, Schema } from "effect"

import { search } from "./matcher.ts"
import { tools } from "./tools.ts"

const DOOR = {
  nodes: ({ at, query, now }: {
    readonly at: unknown
    readonly query: unknown
    readonly now: string
    readonly kinds: unknown
  }) =>
    Effect.sync(() =>
      search(at as never, query as never, now, NO_KINDS)
    ),
}

const answers = () => gaveOf(DOOR as never, tools, "search")

const searchTool = () => {
  const found = readsOf(tools).find((tool) => tool.name === "nodes")
  if (found === undefined) throw new Error("`search_nodes` is not in this row's tool table")
  return found
}

test("every read this row declares is called here", () => {
  expect(uncalled(tools, "search")).toEqual([])
})

test("every hit decodes through the shape `search_nodes` declares", () => {
  const tool = searchTool()
  const decode = Schema.decodeUnknownSync(
    tool.answers as Schema.Codec<unknown, unknown, never, never>,
    { errors: "all", onExcessProperty: "error" },
  )
  for (const answer of answers()("nodes")) {
    expect(decode(answer)).toEqual(answer)
  }
  expect(answers()("nodes").length).toBe((CALLS["search_nodes"] ?? []).length)
})

test("the fixture reaches every optional field of a hit, so the check is not vacuous", () => {
  const searches = answers()("nodes")
  expect(searches[0]?.["hits"]).toMatchObject([
    { id: "paint", matched: "title", parent: "house" },
  ])
  expect(searches[1]?.["refusals"]).toBeArrayOfSize(1)
  expect(searches[3]?.["hits"]).toMatchObject([{ id: "paint" }])
  expect(searches[3]).not.toHaveProperty("refusals")
  expect(searches[4]?.["hits"]).toMatchObject([{ id: "paint", matched: "title" }])
  expect(searches[5]?.["hits"]).toMatchObject([{ id: "house", desc: "the note" }, { at: { kind: "document", path: "house.olai" }, title: "house" }])
})

test("with no matcher mounted, every query is no hits and the reason", () => {
  const tool = searchTool()
  const decode = Schema.decodeUnknownSync(
    tool.answers as Schema.Codec<unknown, unknown, never, never>,
    { errors: "all", onExcessProperty: "error" },
  )
  for (const answer of gaveOf(NO_SEARCH, tools, "search")("nodes")) {
    expect(decode(answer)).toEqual(answer)
    expect(answer["hits"]).toEqual([])
    expect(answer["total"]).toBe(0)
    expect(answer["refusals"]).toBeArrayOfSize(1)
  }
})

test("no tool describes itself with an escaped newline", () => {
  expect(escapedIn(tools)).toEqual([])
  expect(paragraphsIn(tools, "nodes")).toBeGreaterThan(0)
})
