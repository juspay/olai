/** Drive the real controls; disk assertions observe the ordinary write door. */
import * as assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { Given, When, Then } from "@cucumber/cucumber"
import { TESTID } from "@olai/bundle/testids"
import { selector } from "@olai/web/testlib"
import { attr, POLL_TIMEOUT, type OlaiWorld } from "../support/world.ts"

const owner = (world: OlaiWorld, name: string) => world.pluginsPanel().locator(
  name === "olai" ? '[data-testid="this-serve"]' : attr("data-pref", `plugin-${name}`),
)
const control = (world: OlaiWorld, name: string, key: string) => owner(world, name)
  .locator(`${selector(TESTID.pluginControl)}${attr("data-config", key)}`)
const held = new WeakMap<OlaiWorld, { file: string; contents: string; pid: number | undefined }>()

When("I remember the settings file {string}", function(this: OlaiWorld, file: string) {
  held.set(this, { file, contents: readFileSync(join(this.scratch(), file), "utf8"), pid: this.ownServer?.pid })
})
Then("the remembered settings file is unchanged", function(this: OlaiWorld) {
  const before = held.get(this)
  assert.ok(before)
  assert.equal(readFileSync(join(this.scratch(), before.file), "utf8"), before.contents)
})
Then("the same serve process is running", function(this: OlaiWorld) {
  const before = held.get(this)
  assert.ok(before?.pid)
  assert.equal(this.ownServer?.pid, before.pid)
  assert.equal(this.ownServer?.exitCode, null)
})
Then("the plugin {string} has summary {string}", async function(this: OlaiWorld, name: string, text: string) {
  await this.waitUntil(async () => await owner(this, name).locator(selector(TESTID.pluginSummary)).innerText() === text, "the effective configuration summary")
})
Then("the plugin {string} line has only its labelled enable switch", async function(this: OlaiWorld, name: string) {
  const line = owner(this, name).locator("[data-plugin-line]")
  assert.equal(await line.locator("button, input, select, a, summary").count(), 1)
  assert.equal(await line.getByRole("switch", { name: `Enable ${name}`, exact: true }).count(), 1)
  assert.ok(!(await line.innerText()).includes("·default"))
})
When("I focus the enable switch for {string}", async function(this: OlaiWorld, name: string) {
  await (await this.showPluginRow(name)).getByRole("switch", { name: `Enable ${name}`, exact: true }).focus()
})
Then("the {string} configuration disclosure has focus", async function(this: OlaiWorld, name: string) {
  assert.equal(await owner(this, name).locator("details > summary").evaluate(el => el === document.activeElement), true)
})
Then("the {string} setting {string} has focus", async function(this: OlaiWorld, name: string, key: string) {
  assert.equal(await control(this, name, key).locator("input").evaluate(el => el === document.activeElement), true)
})
When("I pick {string} for {string} setting {string}", async function(this: OlaiWorld, value: string, name: string, key: string) {
  const line = control(this, name, key)
  await line.locator(`button${attr("data-value", value)}`).click()
})
When("I type {string} into {string} setting {string}", async function(this: OlaiWorld, value: string, name: string, key: string) {
  await control(this, name, key).locator("input").fill(value)
})
When("I press {string} in {string} setting {string}", async function(this: OlaiWorld, keypress: string, name: string, key: string) {
  await control(this, name, key).locator("input").press(keypress)
})
When("I leave {string} setting {string}", async function(this: OlaiWorld, name: string, key: string) {
  await control(this, name, key).locator("input").blur()
})
When("I use the default for {string} setting {string}", async function(this: OlaiWorld, name: string, key: string) {
  await control(this, name, key).locator(selector(TESTID.pluginUseDefault)).click()
})
When("I toggle {string} setting {string}", async function(this: OlaiWorld, name: string, key: string) {
  await control(this, name, key).getByRole("switch").click()
})
When("I select {string} for {string} setting {string}", async function(this: OlaiWorld, value: string, name: string, key: string) {
  await control(this, name, key).locator("select").selectOption(value)
})
Then("the {string} setting {string} problem says {string}", async function(this: OlaiWorld, name: string, key: string, text: string) {
  await this.waitUntil(async () => (await control(this, name, key).locator(selector(TESTID.pluginProblem)).allTextContents()).some(value => value.includes(text)), "the field's refusal")
})
Then("the {string} setting {string} has no problem", async function(this: OlaiWorld, name: string, key: string) {
  await this.waitUntil(async () => await control(this, name, key).locator(selector(TESTID.pluginProblem)).count() === 0, "the repaired field")
})
Then("the {string} setting {string} is frozen because {string}", async function(this: OlaiWorld, name: string, key: string, text: string) {
  const line = control(this, name, key)
  await this.waitUntil(async () => (await line.innerText()).includes(text), "the frozen control's reason")
  const inputs = line.locator("input, select, button")
  assert.ok(await inputs.count() > 0)
  for (const input of await inputs.all()) assert.equal(await input.isDisabled(), true)
})
Then("the {string} setting {string} is an integer input from {int} to {int}", async function(this: OlaiWorld, name: string, key: string, min: number, max: number) {
  const input = control(this, name, key).locator("input")
  assert.equal(await input.getAttribute("type"), "number")
  assert.equal(await input.getAttribute("inputmode"), "numeric")
  assert.equal(await input.getAttribute("min"), String(min))
  assert.equal(await input.getAttribute("max"), String(max))
  assert.equal(await input.getAttribute("step"), "1")
})
Then("the {string} setting {string} suggests {string}", async function(this: OlaiWorld, name: string, key: string, expected: string) {
  assert.equal(await control(this, name, key).locator("input").getAttribute("placeholder"), expected)
})
Then("file {string} has namespace {string} setting {string} as {string}", async function(this: OlaiWorld, file: string, name: string, key: string, value: string) {
  await this.waitUntil(async () => {
    const nodes = this.servedNodesSoFar(file)
    let node = nodes.find(node => node.parent === undefined && (node.title === name || (node.custom as Record<string, unknown> | undefined)?.plugin === name))
    const parts = key.split(".")
    for (const part of parts.slice(0, -1)) node = nodes.find(child => child.parent === node?.id && child.title === part)
    return node !== undefined && (node.custom as Record<string, unknown> | undefined)?.[parts.at(-1)!] === (value === "<absent>" ? undefined : value)
  }, `the durable ${name}.${key} property`)
})
Then("the commit ledger includes the {string} settings namespace", async function(this: OlaiWorld, name: string) {
  const group = this.page.locator(`${selector(TESTID.commitGroup)}${attr("data-file", "_olai/Settings.olai")}`)
  await group.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  assert.ok((await group.innerText()).includes(name))
})

/** Alter only the requested key on the browser transport. The real server
 * validates it and supplies the refusal; no refusal is fabricated here. */
Given("the next browser configuration request names reserved key {string}", async function(this: OlaiWorld, key: string) {
  let replaced = false
  await this.page.routeWebSocket(url => url.pathname === "/rpc/ws", client => {
    const server = client.connectToServer()
    client.onMessage(message => {
      for (const line of String(message).split("\n").filter(Boolean)) {
        const frame = JSON.parse(line)
        if (!replaced && frame._tag === "Request" && frame.tag === "surface/plugins/configure") {
          frame.payload.key = key
          replaced = true
        }
        server.send(JSON.stringify(frame) + "\n")
      }
    })
    server.onMessage(message => client.send(message))
  })
})
