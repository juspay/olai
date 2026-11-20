import { expect, test } from "bun:test"
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { GUIDE, GUIDE_END, GUIDE_START } from "./guide.ts"

const DOCS = ["dynamic-plugins.md", "dynamic-plugins-examples.md"] as const
const at = (page: string): string =>
  join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "website", "docs", page)

const regionOf = (page: string): string => {
  const source = readFileSync(at(page), "utf8")
  const from = source.indexOf(GUIDE_START)
  const to = source.indexOf(GUIDE_END)
  expect(from, `website/docs/${page} is missing ${GUIDE_START}`).toBeGreaterThanOrEqual(0)
  expect(to, `website/docs/${page} is missing ${GUIDE_END}`).toBeGreaterThan(from)
  return source.slice(from + GUIDE_START.length, to).trim()
}

test("the shipped authoring guide is the two docs' own guide regions", () => {
  const region = DOCS.map(regionOf).join("\n\n")
  if (GUIDE === region) return
  writeFileSync(join(dirname(fileURLToPath(import.meta.url)), "guide.next.md"), `${region}\n`)
  throw new Error(
    "`guide.md` is what every agent reads and it no longer matches the guide regions of "
      + "website/docs/dynamic-plugins.md and website/docs/dynamic-plugins-examples.md.\nThe regions as the pages "
      + "now have them have been written beside it as `guide.next.md`: read the difference, then "
      + "replace `guide.md` with it and delete that file.",
  )
})

test("the guide says the three things an agent cannot work without", () => {
  expect(GUIDE).toContain("plugins/")
  expect(GUIDE).toContain("@olai/plugin-api")
  expect(GUIDE.toLowerCase()).toContain("approve")
})
