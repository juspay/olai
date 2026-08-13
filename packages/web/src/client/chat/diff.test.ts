/**
 * The line diff, as arithmetic.
 *
 * No DOM and no panel: the whole of what a diff is is a function from two texts
 * to the lines that differ, and that is a thing to hold to its promises without
 * starting anything. What the tests are about is the three properties that make
 * the result READABLE rather than merely correct — a replaced line reads as the
 * old one above the new one, an edit in a long file does not arrive behind
 * hundreds of lines of context, and a file that was created says so.
 */

import { describe, expect, test } from "bun:test"

import { diffOf } from "./diff.ts"

/** The rendering as a compact string, so a case reads as what it looks like:
 *  `-` gone, `+` arrived, ` ` unchanged, `…` a run of unchanged lines. */
const shown = (before: string | null, after: string): ReadonlyArray<string> =>
  diffOf(before, after).lines.map((line) =>
    line.kind === "gap"
      ? `… ${line.hidden}`
      : `${line.kind === "add" ? "+" : line.kind === "remove" ? "-" : " "}${line.text}`
  )

describe("what changed between two texts", () => {
  test("a replaced line is the old one struck out above the new one", () => {
    expect(shown("one\ntwo\nthree\n", "one\nTWO\nthree\n")).toEqual([
      " one",
      "-two",
      "+TWO",
      " three",
    ])
  })

  test("an insertion is an addition and nothing else", () => {
    expect(shown("one\ntwo\n", "one\nand a half\ntwo\n")).toEqual([
      " one",
      "+and a half",
      " two",
    ])
  })

  test("a trailing newline is a terminator, not a line", () => {
    // Without this, appending to a file reads as the last (empty) line
    // changing and a line arriving — two changes where there was one.
    const diff = diffOf("one\n", "one\ntwo\n")
    expect(diff.added).toBe(1)
    expect(diff.removed).toBe(0)
  })

  test("a file that did not exist says so", () => {
    const diff = diffOf(null, "hello\n")
    expect(diff.created).toBe(true)
    expect(diff.added).toBe(1)
  })

  test("the counts are what the header will draw", () => {
    const diff = diffOf("a\nb\nc\n", "a\nB\nc\nd\n")
    expect([diff.added, diff.removed]).toEqual([2, 1])
  })

  test("unchanged runs collapse, so a change is never buried under context", () => {
    // A one-line edit in the middle of a long file. Two lines of context
    // either side, and the rest is a gap that says how much it stands for —
    // which is what makes a view trimmed to its first lines show the CHANGE.
    const long = Array.from({ length: 40 }, (_, at) => `line ${at}`)
    const edited = [...long]
    edited[20] = "line twenty, rewritten"
    const lines = shown(`${long.join("\n")}\n`, `${edited.join("\n")}\n`)
    expect(lines).toEqual([
      "… 18",
      " line 18",
      " line 19",
      "-line 20",
      "+line twenty, rewritten",
      " line 21",
      " line 22",
      "… 17",
    ])
  })

  test("two identical texts have nothing to draw", () => {
    const diff = diffOf("one\ntwo\n", "one\ntwo\n")
    expect([diff.added, diff.removed]).toEqual([0, 0])
    expect(diff.lines.every((line) => line.kind === "gap")).toBe(true)
  })

  test("a rewrite past the budget is still answered, and quickly", () => {
    // The comparison is quadratic, so it is bounded: past the budget the two
    // sides are reported as unrelated rather than compared cell by cell. What
    // must not happen is a frozen tab, and what must still be true is that
    // every line of both sides is accounted for.
    const before = Array.from({ length: 900 }, (_, at) => `was ${at}`).join("\n")
    const after = Array.from({ length: 900 }, (_, at) => `now ${at}`).join("\n")
    const started = performance.now()
    const diff = diffOf(before, after)
    expect(performance.now() - started).toBeLessThan(500)
    expect([diff.added, diff.removed]).toEqual([900, 900])
    // ...and it SAYS it gave up, which is the half that matters on screen: every
    // row is a change, so a trimmed view shows the top of the old file, and a
    // reader not told that is reading something that looks like an ordinary
    // diff and is not one.
    expect(diff.wholesale).toBe(true)
  })

  test("an ordinary edit is compared rather than given up on", () => {
    expect(diffOf("one\ntwo\n", "one\nTWO\n").wholesale).toBe(false)
    // A big file with a small edit is the ordinary case and must stay on the
    // compared side of the budget: the common ends come off before the table
    // is sized, so what is compared is the change and not the document.
    const long = Array.from({ length: 2000 }, (_, at) => `line ${at}`)
    const edited = [...long]
    edited[900] = "line nine hundred, rewritten"
    expect(diffOf(`${long.join("\n")}\n`, `${edited.join("\n")}\n`).wholesale).toBe(false)
  })

  test("line numbers are the two files' own", () => {
    const diff = diffOf("one\ntwo\nthree\n", "one\nthree\n")
    const gone = diff.lines.find((line) => line.kind === "remove")
    expect([gone?.before, gone?.after]).toEqual([2, null])
    const last = diff.lines[diff.lines.length - 1]
    expect([last?.before, last?.after]).toEqual([3, 2])
  })
})
