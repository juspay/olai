import * as assert from "node:assert"
import { Then, When } from "@olai/tests/harness/runner.ts"
import type { OlaiWorld } from "@olai/tests/harness/world.ts"
import { oneLine } from "@olai/tests/harness/world.ts"

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

Then("no search kind selector is drawn", async function(this: OlaiWorld) {
  assert.strictEqual(await this.page.getByRole("radiogroup", { name: "Search kind" }).count(), 0)
})
