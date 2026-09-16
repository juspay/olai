import * as assert from "node:assert"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { Given, Then, When } from "@olai/tests/harness/runner.ts"
import type { OlaiWorld } from "@olai/tests/harness/world.ts"
const rows = (world: OlaiWorld) => world.chat('[data-rang-by="mail"]')
const calls = (world: OlaiWorld): Array<{ verb: string; args: string[] }> => {
  const file = join(dirname(world.mailHimalaya!.path), "calls.ndjson")
  return existsSync(file) ? readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map(line => JSON.parse(line)) : []
}
const cursor = (world: OlaiWorld): string | null => {
  const dir = join(world.scratch() + ".xdg", "state", "olai", "mail")
  if (!existsSync(dir)) return null
  const file = readdirSync(dir).find(file => file.endsWith(".json"))
  return file ? JSON.parse(readFileSync(join(dir, file), "utf8")).historyId ?? null : null
}
const poll = async (world: OlaiWorld, value: string) => {
  const file = "_olai/Settings.olai"
  const nodes = existsSync(join(world.scratch(), file)) ? [...world.servedNodes(file)] : []
  const mail = nodes.find(node => node.title === "mail")
  if (mail) mail.custom = { ...(mail.custom as object), poll: value }
  else nodes.push({ id: "mail-settings", ord: "a9", title: "mail", custom: { on: "yes", poll: value } })
  world.writeServed(file, nodes.map(node => JSON.stringify(node)).join("\n"))
}
Given("mail checks the inbox every {string}", async function(this: OlaiWorld, value: string) { await poll(this, value) })
When("the mail poll setting becomes {string}", async function(this: OlaiWorld, value: string) { await poll(this, value) })
Then("mail has stored history cursor {string}", async function(this: OlaiWorld, id: string) {
  await this.waitUntil(async () => cursor(this) === id, `mail cursor ${id}`)
})
When("mail delivers thread {string} titled {string} to the inbox", function(this: OlaiWorld, id: string, title: string) { this.mailHimalaya!.deliver(id, title) })
When("mail delivers thread {string} titled {string} outside the inbox", function(this: OlaiWorld, id: string, title: string) { this.mailHimalaya!.deliver(id, title, false) })
When("the Gmail history cursor expires", function(this: OlaiWorld) { this.mailHimalaya!.expireHistory() })
const switchWake = async (world: OlaiWorld, on: boolean) => {
  const button = world.chat('[data-testid="mail-wake-switch"]')
  await world.waitUntil(async () => await button.count() === 1, "mail wake switch")
  if ((await button.getAttribute("aria-checked") === "true") !== on) await button.click()
  await world.waitUntil(async () => (await button.getAttribute("aria-checked") === "true") === on, `mail wake ${on ? "on" : "off"}`)
}
When("I switch the mail wake on for this conversation", async function(this: OlaiWorld) { await switchWake(this, true) })
When("I switch the mail wake off for this conversation", async function(this: OlaiWorld) { await switchWake(this, false) })
Then("the mail wake is off for this conversation", async function(this: OlaiWorld) {
  assert.equal(await this.chat('[data-testid="mail-wake-switch"]').getAttribute("aria-checked"), "false")
})
Then("this conversation has {int} mail wakes", async function(this: OlaiWorld, count: number) {
  const since = Date.now()
  await this.waitUntil(async () => await rows(this).count() === count && Date.now() - since >= 1000, `${count} mail wakes`)
})
Then("the latest mail wake names {string}", async function(this: OlaiWorld, text: string) {
  await this.waitUntil(async () => await rows(this).count() > 0, "a mail wake")
  const latest = rows(this).last()
  const fold = latest.locator('button[aria-expanded="false"]')
  if (await fold.count()) await fold.first().click()
  await this.waitUntil(async () => ((await latest.textContent()) ?? "").includes(text), `mail wake naming ${text}`)
  assert.equal(await latest.getAttribute("data-rang-by"), "mail")
})
Then("mail makes no history calls for a second", async function(this: OlaiWorld) {
  let count = calls(this).filter(call => call.verb === "history.list").length
  let quietSince = Date.now()
  await this.waitUntil(async () => {
    const next = calls(this).filter(call => call.verb === "history.list").length
    if (next !== count) { count = next; quietSince = Date.now() }
    return Date.now() - quietSince >= 1000
  }, "history calls to stop for one second")
})

Then("mail warns that the bad poll value uses its default", async function(this: OlaiWorld) {
  await this.waitUntil(async () => this.serverLog.text.includes("mail.poll") && this.serverLog.text.includes("bad") && this.serverLog.text.includes("uses its default"), "mail poll validation warning")
})
