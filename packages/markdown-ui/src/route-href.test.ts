import { TEST_CLAIMS } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { installPipeline } from "./chunk.ts"
import * as pipeline from "./pipeline.ts"
import { landingId, outlineOf, renderMarkdown } from "./render.ts"

installPipeline(pipeline)

const BODY = ["# Beds", "", "See [the herbs](#herbs-and-café) and [the note](#fn-x).", "", "## Herbs and café", "", "Mint."].join("\n")

const hrefs = (html: string): ReadonlyArray<string> =>
  [...html.matchAll(/<a [^>]*href="([^"]*)"/g)].map((one) => one[1] as string)

test("an in-page link in a document is its heading's route, by the authored slug", () => {
  const html = renderMarkdown(TEST_CLAIMS, BODY, "notes/garden.md")
  expect(hrefs(html)).toContain("/notes/garden.md#herbs-and-caf%C3%A9")
})

test("a document's headings say their route, for the contents to stamp", () => {
  const headings = outlineOf(TEST_CLAIMS, BODY, "notes/garden.md")
  expect(headings.map((one) => one.route)).toEqual(["/notes/garden.md#beds", "/notes/garden.md#herbs-and-caf%C3%A9"])
  for (const one of headings) {
    expect(one.id).toBe(landingId(BODY, "notes/garden.md", decodeURIComponent(one.route!.split("#")[1]!)))
  }
})

test("a note's in-page links stay local fragments and its headings carry no route", () => {
  expect(hrefs(renderMarkdown(TEST_CLAIMS, BODY, "house.olai")).every((href) => href.startsWith("#"))).toBe(true)
  expect(outlineOf(TEST_CLAIMS, BODY, "house.olai").every((one) => one.route === undefined)).toBe(true)
})

/** WHERE THE LINK LANDS is the claim, not what it spells: the route's slug,
 *  read the way an address is (`landingId`), must find the heading it names. */
const lands = (body: string, from: string, label: string) => {
  const html = renderMarkdown(TEST_CLAIMS, body, from)
  const href = new RegExp(`<a [^>]*href="([^"]*)"[^>]*>${label}</a>`).exec(html)?.[1]
  expect(href?.startsWith(`/${from}#`)).toBe(true)
  const landed = landingId(body, from, decodeURIComponent(href!.slice(href!.indexOf("#") + 1)))
  const ids = [...html.matchAll(/<h[1-6] id="([^"]*)"/g)].map((one) => one[1])
  return { landed, ids }
}

test("a link to the second of two same-named headings lands on the second", () => {
  const body = ["# Garden", "", "See [the later beds](#beds-1).", "", "## Beds", "", "First.", "", "## Beds", "", "Second."].join("\n")
  const { landed, ids } = lands(body, "notes/garden.md", "the later beds")
  expect(ids.length).toBe(3)
  expect(landed).toBe(ids[2]!)
})

test("a non-ASCII slug lands on its heading, written raw or percent-encoded", () => {
  for (const written of ["#café-plan", "#caf%C3%A9-plan"]) {
    const body = ["# Garden", "", `See [the plan](${written}).`, "", "## Café plan", "", "Mint."].join("\n")
    const { landed, ids } = lands(body, "notes/garden.md", "the plan")
    expect(landed).toBe(ids[1]!)
  }
})
