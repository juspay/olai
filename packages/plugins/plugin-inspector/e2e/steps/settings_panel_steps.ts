/** Drive the real controls; disk assertions observe the ordinary write door. */
import * as assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { Given, When, Then } from "@olai/tests/harness/runner.ts"
import { TESTID } from "@olai/tests/harness/testids.ts"
import { selector } from "@olai/web/testlib"
import { attr, POLL_TIMEOUT, type OlaiWorld } from "@olai/tests/harness/world.ts"
import type { Locator } from "@olai/tests/harness/playwright.ts"

/** A row's disclosure: the name button, which only a row with something to
 *  reveal draws. A row with nothing to reveal draws its name as plain text. */
export const ROW_TOGGLE = "button.plugins-name[aria-expanded]"

/** The Server section at the foot of the panel — a `<details>`, shut until
 *  somebody opens it. */
export const serverSection = (world: OlaiWorld): Locator =>
  world.pluginsPanel().locator(selector(TESTID.thisServe))

/** Open the Server section the way a person does — its heading — unless it is
 *  already open. */
export const openServerSection = async (world: OlaiWorld): Promise<Locator> => {
  const section = serverSection(world)
  await section.waitFor({ state: "attached", timeout: POLL_TIMEOUT })
  await world.waitUntil(async () => {
    if (await section.getAttribute("open") !== null) return true
    await section.locator("summary").first().click({ timeout: 2000 }).catch(() => undefined)
    return await section.getAttribute("open") !== null
  }, "the Server section to open")
  return section
}

/**
 * ONE ROW WITH ITS GROUP OPEN, and nothing else pressed — the row's own detail
 * stays as it was, so a step can ask whether it is open. The heading is
 * pressed the way a person presses it, walking up from the row rather than
 * naming the group, since a shell remount can redraw the group around it.
 */
export const shownLine = async (world: OlaiWorld, name: string): Promise<Locator> => {
  const row = world.pluginsPanel().locator(`[data-testid="prefs-row"]${attr("data-pref", `plugin-${name}`)}`)
  await row.waitFor({ state: "attached", timeout: POLL_TIMEOUT })
  const opened = await row.evaluate((el) => {
    const details = el.closest("details")
    if (!(details instanceof HTMLDetailsElement) || details.open) return false
    const summary = details.querySelector(":scope > summary")
    if (summary instanceof HTMLElement) summary.click()
    details.open = true
    return true
  })
  if (opened) await world.waitForFrame()
  return row
}

/**
 * ONE ROW, ITS GROUP OPEN AND ITS DETAIL SHOWN — the chevron press a person
 * makes before reaching a knob. Pressed only while the row reads collapsed, so
 * asking twice is asking once; and re-resolved on every try, because a switch
 * elsewhere can republish the roster and redraw the row under the press. A row
 * with nothing to reveal has no chevron, and is returned as it is.
 */
export const expandedRow = async (world: OlaiWorld, name: string): Promise<Locator> => {
  if (name === "olai") return openServerSection(world)
  await world.waitUntil(async () => {
    const toggle = (await shownLine(world, name)).locator(ROW_TOGGLE)
    if (await toggle.count() === 0) return true
    if (await toggle.getAttribute("aria-expanded") === "true") return true
    await toggle.click({ timeout: 2000 }).catch(() => undefined)
    return await toggle.getAttribute("aria-expanded").catch(() => null) === "true"
  }, `the ${name} row to show its detail`)
  return shownLine(world, name)
}

/** What a session-only switch says on hover (`@olai/ui-primitives`'s Switch). */
const SESSION_TITLE = "Resets when olai restarts"

const control = async (world: OlaiWorld, name: string, key: string): Promise<Locator> =>
  (await expandedRow(world, name)).locator(`${selector(TESTID.pluginKnob)}${attr("data-config", key)}`)
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
/**
 * THE ROW AT REST IS ONE LINE: the build's label for it, its switch, and
 * nothing else while it is fine — no state words, no summary, and its detail
 * shut. The switch is labelled with the name the row shows ("Enable Git"),
 * which is the build's label where it has one.
 */
Then("the plugin {string} line reads {string} beside its labelled enable switch", async function(this: OlaiWorld, name: string, label: string) {
  const row = await shownLine(this, name)
  const line = row.locator(".plugins-line")
  await this.waitUntil(async () => (await line.locator(".plugins-name-text").innerText()).trim() === label,
    `the ${name} line to read ${JSON.stringify(label)}`)
  assert.equal(await line.getByRole("switch", { name: `Enable ${label}`, exact: true }).count(), 1)
  assert.equal(await line.locator(".plugins-status").count(), 0)
  assert.equal(await row.locator('[data-testid="plugin-summary"], [data-testid="plugin-defaults"]').count(), 0)
})
When("I focus the enable switch for {string}", async function(this: OlaiWorld, name: string) {
  await (await this.showPluginRow(name)).locator(selector(TESTID.pluginSwitch)).focus()
})
Then("the {string} setting {string} has focus", async function(this: OlaiWorld, name: string, key: string) {
  assert.equal(await (await control(this, name, key)).locator("input").evaluate(el => el === document.activeElement), true)
})
When("I pick {string} for {string} setting {string}", async function(this: OlaiWorld, value: string, name: string, key: string) {
  const line = await control(this, name, key)
  await line.locator(`button${attr("data-value", value)}`).click()
})
When("I type {string} into {string} setting {string}", async function(this: OlaiWorld, value: string, name: string, key: string) {
  await (await control(this, name, key)).locator("input").fill(value)
})
When("I press {string} in {string} setting {string}", async function(this: OlaiWorld, keypress: string, name: string, key: string) {
  await (await control(this, name, key)).locator("input").press(keypress)
})
When("I leave {string} setting {string}", async function(this: OlaiWorld, name: string, key: string) {
  await (await control(this, name, key)).locator("input").blur()
})
When("I use the default for {string} setting {string}", async function(this: OlaiWorld, name: string, key: string) {
  await (await control(this, name, key)).locator(selector(TESTID.pluginReset)).click()
})
When("I toggle {string} setting {string}", async function(this: OlaiWorld, name: string, key: string) {
  await (await control(this, name, key)).getByRole("switch").click()
})
When("I select {string} for {string} setting {string}", async function(this: OlaiWorld, value: string, name: string, key: string) {
  await (await control(this, name, key)).locator("select").selectOption(value)
})
Then("the {string} setting {string} problem says {string}", async function(this: OlaiWorld, name: string, key: string, text: string) {
  await this.waitUntil(async () => (await (await control(this, name, key)).locator(selector(TESTID.pluginProblem)).allTextContents()).some(value => value.includes(text)), "the field's refusal")
})
Then("the {string} setting {string} has no problem", async function(this: OlaiWorld, name: string, key: string) {
  await this.waitUntil(async () => await (await control(this, name, key)).locator(selector(TESTID.pluginProblem)).count() === 0, "the repaired field")
})
Then("the {string} setting {string} is frozen because {string}", async function(this: OlaiWorld, name: string, key: string, text: string) {
  const line = await control(this, name, key)
  await this.waitUntil(async () => await line.locator("[title]").evaluateAll((elements, text) => elements.some(el => el.getAttribute("title") === text), text), "the frozen control's reason")
  const inputs = line.locator("input, select, button")
  assert.ok(await inputs.count() > 0)
  for (const input of await inputs.all()) assert.equal(await input.isDisabled(), true)
})
Then("the {string} setting {string} is an integer input from {int} to {int}", async function(this: OlaiWorld, name: string, key: string, min: number, max: number) {
  const input = (await control(this, name, key)).locator("input")
  assert.equal(await input.getAttribute("type"), "number")
  assert.equal(await input.getAttribute("inputmode"), "numeric")
  assert.equal(await input.getAttribute("min"), String(min))
  assert.equal(await input.getAttribute("max"), String(max))
  assert.equal(await input.getAttribute("step"), "1")
})
Then("the {string} setting {string} suggests {string}", async function(this: OlaiWorld, name: string, key: string, expected: string) {
  assert.equal(await (await control(this, name, key)).locator("input").getAttribute("placeholder"), expected)
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
  await this.waitUntil(async () => await row.locator(selector(TESTID.pluginSwitch)).getAttribute("aria-checked") === "false", "the off switch")
  assert.equal(await row.locator('[data-testid="prefs-hint"]').count(), 0)
  assert.equal(await row.getAttribute("data-off"), "true")
})
Then("the plugin {string} has a session-only switch ring", async function(this: OlaiWorld, name: string) {
  const row = await this.showPluginRow(name)
  const toggle = row.locator(selector(TESTID.pluginSwitch))
  await this.waitUntil(async () => await toggle.getAttribute("title") === SESSION_TITLE, "the session switch")
  assert.equal(await toggle.evaluate(el => getComputedStyle(el, "::before").borderTopStyle), "dashed")
  // The words live in the row's detail, once, rather than beside the switch.
  assert.ok(!(await row.locator(".plugins-line").innerText()).includes("restarts"))
  const opened = await expandedRow(this, name)
  await this.waitUntil(async () => (await opened.locator(".plugins-note").allInnerTexts()).includes("This switch resets when olai restarts."),
    `the ${name} detail to say its switch is session-only`)
})
Then("the first choice of {string} setting {string} has focus", async function(this: OlaiWorld, name: string, key: string) {
  assert.equal(await (await control(this, name, key)).locator('[aria-pressed]').first().evaluate(el => el === document.activeElement), true)
})
/** One column of groups, and nothing wider than the panel it sits in. */
Then("the plugins panel is one column and has no horizontal overflow", async function(this: OlaiWorld) {
  const panel = this.pluginsPanel()
  const box = await panel.boundingBox()
  assert.ok(box)
  const view = this.viewport()
  assert.ok(box.x >= 0 && box.x + box.width <= view.width, `panel spans ${box.x}..${box.x + box.width} of ${view.width}`)
  assert.equal(await panel.evaluate(el => el.scrollWidth <= el.clientWidth), true)
  assert.equal(await panel.locator(".plugins-body").evaluate(el => el.scrollWidth <= el.clientWidth), true)
  // Every group heading starts at the same left edge: a single column.
  const lefts = await panel.locator(selector(TESTID.pluginGroup)).evaluateAll(groups => groups.map(group => Math.round(group.getBoundingClientRect().left)))
  assert.ok(lefts.length > 0)
  assert.equal(new Set(lefts).size, 1, `groups start at ${lefts.join(", ")}`)
})
Then("the {string} setting {string} shows refused file text {string} inline with default {string}", async function(this: OlaiWorld, name: string, key: string, raw: string, fallback: string) {
  const line = await control(this, name, key)
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
/** Each heading counts its own rows' switches; Needs attention counts its rows. */
Then("the plugins panel section counts match their switches", async function(this: OlaiWorld) {
  const groups = await this.pluginsPanel().locator(selector(TESTID.pluginGroup)).all()
  assert.ok(groups.length > 0)
  for (const group of groups) {
    const switches = group.locator('[data-plugin-line] > .plugins-line > [role="switch"]')
    const total = await switches.count()
    assert.ok(total > 0, `the group ${await group.getAttribute("data-section")} draws no rows`)
    const enabled = await switches.evaluateAll(elements => elements.filter(el => el.getAttribute('aria-checked') === 'true').length)
    const off = total - enabled
    const expected = await group.getAttribute("data-needs") === "true" ? String(total)
      : off === 0 ? `${enabled} on` : enabled === 0 ? `${off} off` : `${enabled} on · ${off} off`
    // `textContent`, since a shut heading's count is still on screen while
    // its rows are not.
    assert.equal((await group.locator('[data-group-count]').textContent())?.trim(), expected)
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
  assert.equal(await panel.locator(".plugins-body").evaluate(el => el.scrollWidth <= el.clientWidth), true)
  const lefts = await panel.locator(selector(TESTID.pluginGroup)).evaluateAll(groups => groups.map(group => Math.round(group.getBoundingClientRect().left)))
  assert.equal(new Set(lefts).size, 1, `groups start at ${lefts.join(", ")}`)
})

Then("every plugin enable switch has a session-only ring", async function(this: OlaiWorld) {
  const switches = this.pluginsPanel().getByRole("switch", { name: /^Enable /, includeHidden: true })
  await this.waitUntil(async () => {
    const titles = await switches.evaluateAll(elements => elements.map(el => el.getAttribute("title")))
    return titles.length > 1 && titles.every(title => title === SESSION_TITLE)
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
  const row = await expandedRow(this, "codex")
  await this.waitUntil(async () => (await row.innerText()).includes("/nix/store/operator/bin/tool"), "the operator reading")
  assert.equal(await row.locator('[data-config="WRAPPED_BIN"]').count(), 0)
  assert.ok(!(await row.innerText()).includes("/nix/store/build-default"))
  // Each reading is labelled by its own description and carries its variable
  // beneath the value; a secret says only whether it is there.
  const text = await row.innerText()
  assert.ok(text.includes("Operator executable"), text)
  const empty = row.locator('[data-config="EMPTY_PATH"]')
  assert.equal(await empty.getAttribute("data-value"), "unset")
  assert.ok((await empty.innerText()).includes("Not set"))
  assert.ok((await empty.innerText()).includes("EMPTY_PATH"))
  const token = row.locator('[data-config="PRIVATE_TOKEN"]')
  assert.equal(await token.getAttribute("data-value"), "set")
  assert.equal((await token.innerText()).split("\n")[0]?.trim(), "Set")
  assert.equal(await row.locator('[data-config="OPERATOR_BIN"] input').count(), 0)
})
Then("the plugin {string} env reading {string} is wrapper-provided and hidden", async function(this: OlaiWorld, name: string, key: string) {
  const row = await this.showPluginRow(name)
  // A wrapper-provided reading (source: "wrapper", named by the generated
  // OLAI_WRAPPER_DEFAULTS) is not a machine input a person can change here, so
  // the panel hides it from the row's env grid. If the wrapper-defaults
  // plumbing broke, OLAI_ODU_BIN would render as an editable operator reading
  // ("bin env · <path>"), which is the discriminating absence this asserts.
  await this.waitUntil(async () => await row.locator(attr("data-config", key)).count() === 0, `the ${name} wrapper reading to stay hidden`)
})
