/**
 * The pieces, folded and laid back onto their row.
 *
 * The claim under test is the one the whole two-member arrangement rests on:
 * the join is TOTAL and IDEMPOTENT, so a tab that was handed the row and the
 * pieces a moment apart — in either order, with either one ahead — reads the
 * same string as a tab that has been listening since the first token.
 */

import type { Saying } from "@olai/surface"
import { describe, expect, test } from "bun:test"

import { grownText, type Growing, TRANSCRIPT_TAIL } from "./saying.ts"

const piece = (of: string, at: number, text: string): readonly [string, Saying] => [
  `${of}#${at}`,
  { of, at, text },
]

const seeded = (...pieces: ReadonlyArray<readonly [string, Saying]>): Growing =>
  TRANSCRIPT_TAIL.init(pieces)

const stepped = (
  held: Growing,
  upserts: ReadonlyArray<readonly [string, Saying]>,
  removes: ReadonlyArray<string> = [],
): Growing =>
  TRANSCRIPT_TAIL.step(held, {
    kind: "delta",
    upserts: upserts.map(([key, value]) => [key, value] as [string, Saying]),
    removes: [...removes],
  })

const row = (text: string) => ({ text })

describe("the fold", () => {
  test("pieces of one row join in offset order, whatever order they arrive in", () => {
    const held = stepped(seeded(), [piece("agent:1", 5, "second"), piece("agent:1", 0, "first")])
    expect(held.tail).toEqual({ of: "agent:1", at: 0, text: "firstsecond" })
  })

  test("a snapshot is folded exactly as the frames would have been", () => {
    expect(seeded(piece("agent:1", 0, "one "), piece("agent:1", 4, "two")).tail)
      .toEqual({ of: "agent:1", at: 0, text: "one two" })
  })

  test("a frame that moved nothing hands back the accumulator it was holding", () => {
    // What this buys is at the reader's end: the memos over this settle, so a
    // frame about somebody else's member does not wake a panel of rows.
    const held = stepped(seeded(), [piece("agent:1", 0, "x")])
    expect(stepped(held, [], ["never-seen"])).toBe(held)
  })

  test("removing every piece leaves no tail", () => {
    const held = stepped(seeded(), [piece("agent:1", 0, "gone")])
    expect(stepped(held, [], ["agent:1#0"]).tail).toBeNull()
  })

  test("the newest row's pieces are the tail", () => {
    const held = stepped(seeded(), [piece("agent:1", 0, "old")])
    expect(stepped(held, [piece("agent:2", 0, "new")]).tail?.of).toBe("agent:2")
  })

  test("a run stops at a hole rather than gluing across one", () => {
    // Pieces are contiguous by construction, so a gap is a piece this tab was
    // never handed — and a string that jumped it would be text in the wrong
    // order presented as the answer.
    const held = stepped(seeded(), [piece("agent:1", 0, "near"), piece("agent:1", 99, "far")])
    expect(held.tail).toEqual({ of: "agent:1", at: 0, text: "near" })
  })
})

describe("the join", () => {
  test("a tail past the row's text adds exactly the part past it", () => {
    expect(grownText(row("Hello"), { of: "agent:1", at: 5, text: ", world" }))
      .toBe("Hello, world")
  })

  test("a tail the row already carries adds nothing", () => {
    // What a tab handed a fresh snapshot sees: the row's text is complete as
    // far as it goes, so a piece inside it is a piece already folded in.
    expect(grownText(row("Hello, world"), { of: "agent:1", at: 5, text: ", world" }))
      .toBe("Hello, world")
  })

  test("a tail that straddles the row's end contributes only the overlap's tail", () => {
    expect(grownText(row("Hello, w"), { of: "agent:1", at: 5, text: ", world" }))
      .toBe("Hello, world")
  })

  test("a tail that starts past the row's text leaves the row alone", () => {
    expect(grownText(row("Hello"), { of: "agent:1", at: 40, text: "later" })).toBe("Hello")
  })

  test("folding the same tail twice says the same thing as folding it once", () => {
    const tail = { of: "agent:1", at: 5, text: ", world" }
    const once = grownText(row("Hello"), tail)
    expect(grownText(row(once), tail)).toBe(once)
  })

  test("a cancelled turn's row reads as the row, whatever is still held", () => {
    // A cancel publishes the row whole and takes its pieces off the wire — but
    // the two arrive as two frames, and between them a reader holds both. The
    // row is the last word either way.
    const settled = row("as far as it got")
    expect(grownText(settled, { of: "agent:1", at: 9, text: " it got" })).toBe("as far as it got")
  })
})
