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
