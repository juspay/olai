import { describe, expect, it } from "bun:test"
import { Effect } from "effect"

import { DEFAULT_LINES, screenText, tailLines } from "./screen.ts"

const AT = "2026-08-25T12:00:00-04:00"
const now = () => AT

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
    expect(tailLines(numbered(3), DEFAULT_LINES)).toBe("line 1\nline 2\nline 3")
  })

  it("returns the END of a long screen, not its middle", () => {
    const tail = tailLines(numbered(500), 3)
    expect(tail).toBe("line 498\nline 499\nline 500")
    expect(tailLines(numbered(500), 10).split("\n")).toHaveLength(10)
  })

  it("drops the trailing blank rows before slicing, and keeps interior ones", () => {
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
    const refused = await Effect.runPromise(
      Effect.flip(
        screenText(() => Effect.die(new Error("boom")), "t1", undefined, now),
      ),
    )
    expect(refused.reason).toBe("no-terminal")
  })
})
