import * as assert from "node:assert"
import { Then } from "@cucumber/cucumber"
import type { OlaiWorld } from "../support/world.ts"
import { oneLine } from "../support/world.ts"

Then("the {string} result {string} has place {string}", async function(this: OlaiWorld, door: string, title: string, expected: string) {
  const row = this.page.getByTestId(door).filter({ hasText: title })
  const place = row.locator('[data-place="file"]').locator('..')
  await this.waitUntil(async () => oneLine(await place.innerText()) === expected, `place line to read ${expected}`)
  assert.equal(await row.locator('svg').count(), 0, "search rows have no glyph")
})

Then("the {string} result {string} preserves file {string} and nearest ancestor {string} around an ellipsis", async function(this: OlaiWorld, door: string, title: string, file: string, nearest: string) {
  const row = this.page.getByTestId(door).filter({ hasText: title })
  await row.waitFor({ state: "visible" })
  const start = row.locator('[data-place="file"]')
  const end = row.locator('[data-place="nearest"]')
  assert.equal(await start.innerText(), file)
  assert.equal(oneLine(await end.innerText()), `· ${nearest}`)
  const middle = row.locator('[data-place="middle"]')
  assert.ok(await middle.evaluate(el => el.scrollWidth > el.clientWidth && getComputedStyle(el).textOverflow === "ellipsis"))
  const bounds = await row.boundingBox()
  for (const part of [start, end]) {
    const box = await part.boundingBox()
    assert.ok(bounds && box && box.x >= bounds.x && box.x + box.width <= bounds.x + bounds.width + 1)
  }
})
