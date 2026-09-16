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
When("this node's inbox wake becomes {string}", async function(this: OlaiWorld, value: string) {
  const nodes = this.servedNodes("inbox.olai")
  const node = nodes.find(node => node.id === "mail-inbox-agent")!
  node.custom = { ...(node.custom as object), "mail-inbox": value }
  this.writeServed("inbox.olai", nodes.map(node => JSON.stringify(node)).join("\n"))
  await this.waitUntil(async () => (await this.page.locator('[data-node-id="mail-inbox-agent"]').allTextContents()).join(" ").includes(value), `mail-inbox ${value}`)
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
  const before = calls(this).filter(call => call.verb === "history.list").length
  const since = Date.now()
  await this.waitUntil(async () => Date.now() - since >= 1000, "one second of silence")
  assert.equal(calls(this).filter(call => call.verb === "history.list").length, before)
})

Given("inbox consent is named {string}", function(this: OlaiWorld, key: string) {
  this.writeServed("_olai/Properties.olai", JSON.stringify({ id: "inbox-consent", ord: "a0", title: key, custom: { type: "mail-inbox" } }))
  const nodes = this.servedNodes("inbox.olai")
  for (const node of nodes) {
    const custom = node.custom as Record<string, string>
    const value = custom["mail-inbox"]
    delete custom["mail-inbox"]
    if (value !== undefined) custom[key] = value
  }
  this.writeServed("inbox.olai", nodes.map(node => JSON.stringify(node)).join("\n"))
})
