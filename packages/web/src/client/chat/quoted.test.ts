/**
 * WHAT A QUOTED SENTENCE HAS IN IT — the split, without a browser.
 *
 * The claim under test is a promise about somebody else's words: exactly the
 * runs between backticks become chips, everything else is the author's sentence
 * verbatim, and a body that never meant markup is never read as any. Nothing
 * here asserts a tag or a class — {@link ./quoted.ts} answers in runs, and what
 * a run is DRAWN as is {@link ./Quoted.tsx}'s.
 */

import { describe, expect, test } from "bun:test"

import { quotedRuns } from "./quoted.ts"

/** The whole sentence back, as the reader would read it off the page with the
 *  chips' own backticks gone. What every case below is measured against, so a
 *  split that lost or invented a character is caught wherever it happens. */
const readBack = (text: string): string =>
  quotedRuns(text).map((run) => run.text).join("")

describe("a sentence with nothing in it to mark", () => {
  test("comes back whole, as one plain run", () => {
    expect(quotedRuns("the lane is claimed")).toEqual([
      { code: false, text: "the lane is claimed" },
    ])
  })

  test("an empty body is no runs at all", () => {
    expect(quotedRuns("")).toEqual([])
  })

  test("newlines and spacing are the author's", () => {
    const said = "claimed\n\n  by the second step\n"
    expect(readBack(said)).toBe(said)
  })
})

describe("an id in backticks", () => {
  test("is a run of its own, with the ticks off", () => {
    expect(quotedRuns("on `lane-sd`.")).toEqual([
      { code: false, text: "on " },
      { code: true, text: "lane-sd" },
      { code: false, text: "." },
    ])
  })

  test("at the very start, with no empty run in front of it", () => {
    expect(quotedRuns("`lane-sd` is claimed")).toEqual([
      { code: true, text: "lane-sd" },
      { code: false, text: " is claimed" },
    ])
  })

  test("two of them, with the words between kept", () => {
    expect(quotedRuns("`lane-sd` then `lane-md`")).toEqual([
      { code: true, text: "lane-sd" },
      { code: false, text: " then " },
      { code: true, text: "lane-md" },
    ])
  })

  test("two side by side, with no empty run between them", () => {
    expect(quotedRuns("`a``b`")).toEqual([
      { code: true, text: "a" },
      { code: true, text: "b" },
    ])
  })

  test("across several lines of an account", () => {
    const said = "claiming `lane-sd`\nderived from `order`\n"
    expect(quotedRuns(said).filter((run) => run.code).map((run) => run.text))
      .toEqual(["lane-sd", "order"])
    expect(readBack(said)).toBe("claiming lane-sd\nderived from order\n")
  })
})

describe("what is left alone", () => {
  test("a tick that never closes is the author's own word", () => {
    expect(quotedRuns("run kolu` and see")).toEqual([
      { code: false, text: "run kolu` and see" },
    ])
  })

  test("... including one that would otherwise reach into the next paragraph", () => {
    // The refusal that matters most: a stray tick must not swallow the three
    // lines under it and draw somebody's whole account as a chip.
    const said = "a stray ` here\n\nand the account under it\n"
    expect(quotedRuns(said)).toEqual([{ code: false, text: said }])
  })

  test("an empty pair is two characters, not an empty chip", () => {
    expect(quotedRuns("wrote `` to it")).toEqual([{ code: false, text: "wrote `` to it" }])
  })

  test("markdown that is not a code span is not interpreted at all", () => {
    const said = "# not a heading\n- not a list\n**not bold** [not a link](x)"
    expect(quotedRuns(said)).toEqual([{ code: false, text: said }])
  })
})
