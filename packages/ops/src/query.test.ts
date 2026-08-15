/**
 * What an agent READS of a set — values in, values out, no disk and no
 * protocol, the same bargain {@link ./plan.test.ts} makes about writes.
 *
 * The half these tests exist for is the half a write cannot reach: a placement
 * and an edge are both written BY ID, so a caller that cannot read them back
 * can only guess. The wire tests in `@olai/server` cover one happy path each
 * through a real MCP client; this is where the shapes are pinned, because a
 * field dropped from a search hit would fail nothing over there.
 */

import type { OutlineSet } from "@olai/format"
import { describe, expect, test } from "bun:test"

import { setOf } from "./fixtures.testlib.ts"
import { detail, index, search } from "./query.ts"

/** A ledger: items in their sections, and a `Now` list made of placements —
 *  including one that CHAINS through another placement, which is the case
 *  every answer here has to follow rather than report as itself. */
const LEDGER = (): OutlineSet =>
  setOf({
    "roadmap.olai": [
      `{"id":"now","ord":"a0","title":"Now"}`,
      `{"id":"now-sticky","parent":"now","ord":"a0","mirror":"sticky"}`,
      `{"id":"now-git","parent":"now","ord":"a1","mirror":"focus-git"}`,
      `{"id":"bugs","ord":"a1","title":"Bugs"}`,
      `{"id":"sticky","parent":"bugs","ord":"a0","title":"the header scrolls away","doing":true,"after":["git"],"see":["git"]}`,
      `{"id":"git","parent":"bugs","ord":"a1","title":"two git indicators","todo":true,"custom":{"pr":"https://github.com/juspay/olai/pull/176","agent":"claude-opus"}}`,
    ].join("\n"),
    "focus.olai": [
      `{"id":"focus","ord":"a0","title":"Focus"}`,
      // A mirror OF a mirror: `now-git` shows this, which shows `git`.
      `{"id":"focus-git","parent":"focus","ord":"a0","mirror":"git"}`,
    ].join("\n"),
  })

const at = () => index(LEDGER())

describe("the edges a node carries", () => {
  test("a search hit carries `after` and `see`, and omits what is not there", () => {
    const hits = search(at(), { text: "header" }).hits
    expect(hits[0]).toMatchObject({ id: "sticky", after: ["git"], see: ["git"] })
    // A node that points nowhere does not pretend to: absence is how the
    // format spells an empty list, and an answer follows the format.
    const other = search(at(), { text: "indicators" }).hits[0]
    expect(other).toMatchObject({ id: "git" })
    expect(other).not.toHaveProperty("after")
    expect(other).not.toHaveProperty("see")
  })

  test("a node read carries them too, and so does a child in its list", () => {
    const bugs = detail(at(), "bugs")
    expect(bugs?.children.find((child) => child.id === "sticky"))
      .toMatchObject({ after: ["git"] })
    expect(detail(at(), "sticky")).toMatchObject({ after: ["git"], see: ["git"] })
  })
})

/**
 * The custom map, on a node read — every named fact it carries, and nothing
 * invented for a node that carries none.
 *
 * Without it `set_prop` would be a write whose result no read could show, which
 * is the gap `see` and `after` were given their own fields on an answer to
 * close: a value written by id and unreadable can only be changed by guessing.
 */
describe("the properties a node carries", () => {
  test("a node read answers the map, verbatim", () => {
    expect(detail(at(), "git")?.custom).toEqual({
      pr: "https://github.com/juspay/olai/pull/176",
      agent: "claude-opus",
    })
    // Beside the fields, not instead of them: the mark is still `todo`.
    expect(detail(at(), "git")).toMatchObject({ todo: true, status: "todo" })
  })

  test("a node with no properties carries no map, rather than an empty one", () => {
    expect(detail(at(), "bugs")).not.toHaveProperty("custom")
  })
})

describe("placements", () => {
  /** WHERE ELSE this node is drawn — the id half of `remove_mirror`, and the
   *  only way to reach a placement a previous session made. */
  test("`mirrors` names every placement of a node, chains followed", () => {
    // `git` is placed twice: directly by `focus-git`, and through it by
    // `now-git`, which mirrors the mirror. Both are places `git` is drawn.
    expect(detail(at(), "git")?.mirrors).toEqual([
      { id: "now-git", file: "roadmap.olai", line: 3, parent: "now" },
      { id: "focus-git", file: "focus.olai", line: 2, parent: "focus" },
    ])
    expect(detail(at(), "sticky")?.mirrors).toEqual([
      { id: "now-sticky", file: "roadmap.olai", line: 2, parent: "now" },
    ])
  })

  test("a node nothing shows says nothing rather than an empty list", () => {
    expect(detail(at(), "bugs")).not.toHaveProperty("mirrors")
  })

  /** WHAT IS ON THE LIST — the question the ledger is read with, and the one
   *  the ops layer could not answer at all before the 2026-08-11 review. */
  test("`placed` lists what a curated list holds, in sibling order", () => {
    const now = detail(at(), "now")
    expect(now?.placed?.map((entry) => entry.id)).toEqual(["now-sticky", "now-git"])
    // Each entry carries the NODE it shows — situated, so the reader has the
    // item's mark and where it is defined, not just an id.
    expect(now?.placed?.[0]).toMatchObject({
      id: "now-sticky",
      parent: "now",
      shows: {
        id: "sticky",
        title: "the header scrolls away",
        status: "doing",
        file: "roadmap.olai",
        path: ["Bugs"],
      },
    })
    // …and a chain is followed to the node at its end rather than reported as
    // the placement in the middle.
    expect(now?.placed?.[1]?.shows).toMatchObject({ id: "git", status: "todo" })
  })

  test("the placements are not the node's own children", () => {
    // `children` is what hangs off it; `placed` is what it points at. A Now
    // section has no children at all.
    expect(detail(at(), "now")?.children).toEqual([])
    expect(detail(at(), "bugs")).not.toHaveProperty("placed")
  })

  test("a search never answers with a placement", () => {
    // A hit for a mirror would be the same node twice, once at a place no
    // write lands.
    expect(search(at(), { text: "git" }).hits.map((hit) => hit.id))
      .not.toContain("now-git")
  })
})

describe("the tags a node carries", () => {
  /** A set with both sigils, including the same NAME under each — which is the
   *  whole reason the sigil is reported. */
  const TAGGED = (): OutlineSet =>
    setOf({
      "work.olai": [
        `{"id":"call","ord":"a0","title":"call @alice about #alice/onboarding"}`,
        `{"id":"plain","ord":"a1","title":"nothing to see here"}`,
      ].join("\n"),
    })

  // AS WRITTEN, sigil and all. `#alice` and `@alice` are two different tags
  // (`@olai/format`'s TAG_SIGILS), so a list of bare names could not say which
  // of them a node carries — and this is the shape an agent reads off
  // `read_node`, which nothing on the wire side would notice losing.
  test("a node read reports its tags as they are written", () => {
    expect(detail(index(TAGGED()), "call")?.tags).toEqual([
      "@alice",
      "#alice/onboarding",
    ])
  })

  test("a node with none reports an empty list rather than nothing", () => {
    expect(detail(index(TAGGED()), "plain")?.tags).toEqual([])
  })

  // The index's own half of the same contract: a tag is searchable BARE and as
  // written, so a bare word still finds it and a sigil narrows to one
  // namespace.
  test("a tag is found by its name and by its written form", () => {
    const set = index(TAGGED())
    expect(search(set, { text: "alice" }).hits.map((hit) => hit.id)).toEqual(["call"])
    expect(search(set, { text: "@alice" }).hits.map((hit) => hit.id)).toEqual(["call"])
    expect(search(set, { text: "#alice" }).hits.map((hit) => hit.id)).toEqual(["call"])
  })
})

/**
 * The operators, from THIS side of the seam.
 *
 * What each one selects is `@olai/format`'s (`filter.test.ts` holds the
 * grammar); what is pinned here is that this procedure is a caller of it —
 * that an agent typing `is:done` gets the same reading the browser's filter
 * gets, that a scope is askable, and that the two things this layer still
 * decides for itself (the shortlist and what it says about a hit) survive a
 * query that named no words.
 */
describe("a query is words and operators", () => {
  const WORK = (): OutlineSet =>
    setOf({
      "work.olai": [
        `{"id":"trip","ord":"a0","title":"the trip"}`,
        `{"id":"book","parent":"trip","ord":"a0","title":"book the flights","done":"2026-08-03"}`,
        `{"id":"pack","parent":"trip","ord":"a1","title":"pack","todo":true,"desc":"the small case"}`,
        `{"id":"house","ord":"a1","title":"the house"}`,
        `{"id":"paint","parent":"house","ord":"a0","title":"paint the hall","done":"2026-08-09"}`,
      ].join("\n"),
      "Archive.olai": `{"id":"old","ord":"a0","title":"an old trip","done":"2026-01-01"}`,
    })

  const ids = (query: Parameters<typeof search>[1]): ReadonlyArray<string> =>
    search(index(WORK()), query).hits.map((hit) => hit.id)

  test("an operator gates the words, and the two compose", () => {
    expect(ids({ text: "is:done" })).toEqual(["book", "paint"])
    // "the" is in all five (`pack` carries it in its note); the clause is what
    // cuts them, and the ranking is still this layer's.
    expect(ids({ text: "the is:done" })).toEqual(["book", "paint"])
    expect(ids({ text: "the -is:done" })).toEqual(["trip", "house", "pack"])
    expect(ids({ text: "has:desc" })).toEqual(["pack"])
    expect(ids({ text: "date:2026-08-09" })).toEqual(["paint"])
  })

  test("a refused operator answers with nothing rather than with half the query", () => {
    expect(ids({ text: "is:blocked trip" })).toEqual([])
  })

  // ...AND WITH THE REASON. This layer is the only one that has both the
  // parser's answer and a caller to hand it to, so a door that dropped it would
  // answer `is:blocked` with an empty list and no explanation — the silent
  // failure the refusals were written to prevent. Three of the four doors read
  // it from here.
  test("a refused query carries the reason to whoever asked", () => {
    const answer = search(index(WORK()), { text: "is:blocked trip" })
    expect(answer.refusals).toEqual([{
      token: "is:blocked",
      reason: "is: takes one of done, doing, todo, marked, archived",
    }])
    // As TYPED — an agent that echoed the folded token back to a person would
    // be quoting them wrongly.
    expect(search(index(WORK()), { text: "is:BLOCKED" }).refusals?.[0]?.token)
      .toBe("is:BLOCKED")
  })

  // An empty query and a refused one both answer with no hits, and only one of
  // them has anything to say about it: there is no question to have refused.
  test("a query nobody typed carries no refusal", () => {
    const answer = search(index(WORK()), { text: "  " })
    expect(answer).toEqual({ hits: [], total: 0 })
    expect(answer).not.toHaveProperty("refusals")
    expect(search(index(WORK()), { text: "trip" })).not.toHaveProperty("refusals")
  })

  test("the archive is out of it unless the query says so", () => {
    expect(ids({ text: "trip" })).toEqual(["trip"])
    expect(ids({ text: "trip is:archived" })).toEqual(["old"])
  })

  test("a scope narrows to one outline, or to one node and what is beneath it", () => {
    expect(ids({ text: "is:done", file: "work.olai" })).toEqual(["book", "paint"])
    expect(ids({ text: "is:done", under: "trip" })).toEqual(["book"])
    expect(ids({ text: "is:done", file: "Archive.olai", under: "trip" })).toEqual([])
  })

  test("a hit says which field carried the words — and says nothing when none did", () => {
    expect(search(index(WORK()), { text: "flights" }).hits[0])
      .toMatchObject({ id: "book", matched: "title" })
    const marked = search(index(WORK()), { text: "is:todo" }).hits[0]
    expect(marked).toMatchObject({ id: "pack" })
    expect(marked).not.toHaveProperty("matched")
  })

  test("a finished node still loses ties, and the total is still uncapped", () => {
    // `book` and `paint` both match on their title; `book` is written first
    // and both are done, so order is the file's and the count is honest.
    const answer = search(index(WORK()), { text: "is:done", limit: 1 })
    expect(answer.hits.map((hit) => hit.id)).toEqual(["book"])
    expect(answer.total).toBe(2)
  })
})
