import * as assert from "node:assert"
import { Then, When } from "@cucumber/cucumber"
import type { OlaiWorld } from "../support/world.ts"

Then("the non-notebook fixture shows counter {int}", async function(this: OlaiWorld, count: number) {
  await this.page.getByRole("main", { name: "Non-notebook fixture" }).waitFor({ state: "visible" })
  await this.page.waitForFunction((value) => document.querySelector('output[aria-label="Counter value"]')?.textContent === String(value), count)
  assert.equal(await this.page.getByRole("alert").count(), 0)
})
When("I increment the non-notebook counter", async function(this: OlaiWorld) {
  await this.page.getByRole("button", { name: "Increment counter", exact: true }).click()
})
When("I reload the non-notebook fixture", async function(this: OlaiWorld) {
  await this.page.reload()
})
