import * as assert from "node:assert/strict"
import { When, Then } from "@olai/tests/harness/runner.ts"
import type { OlaiWorld } from "@olai/tests/harness/world.ts"

const link = (world: OlaiWorld, surface: string) => {
  switch (surface) {
    case "note": return world.page.locator('[data-testid="desc"] a').getByText("target", { exact: true }).first()
    case "see": return world.page.locator('[data-testid="see-refs"] a').first()
    case "bullet": return world.page.locator('[data-testid="zoom"]').first()
    case "heading": return world.page.getByRole("link", { name: "the end", exact: true }).first()
    default: throw new Error(`Unknown surface ${surface}`)
  }
}
When("I activate the unified {string} link with {string}", async function(this: OlaiWorld, surface: string, gesture: string) {
  const anchor = link(this, surface)
  assert.equal(await anchor.evaluate(el => el.tagName), "A")
  await this.markPage()
  if (gesture === "Enter") { await anchor.focus(); await anchor.press("Enter") }
  else await anchor.click({ modifiers: gesture === "Alt" ? ["Alt"] : gesture === "Alt-Shift" ? ["Alt", "Shift"] : [] })
  assert.ok(await this.pageStillMarked(), "link must stay in the live application")
})
When("I open the unified {string} link menu", async function(this: OlaiWorld, surface: string) {
  await link(this, surface).click({ button: "right" })
})
Then("the unified link menu offers Open in new tab", async function(this: OlaiWorld) {
  await this.page.getByRole("menuitem", { name: "Open in new tab", exact: true }).waitFor({ state: "visible" })
})
Then("the unified destination row {string} is selected", async function(this: OlaiWorld, id: string) {
  await this.page.locator(`[data-node-id="${id}"][data-focused="true"]`).first().waitFor({ state: "visible" })
})
Then("the unified destination row {string} is selected in pane {int}", async function(this: OlaiWorld, id: string, pane: number) {
  await this.page.locator(`[data-pane="${pane}"] [data-node-id="${id}"][data-focused="true"]`).first().waitFor({ state: "visible" })
})
