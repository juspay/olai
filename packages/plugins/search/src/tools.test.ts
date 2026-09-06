/**
 * `search_nodes` ANSWERS THE SHAPE ITS OWN ENTRY DECLARES — the same walk
 * `olai-plugin-outlines` and `olai-plugin-markdown` run over their tables, with
 * this row's matcher behind the door.
 *
 * The claim, and the incident behind it, are the harness's: object-literal
 * freshness is lost through a `.map`, so a field DROPPED from a declaration
 * still compiles at the one place it is produced, and every consumer encoding
 * against the declaration then drops it in silence
 * (https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/surface-mcp-positions.md).
 * That is not hypothetical here: SEARCH is the door it happened through.
 *
 * So the walk is a harness (`@olai/ops/testlib/tools`) run TWICE IN THIS FILE,
 * over the one table this row declares:
 *
 *   - with the matcher, which is the only way the hit shapes are reached at all;
 *   - with `NO_SEARCH`, which pins what an agent is told on a serve that mounts
 *     no matcher at all. That used to be `@olai/ops`' own run, back when the
 *     tool was in its table; the tool is this row's now (juspay/olai#546), so
 *     the answer a serve gives WITHOUT this row is asserted where the tool is.
 *
 * The fixture is the same one either way, because two copies of a maximal set is
 * two things to keep maximal.
 *
 * OFF THE TABLE rather than off {@link ./matcher.ts} directly: `Query.search`
 * is not what an agent calls, `search_nodes` is, and the envelope between them
 * is exactly the part a test against the function would not see.
 */

import { NO_KINDS } from "@olai/format"
import { NO_SEARCH } from "@olai/ops"
import { CALLS, escapedIn, gaveOf, paragraphsIn, readsOf, uncalled } from "@olai/ops/testlib/tools"
import { expect, test } from "bun:test"
import { Effect, Schema } from "effect"

import { search } from "./matcher.ts"
import { tools } from "./tools.ts"

/** This row's door, exactly as {@link ./server.ts} offers it — minus the table,
 *  which changes no answer and is soaked in `./table.test.ts`. */
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

const answers = () => gaveOf(DOOR as never, tools)

const searchTool = () => {
  const found = readsOf(tools).find((tool) => tool.name === "search_nodes")
  if (found === undefined) throw new Error("`search_nodes` is not in this row's tool table")
  return found
}

test("every read this row declares is called here", () => {
  expect(uncalled(tools)).toEqual([])
})

test("every hit decodes through the shape `search_nodes` declares", () => {
  const tool = searchTool()
  const decode = Schema.decodeUnknownSync(
    tool.answers as Schema.Codec<unknown, unknown, never, never>,
    { errors: "all", onExcessProperty: "error" },
  )
  for (const answer of answers()("search_nodes")) {
    // Compared with what went in, so the assertion is "this IS the shape"
    // rather than "this parses" — a decode that dropped a field would
    // otherwise pass.
    expect(decode(answer)).toEqual(answer)
  }
  // …and the calls are the harness's, so a query added there is asked here.
  expect(answers()("search_nodes").length).toBe((CALLS["search_nodes"] ?? []).length)
})

test("the fixture reaches every optional field of a hit, so the check is not vacuous", () => {
  const searches = answers()("search_nodes")
  expect(searches[0]?.["hits"]).toMatchObject([
    { id: "paint", matched: "title", parent: "house" },
  ])
  // A query the grammar could not read carries the reason rather than an
  // empty list with nothing to say.
  expect(searches[1]?.["refusals"]).toBeArrayOfSize(1)
  // And a relative word is counted from THE OPS LAYER'S CLOCK — the one a
  // `done` is stamped with, which is what the door hands the grammar. `paint`
  // was finished at the fixture clock's own instant, so `date:today` finds it:
  // a row that read a clock of its own would answer this with nothing, which is
  // the whole reason `now` is a field of the door rather than a `new Date()`
  // on this side of it.
  expect(searches[3]?.["hits"]).toMatchObject([{ id: "paint" }])
  expect(searches[3]).not.toHaveProperty("refusals")
  // A quoted PHRASE and an `OR` group reach this door too — the tool's own
  // `text` prose spells both, and a schema that decoded the words and not
  // these would be the door advertising a grammar it does not answer.
  expect(searches[4]?.["hits"]).toMatchObject([{ id: "paint", matched: "title" }])
  // And the note, when the query asked for it — the one field of a record a hit
  // does not carry by default, reached here so the decode above is not vacuous
  // about it.
  expect(searches[5]?.["hits"]).toMatchObject([{ id: "house", desc: "the note" }])
})

/**
 * WHAT AN AGENT IS TOLD WHEN NOBODY IS SEARCHING — the same six queries,
 * through the same tool, over a serve that mounts no matcher. Every one of them
 * is no hits AND THE REASON, quoting what the reader typed: the shape a door
 * already draws for a query the grammar could not read, spent on a serve that
 * has no grammar to read it with.
 *
 * It is asserted here rather than in `@olai/ops` because the TOOL is here: a
 * serve without this row offers no `search_nodes` at all, and what `NO_SEARCH`
 * is for is the serve that has the row's tool reaching a door nobody stands
 * behind. The decode still has to hold, and the refusal envelope is a shape
 * somebody reads.
 */
test("with no matcher mounted, every query is no hits and the reason", () => {
  const tool = searchTool()
  const decode = Schema.decodeUnknownSync(
    tool.answers as Schema.Codec<unknown, unknown, never, never>,
    { errors: "all", onExcessProperty: "error" },
  )
  for (const answer of gaveOf(NO_SEARCH, tools)("search_nodes")) {
    expect(decode(answer)).toEqual(answer)
    expect(answer["hits"]).toEqual([])
    expect(answer["total"]).toBe(0)
    expect(answer["refusals"]).toBeArrayOfSize(1)
  }
})

/** WHAT AN AGENT ACTUALLY READS — the flat ban {@link escapedIn} argues, over
 *  this row's table, and the paragraph breaks really being there in the one
 *  description that means to have them. */
test("no tool describes itself with an escaped newline", () => {
  expect(escapedIn(tools)).toEqual([])
  expect(paragraphsIn(tools, "search_nodes")).toBeGreaterThan(0)
})
