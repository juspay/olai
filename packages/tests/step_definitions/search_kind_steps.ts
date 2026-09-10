import * as assert from "node:assert"
import { Then, When } from "@cucumber/cucumber"
import type { OlaiWorld } from "../support/world.ts"
import { oneLine } from "../support/world.ts"

When("I pick search kind {string}", async function(this: OlaiWorld, kind: string) {
  await this.page.getByRole("radio", { name: kind, exact: true }).click()
})
Then("search kind {string} is selected", async function(this: OlaiWorld, kind: string) {
  await this.waitUntil(async () => await this.page.getByRole("radio", { name: kind, exact: true }).getAttribute("aria-checked") === "true", `${kind} to be selected`)
  assert.ok(await this.page.locator("input:focus").count() > 0, "the caret stays in the search box")
})
Then("the search segment {string} shows count {int}", async function(this: OlaiWorld, kind: string, count: number) {
  await this.waitUntil(async () => oneLine(await this.page.getByRole("radio", { name: kind, exact: true }).innerText()) === `${kind} ${count}`, `${kind} to report ${count}`)
})
