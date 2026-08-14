/**
 * One search, two faces, and the half a type cannot check.
 *
 * {@link ./search.ts}'s assertions prove the two spellings are the same TYPE.
 * What they cannot prove is that the wire schema ACCEPTS what the ops layer
 * actually produces: a schema is refinements as well as fields, and `Schema.Int`
 * on `line` and `total`, `Schema.Literals` on `status` and `matched`, are four
 * places where a value the agent's `search_nodes` hands over verbatim could be
 * rejected — or quietly reshaped — on its way to a browser.
 *
 * So this encodes a real answer through the real procedure schema and asserts
 * the two are the same VALUE, field for field. The fixture is chosen to put
 * every optional field on the wire at once: a hit with a mark, a hit with both
 * edge lists, and a hit with neither.
 */

import { setOf } from "@olai/format/testlib"
import { Query, type Reading } from "@olai/ops"
import { SearchAnswer, SearchRequest } from "@olai/surface"
import { expect, test } from "bun:test"
import { Schema } from "effect"

const BUGS = () =>
  setOf({
    "bugs.jsonl": [
      `{"id":"sticky","ord":"a0","title":"the header scrolls away","doing":true,"after":["git"],"see":["git"]}`,
      `{"id":"git","ord":"a1","title":"two git indicators in the header","todo":true}`,
      `{"id":"note","ord":"a2","title":"about the header","desc":"a bullet, not a task"}`,
    ].join("\n"),
  })

const reading = (): Reading => {
  const set = BUGS()
  return { set, derived: Query.index(set) }
}

/** The one thing worth saying twice: this is the SAME function the procedure
 *  binding calls (`runtime.ts`) and the same value `search_nodes` answers with
 *  (`@olai/ops`' tool table), so what is compared below is the product's two
 *  faces rather than two calls arranged to agree. */
const bothFaces = (request: SearchRequest) => {
  const answered = Query.search(reading().derived, request)
  return {
    /** What an agent gets: the ops layer's value, as `structuredContent`. */
    toAgent: answered,
    /** What a browser gets: the same value through the procedure's schema. */
    toBrowser: Schema.encodeUnknownSync(SearchAnswer)(answered) as unknown,
  }
}

test("the wire carries a search answer whole — every hit, every field", () => {
  const { toAgent, toBrowser } = bothFaces({ text: "header" })

  // Three hits, and between them every optional field the shape has.
  expect(toAgent.total).toBe(3)
  expect(toAgent.hits.map((hit) => hit.id).toSorted())
    .toEqual(["git", "note", "sticky"])

  // The assertion this file exists for: an agent and a person are looking at
  // the same rows, not at two renderings that happen to agree today.
  expect(toBrowser).toEqual(toAgent)
})

test("absence survives the encode — a bullet does not grow edges it has none of", () => {
  const { toBrowser } = bothFaces({ text: "about the header" })
  const [only] = (toBrowser as { hits: ReadonlyArray<Record<string, unknown>> }).hits
  expect(only).toMatchObject({ id: "note", matched: "title" })
  // The format spells an empty list as an absent field, and the wire has to
  // spell it the same way: a `see: []` arriving at a browser is a claim the
  // record never made.
  expect(only).not.toHaveProperty("see")
  expect(only).not.toHaveProperty("after")
  expect(only).not.toHaveProperty("status")
})

test("the cap and the total are both integers on the wire", () => {
  // `limit` is the field the two faces used to declare separately, and
  // `Schema.Int` on `total` is the refinement a type identity cannot see.
  const { toAgent, toBrowser } = bothFaces({ text: "header", limit: 1 })
  expect(toAgent.hits).toHaveLength(1)
  expect(toAgent.total).toBe(3)
  expect(toBrowser).toEqual(toAgent)
})

test("no words is no hits, and the empty answer crosses too", () => {
  const { toAgent, toBrowser } = bothFaces({ text: "   " })
  expect(toAgent).toEqual({ hits: [], total: 0 })
  expect(toBrowser).toEqual(toAgent)
})
