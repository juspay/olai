/**
 * THE SNAPSHOT READ — the tail, and the two refusals.
 *
 * This module is the one in this package with ARITHMETIC in it, and it shipped
 * with that arithmetic wrong: it passed `startLine: 120` to padi hoping for a
 * tail, and padi's `startLine` is an absolute line number from the start of
 * scrollback. Against a real padi that returns the empty string for any
 * terminal shorter than 120 lines — which is most of them, and which the pane
 * would draw as a legitimate empty snapshot. The fake padi did not implement
 * the clamp, so the e2e was green anyway.
 *
 * So the cases below are the ones that would have caught it: a SHORT screen
 * comes back whole, and a long one comes back as its END rather than its
 * middle. The fake padi implements kaval's real clamp now as well, so the same
 * claim is exercised through the wire.
 */

import { describe, expect, it } from "bun:test"
import { Effect } from "effect"

import { DEFAULT_LINES, screenText, tailLines } from "./screen.ts"

const AT = "2026-08-25T12:00:00-04:00"
const now = () => AT

/** A padi that returns a fixed screen — and records what it was ASKED, which
 *  is half of what these cases are about. */
const serving = (text: string) => {
  const asked: Array<{ id: string }> = []
  return {
    asked,
    read: (input: { id: string }) => {
      asked.push(input)
      return Effect.succeed(text)
    },
  }
}

const numbered = (count: number) =>
  Array.from({ length: count }, (_, line) => `line ${line + 1}`).join("\n")

describe("the tail", () => {
  it("returns a SHORT screen whole — the case the window bug returned empty for", () => {
    // Three lines, a hundred and twenty asked for. The old window sent
    // `startLine: 120`, which kaval clamps to `start=120 > end=3`, and the
    // answer was "". A fresh lane is exactly this shape.
    expect(tailLines(numbered(3), DEFAULT_LINES)).toBe("line 1\nline 2\nline 3")
  })

  it("returns the END of a long screen, not its middle", () => {
    const tail = tailLines(numbered(500), 3)
    expect(tail).toBe("line 498\nline 499\nline 500")
    // ...and asking for MORE returns more, which the window bug inverted.
    expect(tailLines(numbered(500), 10).split("\n")).toHaveLength(10)
  })

  it("drops the trailing blank rows before slicing, and keeps interior ones", () => {
    // A rendered buffer ends in the empty viewport below the cursor. Sliced
    // naively, `tail: 3` on a fresh shell is three blank lines — a real bug
    // kolu caught on its own MCP face, which is why its `tailLines` drops the
    // trailing run first. Blank lines BETWEEN content are what the terminal
    // printed and stay.
    expect(tailLines("$ ls\n\nout\n\n\n\n", 3)).toBe("$ ls\n\nout")
  })

  it("is total at the edges — an empty screen, and a zero tail", () => {
    expect(tailLines("", 10)).toBe("")
    expect(tailLines(numbered(3), 0)).toBe("")
  })
})

describe("the read", () => {
  it("sends the ID and NO WINDOW — the absolute line numbers are never used", async () => {
    const padi = serving(numbered(3))
    await Effect.runPromise(screenText(padi.read, "t1", undefined, now))
    // The whole point, structurally: one field. A window here would be the
    // absolute-addressing bug coming back.
    expect(padi.asked).toEqual([{ id: "t1" }])
  })

  it("stamps the moment of the READ, not of the frame", async () => {
    const answer = await Effect.runPromise(
      screenText(serving("hello").read, "t1", undefined, now),
    )
    expect(answer).toEqual({ text: "hello", at: AT })
  })

  it("refuses in WORDS when there is no padi", async () => {
    const refused = await Effect.runPromise(
      Effect.flip(screenText(null, "t1", undefined, now)),
    )
    expect(refused.reason).toBe("no-padi")
    expect(refused.says).toContain("not connected")
  })

  it("refuses in words when padi has no live screen", async () => {
    const refused = await Effect.runPromise(
      Effect.flip(
        screenText(() => Effect.fail(new Error("TerminalNotFound")), "t1", undefined, now),
      ),
    )
    expect(refused.reason).toBe("no-terminal")
    expect(refused.says).toContain("no live screen")
  })

  it("refuses rather than hanging when the far end DIES instead of failing", async () => {
    // A defect, not a declared failure — what a far end that fails with
    // something its schema does not admit sends down the wire. Uncaught, this
    // is a call that never settles and a pane stuck on "reading…" forever,
    // which is worse than any refusal.
    const refused = await Effect.runPromise(
      Effect.flip(
        screenText(() => Effect.die(new Error("boom")), "t1", undefined, now),
      ),
    )
    expect(refused.reason).toBe("no-terminal")
  })
})
