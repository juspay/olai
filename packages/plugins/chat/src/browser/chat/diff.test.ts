import { describe, expect, test } from "bun:test"

import { diffOf } from "./diff.ts"

const shown = (before: string | null, after: string): ReadonlyArray<string> =>
  diffOf(before, after).lines.map((line) =>
    line.kind === "gap"
      ? `… ${line.hidden}`
      : `${line.kind === "add" ? "+" : line.kind === "remove" ? "-" : " "}${line.text}`
  )

const rebuilt = (before: string | null, after: string): ReadonlyArray<string> => {
  const was = diffOf(before, after).was
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

const kept = (before: string | null, after: string): number =>
  diffOf(before, after).lines.reduce(
    (total, line) =>
      total + (line.kind === "same" ? 1 : line.kind === "gap" ? line.hidden : 0),
    0,
  )

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
  ["a middle match", "a\nb\nc\n", "x\nb\ny\n"],
  ["a middle match with more around it", "a\nb\nc\nd\ne\n", "x\nb\nq\nd\nz\n"],
  ["an overlapping repeat", "x\nx\ny\n", "x\ny\n"],
  ["reordered lines", "one\ntwo\nthree\n", "three\ntwo\none\n"],
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
      expect(rebuilt(before, after)).toEqual([...diffOf(before, after).now])
    })
  }
})

describe("the rendering keeps every line the two files share", () => {
  for (const [name, before, after] of PAIRS) {
    if (diffOf(before, after).kind === "replaced") continue
    test(name, () => {
      const diff = diffOf(before, after)
      expect(kept(before, after)).toBe(shared(diff.was, diff.now))
    })
  }

  test("a shared line in the middle is FOUND rather than replaced twice", () => {
    const same = diffOf("a\nb\nc\n", "x\nb\ny\n").lines
      .filter((line) => line.kind === "same")
      .map((line) => line.text)
    expect(same).toEqual(["b"])
  })

  test("a repeated alphabet is aligned as tightly as it can be", () => {
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
    const before = Array.from({ length: 900 }, (_, at) => `was ${at}`).join("\n")
    const after = Array.from({ length: 900 }, (_, at) => `now ${at}`).join("\n")
    const started = performance.now()
    const diff = diffOf(before, after)
    expect(performance.now() - started).toBeLessThan(500)
    expect([diff.added, diff.removed]).toEqual([900, 900])
    expect(diff.kind).toBe("replaced")
  })

  test("an ordinary edit is compared rather than given up on", () => {
    expect(diffOf("one\ntwo\n", "one\nTWO\n").kind).toBe("compared")
    const long = Array.from({ length: 2000 }, (_, at) => `line ${at}`)
    const edited = [...long]
    edited[900] = "line nine hundred, rewritten"
    expect(diffOf(`${long.join("\n")}\n`, `${edited.join("\n")}\n`).kind).toBe("compared")
  })

  test("line numbers are the two files' own", () => {
    const diff = diffOf("one\ntwo\nthree\n", "one\nthree\n")
    const gone = diff.lines.find((line) => line.kind === "remove")
    expect([gone?.before, gone?.after]).toEqual([2, null])
    const last = diff.lines[diff.lines.length - 1]
    expect([last?.before, last?.after]).toEqual([3, 2])
  })
})
