import * as fs from "node:fs"

import { expect, test } from "bun:test"

import { anchorsIn, findingsIn } from "./support/docs-rules.ts"
import { at, INDEX, isLocal, landing, linksIn, pages, picturesIn } from "./support/docs.ts"

const PAGES = pages()

test("the served set is actually being read", () => {
  expect(PAGES.length).toBeGreaterThan(20)
})

for (const page of PAGES) {
  test(`${page} is written to the standard`, () => {
    const findings = findingsIn(fs.readFileSync(at(page), "utf8"), page !== INDEX)
    expect(findings.map((finding) => `${page}:${finding.line} rule ${finding.rule}: ${finding.said}`))
      .toEqual([])
  })
}


test("every link on every page is a door, and every anchor opens", () => {
  const broken = PAGES.flatMap((page) =>
    linksIn(page)
      .filter((target) => isLocal(target) || target.startsWith("#"))
      .flatMap((target) => {
        const [address, fragment] = target.startsWith("#")
          ? [page, target.slice(1)]
          : [landing(page, target), target.split("#")[1]]
        if (address === null) return [`${page}: ${target} leaves website/docs/, so it is not a door`]
        if (!fs.existsSync(at(address))) {
          return [`${page}: ${target} → ${address}, which is not there`]
        }
        if (!address.endsWith(".md")) {
          return [`${page}: ${target} is not a page; the site publishes pages, so draw a picture with ![]()`]
        }
        if (fragment === undefined || fragment === "") return []
        return anchorsIn(fs.readFileSync(at(address), "utf8")).has(fragment)
          ? []
          : [`${page}: ${target} names no heading on ${address}`]
      }),
  )
  expect(broken).toEqual([])
})

test("every picture a page draws is in the served set", () => {
  const broken = PAGES.flatMap((page) =>
    picturesIn(page)
      .filter(isLocal)
      .flatMap((target) => {
        const landed = landing(page, target)
        if (landed === null) return [`${page}: ${target} leaves website/docs/, so it cannot be drawn`]
        return fs.existsSync(at(landed)) ? [] : [`${page}: ${target} → ${landed}, not there`]
      }),
  )
  expect(broken).toEqual([])
})
