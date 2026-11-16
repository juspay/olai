/**
 * THE GUIDE AN AGENT IS HANDED IS THE PAGE A PERSON READS — asserted, because
 * a promise would be the thing that failed.
 *
 * `./guide.md` ships inside the binary and `docs/dynamic-plugins.md` is in the
 * tree; an agent in somebody's vault only ever sees the first one. If the two
 * come apart, the symptom is not a red build — it is an agent writing a plugin
 * against advice this build stopped giving, which nobody finds out about until
 * somebody is reading the code it produced.
 *
 * So the doc is the SOURCE and this is the check: the region it marks off is
 * cut and compared, byte for byte, and the failure says the one command that
 * fixes it.
 */

import { expect, test } from "bun:test"
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { GUIDE, GUIDE_END, GUIDE_START } from "./guide.ts"

/** The two pages the guide is cut from, in the order an agent reads them: how
 *  to write one, then the two worked ones. */
const DOCS = ["dynamic-plugins.md", "dynamic-plugins-examples.md"] as const
const at = (page: string): string =>
  join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "docs", page)

/** One page's marked region, or a failure naming the page and the marker it is
 *  missing: a page that grew a start and lost an end would otherwise ship a
 *  whole page as advice. */
const regionOf = (page: string): string => {
  const source = readFileSync(at(page), "utf8")
  const from = source.indexOf(GUIDE_START)
  const to = source.indexOf(GUIDE_END)
  expect(from, `docs/${page} is missing ${GUIDE_START}`).toBeGreaterThanOrEqual(0)
  expect(to, `docs/${page} is missing ${GUIDE_END}`).toBeGreaterThan(from)
  return source.slice(from + GUIDE_START.length, to).trim()
}

test("the shipped authoring guide is the two docs' own guide regions", () => {
  const region = DOCS.map(regionOf).join("\n\n")
  if (GUIDE === region) return
  // THE FAILURE CARRIES THE FIX, because the two files are a copy apart and
  // the person who moved one is the person who has to move the other. There
  // is no recipe to name: a command that knew this file's path would have to
  // live outside this package, where the fence refuses to let a plugin's
  // directory be spelled at all.
  writeFileSync(join(dirname(fileURLToPath(import.meta.url)), "guide.next.md"), `${region}\n`)
  throw new Error(
    "`guide.md` is what every agent reads and it no longer matches the guide regions of "
      + "docs/dynamic-plugins.md and docs/dynamic-plugins-examples.md.\nThe regions as the pages "
      + "now have them have been written beside it as `guide.next.md`: read the difference, then "
      + "replace `guide.md` with it and delete that file.",
  )
})

test("the guide says the three things an agent cannot work without", () => {
  // NOT A WORD COUNT and not a spelling check: these three are the facts whose
  // absence makes an agent produce a plausible plugin that cannot mount — where
  // the files go, what a half may import, and that it cannot approve its own
  // work. A rewrite is free to say them in any words it likes.
  expect(GUIDE).toContain("plugins/")
  expect(GUIDE).toContain("@olai/plugin-api")
  expect(GUIDE.toLowerCase()).toContain("approve")
})
