/**
 * The page and the index read the same wikilinks out of the same text.
 *
 * The references index files what `@olai/format`'s scan finds; the page draws
 * what this package's pipeline turns into a link. Two readers of one syntax are
 * two chances to disagree — about code, an escape, a table cell — and the
 * disagreement would read as a backlink with no link on the page, or a link
 * that is not counted. So every text of the test directory written for this
 * syntax is drawn, and the names on the page are held to the names the scan
 * read, in order.
 */
import { proseIn, wikilinksIn } from "@olai/format"
import { TEST_CLAIMS } from "@olai/format/testlib"
import { expect, test } from "bun:test"
import { readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"

import { installPipeline } from "./chunk.ts"
import * as pipeline from "./pipeline.ts"
import { renderMarkdown } from "./render.ts"
import { renderTitle } from "./title.ts"

installPipeline(pipeline)

const ROOT = join(import.meta.dir, "../../tests/fixtures/wikilinks")

const filesUnder = (directory: string): ReadonlyArray<string> =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? filesUnder(join(directory, entry.name)) : [join(directory, entry.name)]
  )

const PATHS = filesUnder(ROOT).map((file) => relative(ROOT, file)).sort()
const MEMBERS: ReadonlySet<string> = new Set(PATHS)

/** The names the page drew, in order: every element the pipeline marked. */
const drawnNames = (html: string): ReadonlyArray<string> =>
  [...html.matchAll(/data-wikilink="([^"]*)"/g)].map((match) =>
    (match[1] as string).replace(/&#x26;/g, "&").replace(/&#x22;/g, '"')
  )

const scannedNames = (text: string): ReadonlyArray<string> => wikilinksIn(text).map((link) => link.name)

test("the fixture directory holds the documents this check reads", () => {
  expect(PATHS.filter((path) => path.endsWith(".md")).length).toBeGreaterThan(5)
  expect(scannedNames(proseIn(readFileSync(join(ROOT, "every-form.md"), "utf8"))).length).toBeGreaterThan(15)
})

for (const path of PATHS.filter((one) => one.endsWith(".md"))) {
  test(`${path}: the page draws exactly the wikilinks the index reads`, () => {
    const prose = proseIn(readFileSync(join(ROOT, path), "utf8"))
    expect(drawnNames(renderMarkdown(TEST_CLAIMS, prose, path, MEMBERS))).toEqual(scannedNames(prose))
  })
}

test("house.olai: each title and note draws the wikilinks the index reads", () => {
  const lines = readFileSync(join(ROOT, "house.olai"), "utf8").split("\n").filter((line) => line !== "")
  let read = 0
  for (const line of lines) {
    const record = JSON.parse(line) as { readonly title: string; readonly desc?: string }
    const title = renderTitle(TEST_CLAIMS, record.title, "house.olai", { members: MEMBERS }).html
    expect(drawnNames(title)).toEqual(scannedNames(record.title))
    read += scannedNames(record.title).length
    if (record.desc !== undefined) {
      expect(drawnNames(renderMarkdown(TEST_CLAIMS, record.desc, "house.olai", MEMBERS))).toEqual(scannedNames(record.desc))
      read += scannedNames(record.desc).length
    }
  }
  expect(read).toBeGreaterThan(1)
})
