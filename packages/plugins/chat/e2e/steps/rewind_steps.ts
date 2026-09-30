import assert from "node:assert/strict"
import { writeFileSync, rmSync, existsSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { Then, When } from "@olai/tests/harness/runner.ts"
import { PLUGIN_TESTID } from "@olai/tests/harness/testids.ts"
import type { OlaiWorld } from "@olai/tests/harness/world.ts"
import { selector } from "@olai/web/testlib"

const message = (world: OlaiWorld, text: string) => world.chat(selector(PLUGIN_TESTID.chatEntry))
  .filter({ has: world.page.locator(selector(PLUGIN_TESTID.chatMine)).filter({ hasText: text }) }).first()
When("I rewind my message {string}", async function(this: OlaiWorld, text: string) {
  await message(this, text).locator(selector(PLUGIN_TESTID.chatRewind)).click()
})
When("I click the stale rewind action for {string}", async function(this: OlaiWorld, text: string) {
  await message(this, text).locator(selector(PLUGIN_TESTID.chatRewind)).click()
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
  rmSync(join(this.scratch(), ".agent-hold-load"), { force: true })
})
Then("rewind reports a failure", async function(this: OlaiWorld) {
  await this.waitUntil(async () => (await this.chat(selector(PLUGIN_TESTID.chatRefused)).innerText()).length > 0,
    "rewind's refusal to reach the person")
})
Then("the chat offers no rewind actions", async function(this: OlaiWorld) {
  await this.waitUntil(async () => await this.chatRoot().locator(selector(PLUGIN_TESTID.chatRewind)).count() === 0,
    "rewind to be unavailable")
})

When("the rewind fixture omits message identities", function(this: OlaiWorld) {
  writeFileSync(join(this.scratch(), ".agent-omit-message-ids"), "")
})
When("the rewind fixture does not advertise fork", function(this: OlaiWorld) {
  writeFileSync(join(this.scratch(), ".agent-no-fork"), "")
})
Then("my message {string} has no rewind action", async function(this: OlaiWorld, text: string) {
  assert.equal(await message(this, text).locator(selector(PLUGIN_TESTID.chatRewind)).count(), 0)
})

Then("the rewind is waiting for replay", async function(this: OlaiWorld) {
  await this.waitUntil(async () => existsSync(join(this.scratch(), ".agent-loading")), "the fork's replay request to reach the adapter")
})

Then("the agent store contains {int} conversation", function(this: OlaiWorld, count: number) {
  assert.equal(readdirSync(join(this.scratch(), ".agent-persistent-sessions")).filter(name => name.endsWith(".json")).length, count)
})
Then("the two answer items occupy separate rows", async function(this: OlaiWorld) {
  const rows = this.chat(selector(PLUGIN_TESTID.chatEntry))
  await this.waitUntil(async () => await rows.filter({ hasText: "First answer item." }).count() === 1
    && await rows.filter({ hasText: "Second answer item." }).count() === 1, "both answer items")
  assert.equal(await rows.filter({ hasText: "First answer item." }).filter({ hasText: "Second answer item." }).count(), 0)
})

Then("the rewind control sits beside the bubble without moving it", async function(this: OlaiWorld) {
  const action = this.chat(selector(PLUGIN_TESTID.chatRewind)).last()
  const geometry = await action.evaluate(button => {
    const bubble = button.parentElement!
    const before = bubble.getBoundingClientRect()
    const box = button.getBoundingClientRect()
    const style = button.getAttribute("style")
    button.style.display = "none"
    const after = bubble.getBoundingClientRect()
    if (style === null) button.removeAttribute("style"); else button.setAttribute("style", style)
    return { x: box.x, right: box.right, bubbleX: before.x, before: before.height, after: after.height }
  })
  assert.equal(geometry.before, geometry.after)
  assert.ok(geometry.x >= 0 && geometry.right <= geometry.bubbleX)
  await action.hover()
  await this.waitUntil(async () => await action.evaluate(button => getComputedStyle(button).opacity === "1"), "hover to reveal rewind")
})

When("the next fresh conversation will hang", function(this: OlaiWorld) {
  writeFileSync(join(this.scratch(), ".agent-hold-new"), "")
})
