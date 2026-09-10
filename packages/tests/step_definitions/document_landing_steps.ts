import * as assert from "node:assert"
import { Given, Then } from "@cucumber/cucumber"
import type { OlaiWorld } from "../support/world.ts"

Given("a long search document with {string} on file line {int}", async function(this: OlaiWorld, word: string, line: number) {
  const lines = Array.from({ length: 200 }, (_, i) => i % 2 === 0 ? `Paragraph ${i + 1} about ordinary cabinetry.` : "")
  lines.splice(0, 4, "---", "project: kitchen", "---", "# Long document")
  lines[line - 2] = ""
  lines[line - 1] = `The word ${word} appears in this paragraph.`
  lines[line] = ""
  await this.writeServed("landing.md", lines.join("\n"))
})

Then("the document match {string} is lit in the viewport at line {int}", async function(this: OlaiWorld, word: string, line: number) {
  await this.waitUntil(async () => {
    const mark = this.page.locator('[data-search-landing="true"] mark').filter({ hasText: word })
    if (await mark.count() !== 1) return false
    const box = await mark.boundingBox()
    return box !== null && box.y >= 0 && box.y + box.height <= this.viewport().height
  }, `the matching block and its highlighted word to land in the viewport`)
  assert.equal(new URL(this.page.url()).hash, `#L${line}`)
  assert.equal(new URL(this.page.url()).searchParams.get("q"), word)
})

Then("the long search document is at the top without a highlight", async function(this: OlaiWorld) {
  const heading = this.page.getByRole("heading", { name: /^Long document/ })
  await heading.waitFor({ state: "visible" })
  await this.waitUntil(async () => {
    const box = await heading.boundingBox()
    return box !== null && box.y >= 0 && box.y + box.height <= this.viewport().height
  }, "the start of the document to be in the viewport")
  assert.equal(await this.page.locator('[data-search-landing="true"] mark').count(), 0)
})
