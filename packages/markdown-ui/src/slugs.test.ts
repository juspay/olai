import { TEST_CLAIMS } from "@olai/format/testlib"
import { proseIn, slugsIn } from "@olai/format"
import { expect, test } from "bun:test"

import { installPipeline } from "./chunk.ts"
import * as pipeline from "./pipeline.ts"
import { landingId, renderMarkdown } from "./render.ts"

installPipeline(pipeline)

const FROM = "notes.md"

const drawn = (body: string): ReadonlyArray<string> => {
  const namespace = landingId(body, FROM, "")
  return [...renderMarkdown(TEST_CLAIMS, body, FROM).matchAll(/<h[1-6] id="([^"]*)"/g)].map((one) =>
    (one[1] as string).slice(namespace.length)
  )
}

test("the ids on the page are the ones the face promises", () => {
  const body = [
    "# The plan",
    "",
    "Some prose with a [link](other.md).",
    "",
    "## Next steps",
    "",
    "### Install & setup",
    "",
    "## Notes",
    "",
    "## Notes",
  ].join("\n")
  expect(drawn(body)).toEqual(slugsIn(body).map(String))
  expect(drawn(body)).toEqual([
    "the-plan",
    "next-steps",
    "install--setup",
    "notes",
    "notes-1",
  ])
})

test("a heading inside a fenced block is neither drawn nor promised", () => {
  const body = ["# Real", "", "```sh", "# not a heading", "```", "", "## Also real"].join(
    "\n",
  )
  expect(drawn(body)).toEqual(slugsIn(body).map(String))
  expect(drawn(body)).toEqual(["real", "also-real"])
})

test("frontmatter is a heading to neither reading", () => {
  const body = [
    "---",
    "title: The kitchen plan",
    "owners: [alice, bob]",
    "---",
    "",
    "# The plan",
    "",
    "## Next steps",
  ].join("\n")
  expect(drawn(proseIn(body))).toEqual(slugsIn(body).map(String))
  expect(drawn(proseIn(body))).toEqual(["the-plan", "next-steps"])
  const html = renderMarkdown(TEST_CLAIMS, proseIn(body), FROM)
  expect(html).not.toContain("<hr")
  expect(html).not.toContain("title: The kitchen plan")
  expect(renderMarkdown(TEST_CLAIMS, body, FROM)).toContain("<hr")
})

test("an unclosed fence is a thematic break to both readings", () => {
  const body = ["---", "title: x", "", "# Real", "", "## Also"].join("\n")
  expect(drawn(proseIn(body))).toEqual(slugsIn(body).map(String))
  expect(drawn(proseIn(body))).toEqual(["real", "also"])
  expect(renderMarkdown(TEST_CLAIMS, proseIn(body), FROM)).toContain("<hr")
})

test("a setext heading is one to both readings", () => {
  const body = ["The plan", "========", "", "Prose.", "", "Next", "----"].join("\n")
  expect(drawn(body)).toEqual(slugsIn(body).map(String))
  expect(drawn(body)).toEqual(["the-plan", "next"])
})

test("a heading whose text is a link is where the two readings part", () => {
  const body = "## [Install](setup.md)"
  expect(drawn(body)).toEqual(["install"])
  expect(slugsIn(body).map(String)).toEqual(["installsetupmd"])
})
