/**
 * EVERY PAGE UNDER `docs/` IS HELD TO THE WRITING STANDARD — one test per page,
 * no exemption list.
 *
 * `dev/skills/docs-writing/SKILL.md` is the standard. Its reader rules are
 * review's job; its shape rules are measurements, and measurements rot unless
 * something takes them. These pages grew by one appended paragraph per pull
 * request until a page ran to 30,000 words with 500-word paragraphs in it, and
 * nothing was red while that happened.
 *
 * ONE TEST PER PAGE rather than one sweep, because a sweep reports the first
 * page it dislikes and a writer fixing six pages wants six failures. The page's
 * SERVED address is the test's name, so `bun test -t 'docs/chat.md'` is the
 * command for the page in front of you.
 *
 * THE LINKS are checked here too, over the whole served set: a relative target
 * that is not there, and a `#fragment` that names no heading on the page it
 * lands on. `../plugin_docs.test.ts` already owns the claim that every plugin
 * HAS a page and that the index opens it; what is owned here is that a link on
 * any page goes somewhere, which is the thing a rewrite breaks.
 */

import * as fs from "node:fs"

import { expect, test } from "bun:test"

import { anchorsIn, findingsIn } from "./support/docs-rules.ts"
import { at, isLocal, landing, linksIn, pages, picturesIn } from "./support/docs.ts"

const PAGES = pages()

/** A guard on the sweep itself: an empty served set would pass every claim
 *  below while asserting nothing. */
test("the served set is actually being read", () => {
  expect(PAGES.length).toBeGreaterThan(20)
})

for (const page of PAGES) {
  test(`${page} is written to the standard`, () => {
    const findings = findingsIn(fs.readFileSync(at(page), "utf8"))
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
        if (address === null) return [`${page}: ${target} leaves docs/, so it is not a door`]
        if (!fs.existsSync(at(address))) {
          return [`${page}: ${target} → ${address}, which is not there`]
        }
        if (fragment === undefined || fragment === "") return []
        if (!address.endsWith(".md")) return []
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
        if (landed === null) return [`${page}: ${target} leaves docs/, so it cannot be drawn`]
        return fs.existsSync(at(landed)) ? [] : [`${page}: ${target} → ${landed}, not there`]
      }),
  )
  expect(broken).toEqual([])
})
