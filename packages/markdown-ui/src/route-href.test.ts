/**
 * A link that stays inside its document carries TWO addresses: the page-local
 * fragment a plain click scrolls to (the minted id), and the app route an
 * Alt+click opens on the right (`ROUTE_HREF`). These hold the second one to the
 * AUTHORED slug — the half an address names and `landingId` translates — and
 * keep it off every block that is not a document's own body.
 */
import { TEST_CLAIMS } from "@olai/format/testlib"
import { ROUTE_HREF } from "@olai/web/client/press.ts"
import { expect, test } from "bun:test"

import { installPipeline } from "./chunk.ts"
import * as pipeline from "./pipeline.ts"
import { landingId, outlineOf, renderMarkdown } from "./render.ts"

installPipeline(pipeline)

const BODY = ["# Beds", "", "See [the herbs](#herbs-and-café) and [the note](#fn-x).", "", "## Herbs and café", "", "Mint."].join("\n")

const anchors = (html: string): ReadonlyArray<{ href: string; route: string | undefined }> =>
  [...html.matchAll(/<a ([^>]*)>/g)].map((one) => {
    const attrs = one[1] as string
    return {
      href: /href="([^"]*)"/.exec(attrs)?.[1] ?? "",
      route: new RegExp(`${ROUTE_HREF}="([^"]*)"`).exec(attrs)?.[1],
    }
  })

test("an in-page link in a document carries its heading's route beside its fragment", () => {
  const html = renderMarkdown(TEST_CLAIMS, BODY, "notes/garden.md")
  const herbs = anchors(html).find((one) => one.href.endsWith("herbs-and-caf%C3%A9"))
  expect(herbs).toBeDefined()
  // The fragment is still the page's own — what a plain click scrolls to…
  expect(herbs?.href).toBe(`#${landingId(BODY, "notes/garden.md", "herbs-and-caf%C3%A9")}`)
  // …and the route is the address a reader could type, by the AUTHORED slug.
  expect(herbs?.route).toBe("/notes/garden.md#herbs-and-caf%C3%A9")
})

test("a document's headings say their route, for the contents to stamp", () => {
  const headings = outlineOf(TEST_CLAIMS, BODY, "notes/garden.md")
  expect(headings.map((one) => one.route)).toEqual(["/notes/garden.md#beds", "/notes/garden.md#herbs-and-caf%C3%A9"])
  for (const one of headings) {
    expect(one.id).toBe(landingId(BODY, "notes/garden.md", decodeURIComponent(one.route!.split("#")[1]!)))
  }
})

test("a note's in-page links and headings carry no route", () => {
  const html = renderMarkdown(TEST_CLAIMS, BODY, "house.olai")
  expect(anchors(html).every((one) => one.route === undefined)).toBe(true)
  expect(outlineOf(TEST_CLAIMS, BODY, "house.olai").every((one) => one.route === undefined)).toBe(true)
})

test("without claims nothing is stamped", () => {
  expect(anchors(renderMarkdown(undefined, BODY, "notes/garden.md")).every((one) => one.route === undefined)).toBe(true)
})

/**
 * WHERE THE STAMP LANDS is the claim, not what it spells: the route goes
 * through the same door a split arrives by (`landingId` over the slug the
 * address names), and must find the very heading a plain click on the same
 * anchor scrolls to — the element the minted fragment names.
 */
const lands = (body: string, from: string, label: string) => {
  const html = renderMarkdown(TEST_CLAIMS, body, from)
  const anchor = new RegExp(`<a ([^>]*)>${label}</a>`).exec(html)?.[1] ?? ""
  const href = /href="#([^"]*)"/.exec(anchor)?.[1]
  const route = new RegExp(`${ROUTE_HREF}="([^"]*)"`).exec(anchor)?.[1]
  expect(href).toBeDefined()
  expect(route?.startsWith(`/${from}#`)).toBe(true)
  // What the browser scrolls to on a plain click: the fragment, decoded.
  const scrolled = decodeURIComponent(href!)
  // What the split lands on: the route's slug, read the way an address is.
  const landed = landingId(body, from, decodeURIComponent(route!.slice(route!.indexOf("#") + 1)))
  const ids = [...html.matchAll(/<h[1-6] id="([^"]*)"/g)].map((one) => one[1])
  return { scrolled, landed, ids }
}

test("a link to the second of two same-named headings lands on the second", () => {
  const body = ["# Garden", "", "See [the later beds](#beds-1).", "", "## Beds", "", "First.", "", "## Beds", "", "Second."].join("\n")
  const { scrolled, landed, ids } = lands(body, "notes/garden.md", "the later beds")
  expect(ids.length).toBe(3)
  expect(landed).toBe(ids[2]!)
  expect(landed).toBe(scrolled)
})

test("a non-ASCII slug lands on its heading, written raw or percent-encoded", () => {
  for (const written of ["#café-plan", "#caf%C3%A9-plan"]) {
    const body = ["# Garden", "", `See [the plan](${written}).`, "", "## Café plan", "", "Mint."].join("\n")
    const { scrolled, landed, ids } = lands(body, "notes/garden.md", "the plan")
    expect(landed).toBe(ids[1]!)
    expect(landed).toBe(scrolled)
  }
})
