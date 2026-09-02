/**
 * The write story, over values.
 *
 * The payloads are the ops layer's own replies as an MCP result carries them —
 * `structuredContent` holding `Applied` plus the `did` the projection adds. The
 * near misses are the point, the way they are in {@link ./interpret.test.ts}: a
 * result from some other server, a refusal, a reply whose `sort` is a word this
 * codebase does not have. Every one of them must draw NOTHING rather than a
 * half-story, because the alternative to a story here is a folded blob of JSON
 * that was always there.
 */

import { describe, expect, test } from "bun:test"

import { wroteIn } from "./wrote.ts"

/** A tool result as the MCP call answers with one. */
const result = (structured: unknown) => ({
  content: [{ type: "text", text: "…" }],
  structuredContent: structured,
})

const MARKED = {
  did: "set_done",
  id: "order",
  title: "order the cabinets",
  file: "house.org",
  summary: "done: order the cabinets",
  sort: "done",
  rev: 4,
  why: "the write is waiting to be committed",
}

describe("what an olai write says for itself", () => {
  test("the reply's own classification is what the row will draw", () => {
    expect(wroteIn(result(MARKED))).toEqual({
      sort: "done",
      id: "order",
      title: "order the cabinets",
      file: "house.org",
      nudge: null,
    })
  })

  test("the node's ID rides along, which is what makes the row a reference", () => {
    // The reply has always carried it (`Applied.id`); until it crossed the wire
    // the panel could say WHICH node a write was about and still have nothing
    // to point at. A reply that names none says the same words and does not
    // point, rather than pointing at an empty string.
    const { id: _id, ...anonymous } = MARKED
    expect(wroteIn(result(anonymous))?.id).toBeNull()
    expect(wroteIn(result({ ...MARKED, id: 7 }))?.id).toBeNull()
  })

  test("a nudge rides along, because advice on a write that landed is news", () => {
    expect(wroteIn(result({ ...MARKED, nudge: "everything under `kitchen` is done" })))
      .toMatchObject({ nudge: "everything under `kitchen` is done" })
  })

  test("structured content handed straight through is read the same way", () => {
    // An adapter that forwards the structured half as the raw output rather
    // than the whole result. One `??` to tolerate, against a silent blank.
    expect(wroteIn(MARKED)).toMatchObject({ sort: "done", title: "order the cabinets" })
  })

  test("a write that changed no record has no word for it", () => {
    const { sort: _sort, ...unchanged } = MARKED
    expect(wroteIn(result(unchanged))?.sort).toBeNull()
  })

  test("a classification this codebase does not have is not passed on", () => {
    // Checked against the format's own list rather than cast: a word the panel
    // has no phrase for would ride the wire and draw a blank where the story
    // goes.
    expect(wroteIn(result({ ...MARKED, sort: "vandalised" }))?.sort).toBeNull()
  })

  test("anything that is not one of our replies draws nothing", () => {
    // Somebody else's MCP server, a refusal (which carries no `did` and is
    // drawn as a refusal row of its own), and the two empties.
    expect(wroteIn(result({ terminals: ["one", "two"] }))).toBeUndefined()
    expect(wroteIn(result({ kind: "not-found", message: "no such node" }))).toBeUndefined()
    expect(wroteIn(null)).toBeUndefined()
    expect(wroteIn("done")).toBeUndefined()
  })
})
