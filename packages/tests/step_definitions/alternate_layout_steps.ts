import { Then, When } from "@cucumber/cucumber"
import type { OlaiWorld } from "../support/world.ts"

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
