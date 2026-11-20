import { expect, test } from "bun:test"

import { headingsIn, slugOf, slugsIn } from "./slug.ts"

const said = (values: ReadonlyArray<string>): ReadonlyArray<string> => [...values]

test("a slug is the words, folded and joined", () => {
  expect(String(slugOf("Install"))).toBe("install")
  expect(String(slugOf("Install the app"))).toBe("install-the-app")
  expect(String(slugOf("Install & setup"))).toBe("install--setup")
  expect(String(slugOf("C++"))).toBe("c")
  expect(String(slugOf("Héllo"))).toBe("héllo")
})

test("a heading that slugs to nothing is not an element", () => {
  expect(String(slugOf("***"))).toBe("")
  expect(said(slugsIn("# Real\n\n## ***\n\n## Also"))).toEqual(["real", "also"])
})

test("a repeated heading takes the next number", () => {
  expect(said(slugsIn("## Notes\n\n## Notes\n\n## Notes"))).toEqual([
    "notes",
    "notes-1",
    "notes-2",
  ])
  expect(said(slugsIn("## Notes\n\n## Notes 1\n\n## Notes"))).toEqual([
    "notes",
    "notes-1",
    "notes-2",
  ])
})

test("the closing hashes come off, and a hash that is a word does not", () => {
  expect(headingsIn("## Install ##")).toEqual(["Install"])
  expect(headingsIn("## C#")).toEqual(["C#"])
  expect(headingsIn("### ###")).toEqual([""])
})

test("a tag at the start of a line is not a heading", () => {
  expect(headingsIn("#home is where the work is")).toEqual([])
  expect(headingsIn("####### seven hashes")).toEqual([])
  expect(headingsIn("# one")).toEqual(["one"])
})

test("nothing inside a fenced block is a heading", () => {
  const body = [
    "# Real",
    "```sh",
    "# not a heading",
    "```",
    "## Also real",
    "~~~",
    "### nor this",
    "~~~",
    "#### And this",
  ].join("\n")
  expect(headingsIn(body)).toEqual(["Real", "Also real", "And this"])
  expect(headingsIn("````\n```\n# still inside\n````\n# out")).toEqual(["out"])
})

test("a setext heading needs prose above the rule", () => {
  expect(headingsIn("The plan\n========\n\nProse.\n\nNext\n----")).toEqual([
    "The plan",
    "Next",
  ])
  expect(headingsIn("Prose.\n\n---\n\nMore.")).toEqual([])
  expect(headingsIn("---\ntitle: x\n---\n\n# Real")).toEqual(["Real"])
})

test("an unclosed frontmatter fence hides no heading", () => {
  expect(headingsIn("---\ntitle: x\n\n# Real\n\n## Also")).toEqual(["Real", "Also"])
})
