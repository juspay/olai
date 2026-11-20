import * as assert from "node:assert"
import { Then } from "@olai/tests/harness/runner.ts"
import type { OlaiWorld } from "@olai/tests/harness/world.ts"
import { HEADER_SEARCH, oneLine } from "@olai/tests/harness/world.ts"
import type { Locator } from "@olai/tests/harness/playwright.ts"
const spacedSeparators = async (place: Locator): Promise<void> => {
  const parts = await place.locator('[data-place="middle"], [data-place="nearest"]').count()
  const separators = place.locator('[data-place="separator"]')
  assert.equal(await separators.count(), parts, "each ancestor part has a separator")
  for (const separator of await separators.all()) {
    assert.equal(await separator.textContent(), " · ", "the literal separator has both spaces")
    const widths = await separator.evaluate(element => {
      const text = element.firstChild!
      return [0, 1, 2].map(index => {
        const range = document.createRange()
        range.setStart(text, index)
        range.setEnd(text, index + 1)
        return range.getBoundingClientRect().width
      })
    })
    assert.ok(widths.every(width => width > 1), "both spaces and the dot occupy visible width")
    assert.ok(Math.abs(widths[0]! - widths[2]!) < 0.5, "the dot has equal space on both sides")
  }
}

Then("the {string} result {string} has place {string}", async function(this: OlaiWorld, door: string, title: string, expected: string) {
  const row = this.page.getByTestId(door).filter({ has: this.page.getByText(title, { exact: true }) })
  const place = row.locator('[data-place="file"]').locator('..')
  await this.waitUntil(async () => oneLine(await place.innerText()) === expected, `place line to read ${expected}`)
  await spacedSeparators(place)
  assert.equal(await row.locator('svg').count(), 0, "search rows have no glyph")
})

Then("the {string} result {string} preserves file {string} and nearest ancestor {string} around an ellipsis", async function(this: OlaiWorld, door: string, title: string, file: string, nearest: string) {
  const row = this.page.getByTestId(door).filter({ has: this.page.getByText(title, { exact: true }) })
  await row.waitFor({ state: "visible" })
  const start = row.locator('[data-place="file"]')
  const end = row.locator('[data-place="nearest"]')
  assert.equal(await start.innerText(), file)
  assert.equal(oneLine(await end.innerText()), `· ${nearest}`)
  await spacedSeparators(start.locator(".."))
  const middle = row.locator('[data-place="middle"]')
  const titles = middle.locator(".olai-md")
  assert.ok(await titles.count() > 0, "the middle drew an ancestor title")
  assert.ok(
    await titles.evaluateAll(nodes => nodes.some(node => node.scrollWidth > node.clientWidth && getComputedStyle(node).textOverflow === "ellipsis")),
    "a long ancestor title ellipsizes inside the middle",
  )
  const bounds = await row.boundingBox()
  for (const part of [start, end]) {
    const box = await part.boundingBox()
    assert.ok(bounds && box && box.x >= bounds.x && box.x + box.width <= bounds.x + bounds.width + 1)
  }
})

Then("the header search box asks for a Go key and no corrections", async function(this: OlaiWorld) {
  const box = this.page.locator(HEADER_SEARCH)
  await box.waitFor({ state: "visible" })
  assert.equal(await box.getAttribute("enterkeyhint"), "go", "the header box's enterkeyhint")
  assert.equal(await box.getAttribute("autocapitalize"), "none", "the header box's autocapitalize")
  assert.equal(await box.getAttribute("autocorrect"), "off", "the header box's autocorrect")
  assert.equal(await box.getAttribute("spellcheck"), "false", "the header box's spellcheck")
  assert.equal(await box.getAttribute("type"), "search", "the header box's type")
})
