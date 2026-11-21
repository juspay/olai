/**
 * THE PAGE DRAWS WHAT THE READING HOLDS.
 *
 * The index files what `@olai/prose`'s `read` makes of a text; the page draws
 * what this package's pipeline makes of the same parse. One parse, but the
 * sanitiser and the rewrite stand between the tree and the page, and either
 * could drop or add a link, a tag or an id. So every real text this
 * repository holds — each `.md` and each row's title and note under the
 * fixtures, and every docs page — is drawn, and what is on the page is held
 * to the reading: the wikilinks by name, the standard links and pictures by
 * count, and the heading ids, in order — and for a title, which is where the
 * page draws a tag as a pill, the tags as written.
 */
import { fixtureRows, realDocuments } from "@olai/prose/corpus.testlib.ts"
import { read, type Read } from "@olai/prose/read.ts"
import { TEST_CLAIMS } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { installPipeline } from "./chunk.ts"
import * as pipeline from "./pipeline.ts"
import { landingId, renderMarkdown } from "./render.ts"
import { TAG_ATTRIBUTE } from "./tag-contract.ts"
import { TESTID } from "./testids.ts"
import { renderTitle } from "./title.ts"

installPipeline(pipeline)

/** One pass over both escapes the stringifier writes into an attribute. */
const unescaped = (value: string): string =>
  value.replace(/&#x(26|22);/g, (_, code: string) => (code === "26" ? "&" : '"'))

/** Every opening tag of one element name on a page. */
const opening = (html: string, name: string): ReadonlyArray<string> =>
  [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, "g"))].map((match) => match[0])

/** What a page draws, in the reading's own terms. A wikilink — an embed
 *  among them — is counted by name and never as a link or a picture. */
const drawn = (html: string) => ({
  wikilinks: opening(html, "(?:a|img|span)").filter((tag) => tag.includes("data-wikilink=")).map((tag) => ({
    target: unescaped(/data-wikilink="([^"]*)"/.exec(tag)?.[1] ?? ""),
    fragments: JSON.parse(unescaped(/data-wikilink-fragments="([^"]*)"/.exec(tag)?.[1] ?? "[]")) as Array<string>,
  })),
  links: opening(html, "a").filter((tag) =>
    !tag.includes("data-wikilink=") && !tag.includes("olai-md-anchor") && !tag.includes("data-footnote")
  ).length,
  pictures: [...opening(html, "img"), ...opening(html, "span").filter((tag) => tag.includes(`data-testid="${TESTID.undrawnPicture}"`))]
    .filter((tag) => !tag.includes("data-wikilink=")).length,
})

/** The same, as the reading holds it. */
const held = (said: Read) => ({
  wikilinks: said.wikilinks.map((link) => ({ target: link.target, fragments: [...link.fragments] })),
  links: said.links.filter((link) => !link.picture).length,
  pictures: said.links.filter((link) => link.picture).length,
})

/** The pills a title draws, as written. */
const pills = (html: string): ReadonlyArray<string> =>
  [...html.matchAll(new RegExp(`${TAG_ATTRIBUTE}="([^"]*)"`, "g"))].map((match) => unescaped(match[1] as string))

const DOCUMENTS = realDocuments()
const ROWS = fixtureRows()

test("the texts this check reads are the repository's", () => {
  expect(DOCUMENTS.length).toBeGreaterThan(50)
  expect(ROWS.length).toBeGreaterThan(100)
  expect(DOCUMENTS.some((one) => read(one.text).wikilinks.length > 15)).toBe(true)
  expect(ROWS.some((one) => one.field === "title" && read(one.text).tags.length > 0)).toBe(true)
})

for (const document of DOCUMENTS) {
  test(`${document.from}: the page draws what the reading holds`, () => {
    const said = read(document.text)
    const html = renderMarkdown(TEST_CLAIMS, document.text, document.from, new Set())
    expect(drawn(html)).toEqual(held(said))
    const namespace = landingId(document.text, document.from, "")
    const ids = [...html.matchAll(/<h[1-6] id="([^"]*)"/g)].map((one) => (one[1] as string).slice(namespace.length))
    expect(ids).toEqual(said.headings.flatMap((heading) => heading.slug === null ? [] : [String(heading.slug)]))
  })
}

test("every fixture row's title and note draws what its reading holds", () => {
  const parted: Array<string> = []
  for (const row of ROWS) {
    const file = row.from.slice(0, row.from.indexOf("#"))
    const said = read(row.text)
    const html = row.field === "title"
      ? renderTitle(TEST_CLAIMS, row.text, file, { members: new Set() }).html
      : renderMarkdown(TEST_CLAIMS, row.text, file, new Set())
    const page = { ...drawn(html), ...(row.field === "title" ? { tags: pills(html) } : {}) }
    const reading = { ...held(said), ...(row.field === "title" ? { tags: said.tags.map(String) } : {}) }
    if (JSON.stringify(page) !== JSON.stringify(reading)) {
      parted.push(`${row.from} ${row.field}: drew ${JSON.stringify(page)}, read ${JSON.stringify(reading)}`)
    }
  }
  expect(parted).toEqual([])
})
