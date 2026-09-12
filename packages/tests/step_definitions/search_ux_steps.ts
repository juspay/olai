/** Text equality alone cannot detect collapsed leading spaces in flex items. */
import * as assert from "node:assert"
import { Then } from "@cucumber/cucumber"
import type { OlaiWorld } from "../support/world.ts"
import { oneLine } from "../support/world.ts"
import type { Locator } from "playwright"
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
  assert.ok(await middle.evaluate(el => el.scrollWidth > el.clientWidth && getComputedStyle(el).textOverflow === "ellipsis"))
  const bounds = await row.boundingBox()
  for (const part of [start, end]) {
    const box = await part.boundingBox()
    assert.ok(bounds && box && box.x >= bounds.x && box.x + box.width <= bounds.x + bounds.width + 1)
  }
})
