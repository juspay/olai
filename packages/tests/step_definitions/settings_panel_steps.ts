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
  .locator(`${selector(TESTID.pluginKnob)}${attr("data-config", key)}`)
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
Then("the plugin {string} line has only its labelled enable switch", async function(this: OlaiWorld, name: string) {
  const line = owner(this, name)
  assert.equal(await line.getByRole("switch", { name: `Enable ${name}`, exact: true }).count(), 1)
  assert.equal(await line.locator('[data-testid="plugin-summary"], [data-testid="plugin-defaults"]').count(), 0)
})
When("I focus the enable switch for {string}", async function(this: OlaiWorld, name: string) {
  await (await this.showPluginRow(name)).getByRole("switch", { name: `Enable ${name}`, exact: true }).focus()
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
  await control(this, name, key).locator(selector(TESTID.pluginReset)).click()
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
  await this.waitUntil(async () => await line.locator("[title]").evaluateAll((elements, text) => elements.some(el => el.getAttribute("title") === text), text), "the frozen control's reason")
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

Then("the plugins panel remains open", async function(this: OlaiWorld) {
  assert.equal(await this.pluginsPanel().isVisible(), true)
})

Then("the plugin {string} is off without prose", async function(this: OlaiWorld, name: string) {
  const row = await this.showPluginRow(name)
  await this.waitUntil(async () => await row.getByRole("switch", { name: `Enable ${name}`, exact: true }).getAttribute("aria-checked") === "false", "the off switch")
  assert.equal(await row.locator('[data-testid="prefs-hint"]').count(), 0)
  assert.equal(await row.getAttribute("data-off"), "true")
})
Then("the plugin {string} has a session-only switch ring", async function(this: OlaiWorld, name: string) {
  const row = await this.showPluginRow(name)
  const toggle = row.getByRole("switch", { name: `Enable ${name}`, exact: true })
  await this.waitUntil(async () => await toggle.getAttribute("title") === "session-only", "the session switch")
  assert.equal(await toggle.evaluate(el => getComputedStyle(el, "::before").borderTopStyle), "dashed")
  assert.ok(!(await row.innerText()).includes("session-only"))
})
Then("the first choice of {string} setting {string} has focus", async function(this: OlaiWorld, name: string, key: string) {
  assert.equal(await control(this, name, key).locator('[aria-pressed]').first().evaluate(el => el === document.activeElement), true)
})
Then("the plugins panel is square and has no horizontal overflow", async function(this: OlaiWorld) {
  const panel = this.pluginsPanel()
  const box = await panel.boundingBox()
  assert.ok(box)
  assert.ok(Math.abs(box.width / box.height - 1) <= .1, `panel is ${box.width} × ${box.height}`)
  assert.equal(await panel.evaluate(el => el.scrollWidth <= el.clientWidth), true)
  assert.equal(await panel.locator('.plugins-grid-body').evaluate(el => el.scrollWidth <= el.clientWidth), true)
  assert.equal(await panel.locator('.plugins-grid-columns').evaluate(el => getComputedStyle(el).columnCount), "2")
})
Then("the {string} setting {string} shows refused file text {string} inline with default {string}", async function(this: OlaiWorld, name: string, key: string, raw: string, fallback: string) {
  const line = control(this, name, key)
  await this.waitUntil(async () => await line.locator('input').inputValue() === raw, "the refused file spelling")
  assert.equal(await line.locator('input').getAttribute('aria-invalid'), "true")
  const problem = await line.locator(selector(TESTID.pluginProblem)).innerText()
  assert.ok(problem.includes(`· using ${fallback}`))
  assert.ok(!problem.includes("SchemaError("), problem)
  assert.equal(await line.locator(selector(TESTID.pluginSource)).count(), 0)
  assert.equal(await line.locator(selector(TESTID.pluginReset)).isVisible(), true)
})
When("I open the settings file from the panel header", async function(this: OlaiWorld) {
  await this.pluginsPanel().locator(selector(TESTID.pluginsFile)).click()
})
Then("the plugins panel section counts match their switches", async function(this: OlaiWorld) {
  for (const group of await this.pluginsPanel().locator(selector(TESTID.pluginGroup)).all()) {
    const switches = group.locator('[data-plugin-line] > [role="switch"]')
    const enabled = await switches.evaluateAll(elements => elements.filter(el => el.getAttribute('aria-checked') === 'true').length)
    const off = await switches.count() - enabled
    const expected = off === 0 ? `${enabled} on` : enabled === 0 ? `${off} off` : `${enabled} on · ${off} off`
    assert.equal(await group.locator('[data-group-count]').innerText(), expected)
  }
})

Then("the address names the settings file", async function(this: OlaiWorld) {
  await this.waitUntil(async () => decodeURIComponent(this.page.url()).includes("_olai/Settings.olai"), "the settings file address")
})
Then("the plugins panel has one column and fits the phone", async function(this: OlaiWorld) {
  const panel = this.pluginsPanel()
  const box = await panel.boundingBox()
  assert.ok(box)
  assert.ok(box.x >= 0 && box.x + box.width <= this.viewport().width)
  assert.equal(await panel.locator('.plugins-grid-columns').evaluate(el => getComputedStyle(el).columnCount), "1")
  assert.equal(await panel.locator('.plugins-grid-body').evaluate(el => el.scrollWidth <= el.clientWidth), true)
  assert.equal(await panel.evaluate(el => getComputedStyle(el).aspectRatio), "auto")
})

Then("every plugin enable switch has a session-only ring", async function(this: OlaiWorld) {
  const switches = this.pluginsPanel().getByRole("switch", { name: /^Enable /, includeHidden: true })
  await this.waitUntil(async () => {
    const titles = await switches.evaluateAll(elements => elements.map(el => el.getAttribute("title")))
    return titles.length > 1 && titles.every(title => title === "session-only")
  }, "every enable switch becomes session-only while the reader is absent")
  for (const toggle of await switches.all()) {
    assert.equal(await toggle.evaluate(el => getComputedStyle(el, "::before").borderTopStyle), "dashed")
  }
})

Given("the roster includes wrapper and operator environment readings", async function(this: OlaiWorld) {
  await this.page.routeWebSocket(url => url.pathname === "/rpc/ws", client => {
    const server = client.connectToServer()
    server.onMessage(message => {
      const replace = (value: unknown): void => {
        if (value === null || typeof value !== "object") return
        if (Array.isArray(value)) { value.forEach(replace); return }
        const object = value as Record<string, unknown>
        if (object.name === "codex" && Array.isArray(object.environment)) {
          object.environment = [
            { key: "WRAPPED_BIN", kind: "resource", set: true, value: "/nix/store/build-default/bin/tool", source: "wrapper", says: "built executable" },
            { key: "OPERATOR_BIN", kind: "resource", set: true, value: "/nix/store/operator/bin/tool", says: "operator executable" },
            { key: "EMPTY_PATH", kind: "resource", set: false, says: "optional path" },
            { key: "PRIVATE_TOKEN", kind: "secret", set: true, says: "credential" },
          ]
        }
        Object.values(object).forEach(replace)
      }
      for (const line of String(message).split("\n").filter(Boolean)) {
        const frame = JSON.parse(line)
        replace(frame)
        client.send(JSON.stringify(frame) + "\n")
      }
    })
  })
})
Then("the panel hides wrapper defaults and shows operator environment readings", async function(this: OlaiWorld) {
  const row = await this.showPluginRow("codex")
  await this.waitUntil(async () => (await row.innerText()).includes("/nix/store/operator/bin/tool"), "the operator reading")
  assert.equal(await row.locator('[data-config="WRAPPED_BIN"]').count(), 0)
  assert.ok(!(await row.innerText()).includes("/nix/store/build-default"))
  assert.equal(await row.locator('[data-config="EMPTY_PATH"]').innerText(), "path env · unset")
  assert.equal(await row.locator('[data-config="PRIVATE_TOKEN"]').innerText(), "token env · set")
  assert.equal(await row.locator('[data-config="OPERATOR_BIN"] input').count(), 0)
})
