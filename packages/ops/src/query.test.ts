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
    "roadmap.jsonl": [
      `{"id":"now","ord":"a0","title":"Now"}`,
      `{"id":"now-sticky","parent":"now","ord":"a0","mirror":"sticky"}`,
      `{"id":"now-git","parent":"now","ord":"a1","mirror":"focus-git"}`,
      `{"id":"bugs","ord":"a1","title":"Bugs"}`,
      `{"id":"sticky","parent":"bugs","ord":"a0","title":"the header scrolls away","doing":true,"after":["git"],"see":["git"]}`,
      `{"id":"git","parent":"bugs","ord":"a1","title":"two git indicators","todo":true}`,
    ].join("\n"),
    "focus.jsonl": [
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

describe("placements", () => {
  /** WHERE ELSE this node is drawn — the id half of `remove_mirror`, and the
   *  only way to reach a placement a previous session made. */
  test("`mirrors` names every placement of a node, chains followed", () => {
    // `git` is placed twice: directly by `focus-git`, and through it by
    // `now-git`, which mirrors the mirror. Both are places `git` is drawn.
    expect(detail(at(), "git")?.mirrors).toEqual([
      { id: "now-git", file: "roadmap.jsonl", line: 3, parent: "now" },
      { id: "focus-git", file: "focus.jsonl", line: 2, parent: "focus" },
    ])
    expect(detail(at(), "sticky")?.mirrors).toEqual([
      { id: "now-sticky", file: "roadmap.jsonl", line: 2, parent: "now" },
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
        file: "roadmap.jsonl",
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
      "work.jsonl": [
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
