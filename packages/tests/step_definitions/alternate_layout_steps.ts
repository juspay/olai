import { Then, When } from "@cucumber/cucumber"
import type { OlaiWorld } from "../support/world.ts"

Then("the alternate layout fixture is mounted", async function(this: OlaiWorld) {
  await this.page.getByRole("main", { name: "Alternate layout fixture" }).waitFor({ state: "visible" })
})
When("the alternate layout opens Markdown", async function(this: OlaiWorld) {
  await this.page.getByRole("button", { name: "Open Markdown fixture", exact: true }).click()
})
When("the alternate layout opens the outline", async function(this: OlaiWorld) {
  await this.page.getByRole("button", { name: "Open outline fixture", exact: true }).click()
})
