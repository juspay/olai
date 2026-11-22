/** The shortcut that reads a title written as one link, held to the parse over
 *  every title the fixture outlines hold. */
import { expect, test } from "bun:test"

import { fixtureRows } from "./corpus.testlib.ts"
import { linkedTitle } from "./linked.ts"
import { read } from "./read.ts"

/**
 * What the parse says a one-link title is: exactly one link, no wikilink, and
 * nothing drawn beside it — so the words the title shows are the link's own.
 */
const parsed = (title: string): { label: string; at: string } | undefined => {
  const said = read(title)
  const [link] = said.links
  if (link === undefined || said.links.length !== 1 || said.wikilinks.length > 0) return undefined
  if (link.picture || said.words.trim() !== link.words.trim()) return undefined
  return { label: link.words, at: link.url }
}

test("a title that is one link reads the same way with the parser and without", () => {
  const titles = fixtureRows().filter((row) => row.field === "title")
  expect(titles.length).toBeGreaterThan(50)
  for (const row of titles) {
    expect([row.from, linkedTitle(row.text)]).toEqual([row.from, parsed(row.text)])
  }
})

// The shapes the fixtures do not all hold, spelled out: the narrowness is the
// rule, not an accident of what a directory happens to contain.
test("one link alone is read; a link with prose round it is not", () => {
  expect(linkedTitle("[What is late](/agenda?q=is%3Atodo)")).toEqual({
    label: "What is late",
    at: "/agenda?q=is%3Atodo",
  })
  expect(linkedTitle("  [spaced](/#a1b2c3)  ")).toEqual({ label: "spaced", at: "/#a1b2c3" })
  expect(linkedTitle("[](/house.olai)")).toEqual({ label: "", at: "/house.olai" })
  expect(linkedTitle("see [the plan](/plan.md)")).toBeUndefined()
  expect(linkedTitle("[a](/one.md) [b](/two.md)")).toBeUndefined()
  expect(linkedTitle("sow the basil")).toBeUndefined()
  // A target with a space in it is a sentence somebody wrote, not an address.
  expect(linkedTitle("[name](/paint colours.md)")).toBeUndefined()
})
