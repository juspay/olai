/**
 * A heading's derived id, and which lines are headings at all.
 *
 * The SPELLING is held here and the AGREEMENT is held in `@olai/web`
 * (`markdown/slugs.test.ts`, which renders bodies through the real pipeline and
 * checks the ids it puts on the page against the list a face promises). These
 * are the cases that are this module's alone: what comes off a heading line,
 * what a repeat is called, and the two constructs a line reader has to get
 * right because it has no parser.
 */

import { expect, test } from "bun:test"

import { headingsIn, slugOf, slugsIn } from "./slug.ts"

const said = (values: ReadonlyArray<string>): ReadonlyArray<string> => [...values]

// The rule as a vault meets it: case folded, punctuation dropped, the spaces
// that are left joined with dashes. `install--setup` is two dashes because the
// `&` left a space behind on either side, which is what `github-slugger` does
// and is worth knowing before it looks like a bug.
test("a slug is the words, folded and joined", () => {
  expect(String(slugOf("Install"))).toBe("install")
  expect(String(slugOf("Install the app"))).toBe("install-the-app")
  expect(String(slugOf("Install & setup"))).toBe("install--setup")
  expect(String(slugOf("C++"))).toBe("c")
  // A letter is a letter in every alphabet: the rule is `\p{L}`, not ASCII.
  expect(String(slugOf("Héllo"))).toBe("héllo")
})

// A heading of pure punctuation slugs to nothing, and nothing is what it gets:
// an empty slug is an address nobody can write down, and inventing `section-3`
// for it would be an identity that moves when a heading above it is added.
test("a heading that slugs to nothing is not an element", () => {
  expect(String(slugOf("***"))).toBe("")
  expect(said(slugsIn("# Real\n\n## ***\n\n## Also"))).toEqual(["real", "also"])
})

// Two headings with the same words are two PLACES, and an address may only name
// one of them — the counter `github-slugger` runs, and the one the browser's
// plugin runs beside it.
test("a repeated heading takes the next number", () => {
  expect(said(slugsIn("## Notes\n\n## Notes\n\n## Notes"))).toEqual([
    "notes",
    "notes-1",
    "notes-2",
  ])
  // …and a generated name that is itself already taken keeps counting rather
  // than colliding with the one that took it.
  expect(said(slugsIn("## Notes\n\n## Notes 1\n\n## Notes"))).toEqual([
    "notes",
    "notes-1",
    "notes-2",
  ])
})

// The closing run markdown allows, and the one place it must NOT come off: a
// heading that ends in a hash with no space before it is a heading about C#.
test("the closing hashes come off, and a hash that is a word does not", () => {
  expect(headingsIn("## Install ##")).toEqual(["Install"])
  expect(headingsIn("## C#")).toEqual(["C#"])
  expect(headingsIn("### ###")).toEqual([""])
})

// The space is markdown's own rule and this format leans on it hard: a
// directory of these is full of lines that open with a tag.
test("a tag at the start of a line is not a heading", () => {
  expect(headingsIn("#home is where the work is")).toEqual([])
  expect(headingsIn("####### seven hashes")).toEqual([])
  expect(headingsIn("# one")).toEqual(["one"])
})

// The one construct whose contents look like headings often enough to matter:
// every shell example with a `# comment` in it. A fence closes on a fence of
// the same character at least as long, which is what lets one hold another.
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
  // A longer fence closes a shorter one and not the other way round.
  expect(headingsIn("````\n```\n# still inside\n````\n# out")).toEqual(["out"])
})

// A rule under a line of prose is a heading; the same rule after a blank line
// is a thematic break, and the `---` at the top of a file is frontmatter.
// Telling those apart is the whole of why the scan remembers the line above.
test("a setext heading needs prose above the rule", () => {
  expect(headingsIn("The plan\n========\n\nProse.\n\nNext\n----")).toEqual([
    "The plan",
    "Next",
  ])
  expect(headingsIn("Prose.\n\n---\n\nMore.")).toEqual([])
  expect(headingsIn("---\ntitle: x\n---\n\n# Real")).toEqual(["Real"])
})

// Where the block ENDS is `./frontmatter.ts`'s rule now rather than this
// scan's, and the corner that move fixed is this one: an unclosed `---` used
// to swallow every heading below it, where the renderer draws a thematic break
// and carries on. A face that lost a document's whole element list is an
// address the app writes and cannot open.
test("an unclosed frontmatter fence hides no heading", () => {
  expect(headingsIn("---\ntitle: x\n\n# Real\n\n## Also")).toEqual(["Real", "Also"])
})
