/**
 * An outline the agent rewrote by hand, read as nodes.
 *
 * The claim under test is the design's own "never a text diff of a `.olai`",
 * made true of the FILE rather than of the tool: whatever wrote it, what a
 * reader gets is the node-level story in the vocabulary the Commit panel
 * already uses.
 */

import { describe, expect, test } from "bun:test"

import { outlineDiffOf } from "./outline.ts"

const OUTLINE = [
  `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
  `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets"}`,
].join("\n")

const rewritten = (oldText: string | null, newText: string) =>
  outlineDiffOf({ path: "house.olai", oldText, newText })

describe("an outline rewritten by hand", () => {
  test("a mark that appeared is the same word the Commit panel uses", () => {
    const marked = OUTLINE.replace(
      `"title":"order the cabinets"}`,
      `"title":"order the cabinets","done":"2026-08-12T10:00:00-04:00"}`,
    )
    const answer = rewritten(`${OUTLINE}\n`, `${marked}\n`)
    expect(answer).toEqual({
      _tag: "Changes",
      changes: [
        {
          file: "house.olai",
          id: "order",
          title: "order the cabinets",
          fields: ["done"],
          sort: "done",
        },
      ],
    })
  })

  test("a node that arrived and one that left are both told", () => {
    const answer = rewritten(
      `${OUTLINE}\n`,
      `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}\n` +
        `{"id":"tiles","parent":"kitchen","ord":"a2","title":"pick tiles"}\n`,
    )
    if (answer._tag !== "Changes") throw new Error("expected changes")
    expect(answer.changes.map((change) => [change.id, change.sort])).toEqual([
      ["tiles", "created"],
      ["order", "gone"],
    ])
  })

  test("a file that did not exist is every node created, not an unreadable side", () => {
    const answer = rewritten(null, `${OUTLINE}\n`)
    if (answer._tag !== "Changes") throw new Error("expected changes")
    expect(answer.changes.every((change) => change.sort === "created")).toBe(true)
  })

  test("a side that will not parse says which side, and offers no changes", () => {
    // Exactly how an agent hand-editing an outline goes wrong, and the reason
    // this is not a boolean: the side that broke is the news.
    expect(rewritten(`${OUTLINE}\n`, `${OUTLINE}\nnot json at all\n`)).toEqual({
      _tag: "Unreadable",
      side: "after",
    })
    expect(rewritten("not json at all\n", `${OUTLINE}\n`)).toEqual({
      _tag: "Unreadable",
      side: "before",
    })
  })

  test("a rewrite that moved no record has nothing to report", () => {
    // A reformat, a reordered key: the bytes moved and no node did. Saying
    // nothing is the honest answer, and it is what the panel draws as such.
    const answer = rewritten(`${OUTLINE}\n`, `${OUTLINE}\n\n`)
    expect(answer).toEqual({ _tag: "Changes", changes: [] })
  })
})
