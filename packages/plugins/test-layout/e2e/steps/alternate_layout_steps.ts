import { attr } from "@olai/tests/harness/selectors.ts"
import { Then, When } from "@olai/tests/harness/runner.ts"
import type { OlaiWorld } from "@olai/tests/harness/world.ts"

Then("the alternate layout fixture is mounted", async function(this: OlaiWorld) {
  await this.page.getByRole("main", { name: "Alternate layout fixture" }).waitFor({ state: "visible" }).catch(cause => { throw new Error(`${cause}\n${this.errors.join("\n")}`) })
})
When("the alternate layout opens Markdown", async function(this: OlaiWorld) {
  await this.page.getByRole("button", { name: "Open Markdown fixture", exact: true }).click()
})
When("the alternate layout opens the outline", async function(this: OlaiWorld) {
  await this.page.getByRole("button", { name: "Open outline fixture", exact: true }).click()
})

When("I open the alternate layout at {string}", async function(this: OlaiWorld, address: string) {
  await this.page.goto(new URL(address, this.baseUrl).href)
  await this.page.getByRole("main", { name: "Alternate layout fixture" }).waitFor({ state: "visible" }).catch(cause => { throw new Error(`${cause}\n${this.errors.join("\n")}`) })
})

When("I measure the outline bindings", async function(this: OlaiWorld) {
  await this.page.getByRole("button", { name: "Measure outline bindings", exact: true }).click()
})
Then("row {string} has {int} outline binding readings", async function(this: OlaiWorld, id: string, count: number) {
  await this.expectAttribute(attr("data-probe-row", id), "data-probe-runs", String(count), `${id}'s production PageView bindings`)
})
Then("the measured row {string} reads {string}", async function(this: OlaiWorld, id: string, title: string) {
  await this.waitUntil(async () => await this.frontLane().locator(attr("data-probe-row", id)).textContent() === title, `${id} to read ${title}`)
})
