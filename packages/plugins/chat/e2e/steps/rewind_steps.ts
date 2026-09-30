import assert from "node:assert/strict"
import { writeFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import { Then, When } from "@olai/tests/harness/runner.ts"
import { PLUGIN_TESTID } from "@olai/tests/harness/testids.ts"
import type { OlaiWorld } from "@olai/tests/harness/world.ts"
import { selector } from "@olai/web/testlib"

const message = (world: OlaiWorld, text: string) => world.chat(selector(PLUGIN_TESTID.chatEntry))
  .filter({ has: world.page.locator(selector(PLUGIN_TESTID.chatMine)).filter({ hasText: text }) }).first()
When("I rewind my message {string}", async function(this: OlaiWorld, text: string) {
  await message(this, text).getByRole("button", { name: "Rewind to here", exact: true }).click()
})
When("I click the stale rewind action for {string}", async function(this: OlaiWorld, text: string) {
  await message(this, text).getByRole("button", { name: "Rewind to here", exact: true }).click()
})
Then("the rewind transcript contains {string} but not {string}", async function(this: OlaiWorld, kept: string, removed: string) {
  await this.waitUntil(async () => {
    const text = await this.chat(selector(PLUGIN_TESTID.chatTranscript)).innerText()
    return text.includes(kept) && !text.includes(removed)
  }, "the transcript to contain only the fork's history")
})
Then("the rewind transcript is empty", async function(this: OlaiWorld) {
  await this.waitUntil(async () => await this.chat(selector(PLUGIN_TESTID.chatEntry)).count() === 0, "the first-message rewind to clear the transcript")
})
When("the rewind fixture refuses {string}", function(this: OlaiWorld, operation: string) {
  assert.ok(["fork", "load"].includes(operation))
  writeFileSync(join(this.scratch(), `.agent-refuse-${operation}`), "")
})
When("the rewind fixture accepts requests", function(this: OlaiWorld) {
  for (const operation of ["fork", "load"]) rmSync(join(this.scratch(), `.agent-refuse-${operation}`), { force: true })
})
Then("rewind reports a failure", async function(this: OlaiWorld) {
  await this.waitUntil(async () => (await this.chat(selector(PLUGIN_TESTID.chatRefused)).innerText()).length > 0,
    "rewind's refusal to reach the person")
})
Then("the chat offers no rewind actions", async function(this: OlaiWorld) {
  await this.waitUntil(async () => await this.chatRoot().getByRole("button", { name: "Rewind to here", exact: true }).count() === 0,
    "rewind to be unavailable")
})
