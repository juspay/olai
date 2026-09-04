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

import { diffOf, linesIn } from "./diff.ts"

/** The rendering as a compact string, so a case reads as what it looks like:
 *  `-` gone, `+` arrived, ` ` unchanged, `…` a run of unchanged lines. */
const shown = (before: string | null, after: string): ReadonlyArray<string> =>
  diffOf(before, after).lines.map((line) =>
    line.kind === "gap"
      ? `… ${line.hidden}`
      : `${line.kind === "add" ? "+" : line.kind === "remove" ? "-" : " "}${line.text}`
  )

/**
 * Replay a rendering back over the old text.
 *
 * This is the public contract of a line diff and the one thing the snapshots
 * below cannot state: applying the script to the old file must yield the new
 * one. A GAP is part of the script rather than a hole in it — it stands for the
 * unchanged lines under it, which are still in the old text at the cursor — so
 * replaying it is what makes the property hold over what is actually DRAWN
 * rather than over some un-collapsed intermediate nothing renders.
 *
 * It walks the old file with one cursor: everything that consumes an old line
 * advances it, everything that produces a new line appends. A row whose index
 * is off by one therefore either takes the wrong text or leaves the cursor in
 * the wrong place, and the answer stops being the new file.
 */
const rebuilt = (before: string | null, after: string): ReadonlyArray<string> => {
  const was = linesIn(before ?? "")
  const built: Array<string> = []
  let at = 0
  for (const line of diffOf(before, after).lines) {
    switch (line.kind) {
      case "gap":
        built.push(...was.slice(at, at + line.hidden))
        at += line.hidden
        break
      case "same":
        built.push(line.text)
        at++
        break
      case "remove":
        at++
        break
      case "add":
        built.push(line.text)
        break
    }
  }
  return built
}

/**
 * How many lines two files actually share, computed the plain way.
 *
 * An ORACLE, and a second implementation on purpose: a forward table with no
 * backtrack, no prefix strip, no budget and no collapsing — a third of the code
 * under test, small enough to check by hand on the cases below. What it holds
 * the rendering to is the one thing that is NOT a matter of taste: a diff may
 * choose any script it likes among the shortest, but how many lines it KEEPS is
 * not a choice, and a comparison table that reads the wrong neighbour quietly
 * keeps fewer — a bigger, noisier diff of the same two files, which
 * reconstructs perfectly and is still wrong.
 */
const shared = (was: ReadonlyArray<string>, now: ReadonlyArray<string>): number => {
  const table = Array.from(
    { length: was.length + 1 },
    () => new Array<number>(now.length + 1).fill(0),
  )
  for (let i = 1; i <= was.length; i++) {
    for (let j = 1; j <= now.length; j++) {
      table[i]![j] = was[i - 1] === now[j - 1]
        ? table[i - 1]![j - 1]! + 1
        : Math.max(table[i - 1]![j]!, table[i]![j - 1]!)
    }
  }
  return table[was.length]![now.length]!
}

/** How many unchanged lines a rendering kept, gaps included — a gap is a run of
 *  them that is not drawn, not a run that was given up on. */
const kept = (before: string | null, after: string): number =>
  diffOf(before, after).lines.reduce(
    (total, line) =>
      total + (line.kind === "same" ? 1 : line.kind === "gap" ? line.hidden : 0),
    0,
  )

/** Every pair the property is checked over, named. The list is the point: the
 *  table below the prefix/suffix strip is only reached by pairs that differ at
 *  BOTH ends, and those are the ones a snapshot suite is least likely to
 *  contain. */
const PAIRS: ReadonlyArray<readonly [string, string | null, string]> = [
  ["identical", "one\ntwo\n", "one\ntwo\n"],
  ["an insertion", "one\ntwo\n", "one\nand a half\ntwo\n"],
  ["a deletion", "one\ntwo\nthree\n", "one\nthree\n"],
  ["a replacement", "one\ntwo\nthree\n", "one\nTWO\nthree\n"],
  ["a file that did not exist", null, "hello\nthere\n"],
  ["a file emptied", "one\ntwo\n", ""],
  ["an empty file written", "", "one\ntwo\n"],
  ["no trailing newline on either side", "one\ntwo", "one\nTWO"],
  ["a trailing newline arriving", "one\ntwo", "one\ntwo\n"],
  // Prefix and suffix strip cannot eat this: the two differ at both ends and
  // the only thing they share is in the middle, which is exactly what the
  // comparison table is for.
  ["a middle match", "a\nb\nc\n", "x\nb\ny\n"],
  ["a middle match with more around it", "a\nb\nc\nd\ne\n", "x\nb\nq\nd\nz\n"],
  ["an overlapping repeat", "x\nx\ny\n", "x\ny\n"],
  ["reordered lines", "one\ntwo\nthree\n", "three\ntwo\none\n"],
  // Three distinct lines, repeated — the shape where the comparison table
  // actually decides the path, rather than one where any walk finds the same
  // obvious alignment.
  ["a repeated alphabet", "a\na\nc\nb\nc\nb\n", "b\na\na\nc\n"],
  ["a repeated alphabet, the other way", "b\nc\nb\na\na\n", "a\na\nb\nb\nc\n"],
  ["nothing in common", "a\nb\nc\nd\n", "w\nx\ny\nz\n"],
  [
    "a one-line edit deep in a long file",
    `${Array.from({ length: 300 }, (_, at) => `line ${at}`).join("\n")}\n`,
    `${
      Array.from({ length: 300 }, (_, at) => (at === 150 ? "rewritten" : `line ${at}`))
        .join("\n")
    }\n`,
  ],
  [
    "a rewrite past the comparison budget",
    `${Array.from({ length: 600 }, (_, at) => `was ${at}`).join("\n")}\n`,
    `${Array.from({ length: 600 }, (_, at) => `now ${at}`).join("\n")}\n`,
  ],
]

describe("the rendering is a script that reconstructs the file", () => {
  for (const [name, before, after] of PAIRS) {
    test(name, () => {
      expect(rebuilt(before, after)).toEqual([...linesIn(after)])
    })
  }
})

describe("the rendering keeps every line the two files share", () => {
  for (const [name, before, after] of PAIRS) {
    // The over-budget pair is the one place keeping nothing is the ANSWER
    // rather than a failure — it says so on the value, and the header says so
    // on screen.
    if (diffOf(before, after).wholesale) continue
    test(name, () => {
      expect(kept(before, after)).toBe(shared(linesIn(before ?? ""), linesIn(after)))
    })
  }

  test("a shared line in the middle is FOUND rather than replaced twice", () => {
    // Reconstruction alone cannot say this: "remove b, add b" rebuilds the file
    // perfectly and is what a comparison table with a poisoned neighbour
    // produces. The pair's only common line is one the prefix/suffix strip can
    // never reach, so the table is what has to find it.
    const same = diffOf("a\nb\nc\n", "x\nb\ny\n").lines
      .filter((line) => line.kind === "same")
      .map((line) => line.text)
    expect(same).toEqual(["b"])
  })

  test("a repeated alphabet is aligned as tightly as it can be", () => {
    // Two short sequences over three distinct lines, which is where a wrong
    // cell actually changes the path taken — every case above has an obvious
    // alignment the walk finds whatever the table says. Written down as the
    // exact script rather than as a count, because the ORDER is the other half
    // of what a reader sees.
    expect(shown("a\na\nc\nb\nc\nb\n", "b\na\na\nc\n")).toEqual([
      "+b",
      " a",
      " a",
      " c",
      "-b",
      "-c",
      "-b",
    ])
  })
})

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
