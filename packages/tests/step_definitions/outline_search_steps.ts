import * as assert from "node:assert"
import { Then } from "@cucumber/cucumber"
import type { OlaiWorld } from "../support/world.ts"
import { PALETTE_ITEM } from "../support/world.ts"

Then("the outline hit {string} ranks before node {string}", async function(this: OlaiWorld, file: string, node: string) {
  const ids = await this.page.locator(PALETTE_ITEM).evaluateAll(rows => rows.map(row => row.getAttribute("data-id")))
  const outline = ids.indexOf(`hit-${file}`)
  const record = ids.indexOf(`hit-#${node}`)
  assert.ok(outline >= 0 && record > outline, `${file} to rank ahead of ${node}`)
})
