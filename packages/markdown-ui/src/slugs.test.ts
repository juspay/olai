/**
 * THE TWO READINGS OF A HEADING, held to each other.
 *
 * A heading's id is spelled in one place (`@olai/format`'s `slugOf`) and the
 * counter behind a repeat is too (`claim`), so those cannot drift. What CAN is
 * the other half: which lines are headings, and what their text is. The format
 * reads LINES — it holds no markdown parser, deliberately, being the floor the
 * write gate stands on — and the browser reads a parsed tree.
 *
 * This is the seam where both exist, so this is where the gap is measured. The
 * face's promise is `README.md#install` names something; the page's job is to
 * land there. A document whose ids and whose face disagree is an address this
 * app writes and cannot open.
 */

import { proseIn, slugsIn } from "@olai/format"
import { expect, test } from "bun:test"

import { installPipeline } from "./chunk.ts"
import * as pipeline from "./pipeline.ts"
import { landingId, renderMarkdown } from "./render.ts"

// The pipeline is a chunk the browser fetches (./chunk.ts) and there is no
// shell here to read its URL from, so this installs the same module the
// browser ends up with — `render.test.ts`'s own move, for its reason.
installPipeline(pipeline)

/** The file every body below is rendered as. */
const FROM = "notes.md"

/**
 * The ids the real pipeline puts on the page, in document order — read back out
 * of the html it produced, which is the only honest way to ask.
 *
 * WITH THE BLOCK'S NAMESPACE TAKEN OFF, through the one function that knows it
 * (`landingId`): what is on the page is `md-1f2e3d-beds`, because a page can
 * hold a document, a note per row and a day's own notes, and two of them
 * opening `## Shape` would answer for each other (`./render.ts`). The address
 * half is what is left, and the address half is what a face promises — so the
 * prefix is asked for rather than matched away, and this test is spending the
 * same bridge a landing does.
 */
const drawn = (body: string): ReadonlyArray<string> => {
  const namespace = landingId(body, FROM, "")
  return [...renderMarkdown(body, FROM).matchAll(/<h[1-6] id="([^"]*)"/g)].map((one) =>
    (one[1] as string).slice(namespace.length)
  )
}

test("the ids on the page are the ones the face promises", () => {
  const body = [
    "# The plan",
    "",
    "Some prose with a [link](other.md).",
    "",
    "## Next steps",
    "",
    "### Install & setup",
    "",
    "## Notes",
    "",
    "## Notes",
  ].join("\n")
  expect(drawn(body)).toEqual(slugsIn(body).map(String))
  // …and the spelling itself, written out once so a reader of this file can see
  // what the rule DOES rather than only that two callers agree about it.
  expect(drawn(body)).toEqual([
    "the-plan",
    "next-steps",
    "install--setup",
    "notes",
    "notes-1",
  ])
})

/** A fence is the one construct whose contents look like headings often
 *  enough to matter — every shell example with a `# comment` in it — and the
 *  face's line reader skips them for exactly this reason. */
test("a heading inside a fenced block is neither drawn nor promised", () => {
  const body = ["# Real", "", "```sh", "# not a heading", "```", "", "## Also real"].join(
    "\n",
  )
  expect(drawn(body)).toEqual(slugsIn(body).map(String))
  expect(drawn(body)).toEqual(["real", "also-real"])
})

/**
 * THE `---` BLOCK, and it is the case this pair was written for.
 *
 * The closing fence sits directly under a line of text, so a reading that did
 * not know about frontmatter sees a setext `<h2>` — and that is exactly what
 * the page drew: `title: x` as a heading, with an anchor on it and a row in the
 * table of contents, naming a section the face (which skipped the block) never
 * promised existed.
 *
 * A DOCUMENT IS DRAWN FROM ITS PROSE now (`proseIn`, spent by the three faces
 * that hold a whole file — `../document/faces.tsx`, `../document/DocRef.tsx`,
 * `../day/DayNote.tsx`), so the two readings cannot disagree: they are the same
 * function. What this pins is that the pipeline, handed that prose, draws
 * exactly the headings the face promises — and that the pipeline itself is
 * still innocent of frontmatter, which is what keeps a NOTE's own `---` on the
 * screen (`./pipeline.ts` argues it).
 */
test("frontmatter is a heading to neither reading", () => {
  const body = [
    "---",
    "title: The kitchen plan",
    "owners: [alice, bob]",
    "---",
    "",
    "# The plan",
    "",
    "## Next steps",
  ].join("\n")
  expect(drawn(proseIn(body))).toEqual(slugsIn(body).map(String))
  expect(drawn(proseIn(body))).toEqual(["the-plan", "next-steps"])
  // …and the block is not on the page at all — no rule, no phantom heading.
  const html = renderMarkdown(proseIn(body), FROM)
  expect(html).not.toContain("<hr")
  expect(html).not.toContain("title: The kitchen plan")
  // The pipeline HAS NOT LEARNED about the block, which is the other half:
  // handed the whole body — as a note's own text is handed to it — it draws
  // the thematic break and the setext heading markdown says are there.
  expect(renderMarkdown(body, FROM)).toContain("<hr")
})

/**
 * An UNCLOSED fence is not frontmatter — it is the thematic break markdown has
 * always drawn, and the prose under it is prose. The face's own scanner had
 * this one the other way and lost every heading in such a document; both
 * readings agree here now.
 */
test("an unclosed fence is a thematic break to both readings", () => {
  const body = ["---", "title: x", "", "# Real", "", "## Also"].join("\n")
  expect(drawn(proseIn(body))).toEqual(slugsIn(body).map(String))
  expect(drawn(proseIn(body))).toEqual(["real", "also"])
  expect(renderMarkdown(proseIn(body), FROM)).toContain("<hr")
})

/** A setext heading — underlined rather than hashed — is a heading to both. */
test("a setext heading is one to both readings", () => {
  const body = ["The plan", "========", "", "Prose.", "", "Next", "----"].join("\n")
  expect(drawn(body)).toEqual(slugsIn(body).map(String))
  expect(drawn(body)).toEqual(["the-plan", "next"])
})

/**
 * WHERE THEY PART, pinned rather than left to be discovered: the browser reads
 * a heading's TEXT out of a parsed tree, so inline markup is gone by the time
 * it is slugged; the face reads the line as written. `## **Install**` agrees by
 * accident (a `*` is not a character a slug is made of); a heading whose text
 * is a link does not.
 *
 * The cost is a face that does not list one address, which is a backlink
 * nobody gets — never a page that will not render. Fixing it correctly is
 * having a parser in the format, which is the trade `./derive.ts` already
 * refuses about tags.
 */
test("a heading whose text is a link is where the two readings part", () => {
  const body = "## [Install](setup.md)"
  expect(drawn(body)).toEqual(["install"])
  expect(slugsIn(body).map(String)).toEqual(["installsetupmd"])
})
