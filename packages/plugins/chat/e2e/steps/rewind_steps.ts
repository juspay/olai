import assert from "node:assert/strict"
import { writeFileSync, rmSync, existsSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { Then, When } from "@olai/tests/harness/runner.ts"
import { PLUGIN_TESTID } from "@olai/tests/harness/testids.ts"
import type { OlaiWorld } from "@olai/tests/harness/world.ts"
import { selector } from "@olai/web/testlib"

const message = (world: OlaiWorld, text: string) => world.chat(selector(PLUGIN_TESTID.chatEntry))
  .filter({ has: world.page.locator(selector(PLUGIN_TESTID.chatMine)).filter({ hasText: text }) }).first()
const question = (world: OlaiWorld) => world.page.getByRole("group", { name: "Confirm edit from here", exact: true })
const askToEdit = async (world: OlaiWorld, text: string) => {
  const button = message(world, text).locator(selector(PLUGIN_TESTID.chatRewind))
  assert.equal(await button.getAttribute("aria-label"), "Edit from here")
  await button.click()
  await world.waitUntil(async () => await question(world).isVisible(), "the edit confirmation")
}
const confirmEdit = async (world: OlaiWorld) => {
  await question(world).getByRole("button", { name: "Edit from here", exact: true }).click()
}
When("I rewind my message {string}", async function(this: OlaiWorld, text: string) {
  await askToEdit(this, text)
  await confirmEdit(this)
})
When("I click the stale rewind action for {string}", async function(this: OlaiWorld, text: string) {
  await askToEdit(this, text)
  await confirmEdit(this)
})
When("I ask to edit my message {string}", async function(this: OlaiWorld, text: string) {
  await askToEdit(this, text)
  const cancel = question(this).getByRole("button", { name: "Cancel", exact: true })
  await this.waitUntil(async () => await cancel.evaluate(button => button === document.activeElement), "Cancel to receive focus")
  const box = await question(this).boundingBox()
  assert.ok(box && box.x >= 0 && box.x + box.width <= this.page.viewportSize()!.width)
})
When("I dismiss editing with {string}", async function(this: OlaiWorld, dismissal: string) {
  if (dismissal === "Cancel") await question(this).getByRole("button", { name: "Cancel", exact: true }).click()
  else if (dismissal === "Escape") await this.page.keyboard.press("Escape")
  else if (dismissal === "click-away") await this.chat(selector(PLUGIN_TESTID.chatInput)).click()
  else assert.fail(`unknown dismissal ${dismissal}`)
  await this.waitUntil(async () => await question(this).count() === 0, "the edit question to close")
  if (dismissal !== "click-away") assert.equal(await this.page.locator(":focus").getAttribute("data-testid"), PLUGIN_TESTID.chatRewind)
})
Then("no fork request has reached the agent", function(this: OlaiWorld) {
  assert.equal(existsSync(join(this.scratch(), ".agent-fork-requested")), false)
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
    return { x: box.x, right: box.right, width: box.width, height: box.height, bubbleX: before.x,
      coarse: matchMedia("(pointer: coarse)").matches, opacity: getComputedStyle(button).opacity,
      before: before.height, after: after.height }
  })
  assert.equal(geometry.before, geometry.after)
  assert.ok(geometry.x >= 0 && geometry.right <= geometry.bubbleX)
  assert.equal(await action.getAttribute("title"), "Edit from here")
  assert.equal(await action.locator('svg[aria-hidden="true"]').count(), 1)
  if (geometry.coarse) {
    assert.ok(geometry.width >= 44 && geometry.height >= 44)
    assert.equal(geometry.opacity, "1")
  } else assert.ok(geometry.width <= 32)
  await action.hover()
  await this.waitUntil(async () => await action.evaluate(button => getComputedStyle(button).opacity === "1"), "hover to reveal rewind")
})

When("the next fresh conversation will hang", function(this: OlaiWorld) {
  writeFileSync(join(this.scratch(), ".agent-hold-new"), "")
})
