import * as assert from "node:assert/strict"

import { Then } from "@olai/tests/harness/runner.ts"
import { answered } from "@olai/tests/harness/shortlist.ts"
import { PALETTE, PALETTE_INPUT, PALETTE_ITEM, POLL_TIMEOUT } from "@olai/tests/harness/world.ts"
import type { OlaiWorld } from "@olai/tests/harness/world.ts"

const HALF = /^hit-plugins\/[^/]+\/.+\.tsx?$/

Then("the palette lists no plugin half", async function (this: OlaiWorld) {
  const box = this.page.locator(PALETTE_INPUT)
  await box.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  await answered(this, PALETTE, await box.inputValue())
  const ids = await this.page.locator(PALETTE_ITEM).evaluateAll((rows) =>
    rows.map((row) => row.getAttribute("data-id") ?? ""),
  )
  const halves = ids.filter((id) => HALF.test(id))
  assert.deepEqual(
    halves,
    [],
    `the palette lists ${halves.length} plugin half (${halves.join(" | ")}) — ` +
      "a half's text is kept and is not prose, so it is in no document list",
  )
})
