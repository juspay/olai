import * as assert from "node:assert"
import { Then, When } from "@cucumber/cucumber"
import type { OlaiWorld } from "../support/world.ts"
import { PALETTE_ITEM } from "../support/world.ts"

Then("the outline hit {string} ranks before node {string}", async function(this: OlaiWorld, file: string, node: string) {
  const ids = await this.page.locator(PALETTE_ITEM).evaluateAll(rows => rows.map(row => row.getAttribute("data-id")))
  const outline = ids.indexOf(`hit-${file}`)
  const record = ids.indexOf(`hit-#${node}`)
  assert.ok(outline >= 0 && record > outline, `${file} to rank ahead of ${node}`)
})

When("I point the palette at outline {string}", async function(this: OlaiWorld, file: string) {
  const row = this.page.locator(PALETTE_ITEM).filter({ has: this.page.getByText(file, { exact: true }) })
  await row.hover()
  await this.waitUntil(async () => await row.getAttribute("data-active") === "true", "the outline hit to hold the palette cursor")
})
