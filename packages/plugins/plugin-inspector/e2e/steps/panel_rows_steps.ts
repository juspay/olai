import * as assert from "node:assert/strict"
import { Given, Then, When } from "@olai/tests/harness/runner.ts"
import { TESTID } from "@olai/tests/harness/testids.ts"
import { BOX_NAME } from "@olai/tests/harness/hooks.ts"
import { selector } from "@olai/web/testlib"
import { attr, POLL_TIMEOUT, PREFS_ROW, type OlaiWorld } from "@olai/tests/harness/world.ts"
import type { Locator } from "@olai/tests/harness/playwright.ts"
import { expandedRow, openServerSection, ROW_TOGGLE, serverSection, shownLine } from "./settings_panel_steps.ts"

const NEEDS_ATTENTION = "Needs attention"

const rowAt = (world: OlaiWorld, name: string): Locator =>
  world.pluginsPanel().locator(`${PREFS_ROW}${attr("data-pref", `plugin-${name}`)}`)

const groupAt = (world: OlaiWorld, section: string): Locator =>
  world.pluginsPanel().locator(`${selector(TESTID.pluginGroup)}${attr("data-section", section)}`)

const detailOf = (row: Locator): Locator => row.locator(".plugins-detail-wrap")

When("I expand the plugin {string}", async function (this: OlaiWorld, name: string) {
  const row = await expandedRow(this, name)
  assert.equal(await row.locator(ROW_TOGGLE).count(), 1, `the ${name} row has no chevron to press`)
  await detailOf(row).waitFor({ state: "visible", timeout: POLL_TIMEOUT })
})

When("I collapse the plugin {string}", async function (this: OlaiWorld, name: string) {
  await this.waitUntil(async () => {
    const toggle = (await shownLine(this, name)).locator(ROW_TOGGLE)
    if (await toggle.getAttribute("aria-expanded") === "false") return true
    await toggle.click({ timeout: 2000 }).catch(() => undefined)
    return await toggle.getAttribute("aria-expanded").catch(() => null) === "false"
  }, `the ${name} row to shut its detail`)
})

Then("the plugin {string} is expanded", async function (this: OlaiWorld, name: string) {
  const row = rowAt(this, name)
  await this.waitUntil(async () => await row.locator(ROW_TOGGLE).getAttribute("aria-expanded").catch(() => null) === "true"
    && await row.getAttribute("data-open") === "true"
    && await detailOf(row).getAttribute("hidden") === null,
  `the ${name} row to stay open`)
})

Then("the plugin {string} is collapsed", async function (this: OlaiWorld, name: string) {
  const row = rowAt(this, name)
  await this.waitUntil(async () => await row.locator(ROW_TOGGLE).getAttribute("aria-expanded").catch(() => null) === "false"
    && await row.getAttribute("data-open") === null
    && await detailOf(row).getAttribute("hidden") !== null,
  `the ${name} row to be shut`)
  const controls = await row.locator(ROW_TOGGLE).getAttribute("aria-controls")
  assert.equal(controls, await detailOf(row).getAttribute("id"))
})

Then("the plugin {string} has nothing to reveal", async function (this: OlaiWorld, name: string) {
  const row = await shownLine(this, name)
  await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  await this.waitUntil(async () => await row.locator(ROW_TOGGLE).count() === 0, `the ${name} row to draw no chevron button`)
  assert.equal(await row.locator(".plugins-line button.plugins-name").count(), 0)
  const chevron = row.locator(".plugins-line .plugins-name > svg.plugins-chevron")
  assert.equal(await chevron.count(), 1)
  assert.equal(await chevron.evaluate(el => getComputedStyle(el).visibility), "hidden")
  assert.notEqual(await detailOf(row).getAttribute("hidden"), null)
  assert.equal(await row.getAttribute("data-open"), null)
})

Then("the plugin {string} detail names its short name", async function (this: OlaiWorld, name: string) {
  const detail = detailOf(rowAt(this, name))
  await detail.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  const pairs = await detail.locator("dl.plugins-detail > dt").evaluateAll(terms => terms.map(term => [
    term.textContent?.trim() ?? "",
    term.nextElementSibling?.textContent?.trim() ?? "",
  ]))
  assert.deepEqual(pairs.find(([term]) => term === "Short name"), ["Short name", name], JSON.stringify(pairs))
})

Then("the plugin {string} detail says {string}", async function (this: OlaiWorld, name: string, said: string) {
  const detail = detailOf(rowAt(this, name))
  await this.waitUntil(async () => await detail.isVisible() && (await detail.innerText()).replaceAll("\n", " ").includes(said),
    `the ${name} detail to say ${JSON.stringify(said)}`)
})

Then("every plugins panel group starts collapsed except Needs attention", async function (this: OlaiWorld) {
  const groups = await this.pluginsPanel().locator(selector(TESTID.pluginGroup)).all()
  assert.ok(groups.length > 1)
  for (const group of groups) {
    const section = await group.getAttribute("data-section")
    const open = await group.locator("details").first().getAttribute("open") !== null
    if (section === NEEDS_ATTENTION) {
      assert.equal(await group.getAttribute("data-needs"), "true")
      assert.equal(open, true, "Needs attention is open")
      assert.equal(await group.getAttribute("data-collapsed"), null)
    } else {
      assert.equal(open, false, `${section} starts shut`)
      assert.equal(await group.getAttribute("data-collapsed"), "true")
    }
    assert.ok(((await group.locator("[data-group-count]").textContent()) ?? "").trim().length > 0, `${section} has no count`)
  }
})

Then("the plugins panel lists the group {string}", async function (this: OlaiWorld, section: string) {
  await groupAt(this, section).waitFor({ state: "visible", timeout: POLL_TIMEOUT })
})

Then("the plugins panel does not list the group {string}", async function (this: OlaiWorld, section: string) {
  await this.pluginsPanel().waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  await groupAt(this, section).waitFor({ state: "detached", timeout: POLL_TIMEOUT })
})

Then("the plugins panel lists the group {string} after the group {string}", async function (this: OlaiWorld, later: string, earlier: string) {
  const order = await this.pluginsPanel().locator(selector(TESTID.pluginGroup))
    .evaluateAll(groups => groups.map(group => group.getAttribute("data-section")))
  const [at, before] = [order.indexOf(later), order.indexOf(earlier)]
  assert.ok(at >= 0 && before >= 0 && before < at, `groups read ${JSON.stringify(order)}`)
})

Then("the confirm for {string} names the plugins it stops by their labels", async function (this: OlaiWorld, name: string) {
  const box = rowAt(this, name).locator(selector(TESTID.pluginConfirm))
  await box.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  const said = ((await box.locator("p").textContent()) ?? "").trim()
  const lead = "Turning it off also stops "
  assert.ok(said.startsWith(lead) && said.endsWith("."), said)
  const named = said.slice(lead.length, -1).split(", ")
  const rows = await this.pluginsPanel().locator("[data-plugin-line]").evaluateAll(lines => lines.map(line => ({
    name: (line.getAttribute("data-pref") ?? "").replace(/^plugin-/, ""),
    label: line.querySelector(".plugins-name-text")?.textContent?.trim() ?? "",
  })))
  const labels = new Set(rows.map(row => row.label))
  for (const one of named) {
    assert.ok(labels.has(one), `${JSON.stringify(one)} is not a label on the panel (${said})`)
    const same = rows.find(row => row.name === one)
    assert.ok(same === undefined || same.label === one, `${JSON.stringify(one)} is an id whose row reads ${JSON.stringify(same?.label)}`)
  }
  assert.equal(await box.locator(selector(TESTID.pluginConfirmKeep)).innerText(), "Keep on")
  assert.equal(await box.locator(selector(TESTID.pluginConfirmOff)).innerText(), "Turn off")
})

Then("the Server section is folded", async function (this: OlaiWorld) {
  const section = serverSection(this)
  await section.waitFor({ state: "attached", timeout: POLL_TIMEOUT })
  assert.equal(await section.getAttribute("open"), null, "the Server section starts open")
})

When("I open the Server section", async function (this: OlaiWorld) {
  await openServerSection(this)
})

Then("the Server section names its address, its machine and a set access token without its value", async function (this: OlaiWorld) {
  const port = new URL(this.baseUrl).port
  assert.equal(await serverReading(this, "Address"), `127.0.0.1:${port}`)
  assert.equal(await serverReading(this, "Machine name"), BOX_NAME)
  assert.equal(await serverReading(this, "Access token"), "Set")
})

const pickedValue = async (knob: Locator): Promise<string> => {
  const problem = knob.locator(selector(TESTID.pluginProblem))
  if (await problem.count()) {
    const text = await problem.first().innerText()
    const marker = " · using "
    if (text.includes(marker)) return text.slice(text.lastIndexOf(marker) + marker.length)
  }
  const input = knob.locator("input, select")
  if (await input.count()) return input.first().inputValue()
  const picked = knob.locator('[aria-pressed="true"]')
  if (await picked.count()) return (await picked.first().getAttribute("data-value")) ?? ""
  return (await knob.innerText()).trim()
}

Then("the Server section reads {string} as {string} from {string}", async function (this: OlaiWorld, key: string, value: string, author: string) {
  const section = await openServerSection(this)
  const knob = section.locator(`${attr("data-config", key)}${attr("data-set-by", author)}`)
  await this.waitUntil(async () => await knob.count() > 0 && await knob.first().isVisible() && await pickedValue(knob.first()) === value,
    `the Server setting ${key} to read ${JSON.stringify(value)} from ${author}`)
})

Then("the Server section closes the plugins panel", async function (this: OlaiWorld) {
  const section = serverSection(this)
  await section.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  assert.equal((await section.locator("summary .plugins-heading-label").innerText()).trim(), "Server")
  assert.equal(await this.pluginsPanel().locator(".plugins-body > section.plugins-group").last()
    .locator(selector(TESTID.thisServe)).count(), 1)
  assert.equal((await section.locator("summary .plugins-heading-count").textContent())?.trim(), BOX_NAME)
})

const serverReading = async (world: OlaiWorld, label: string): Promise<string> => {
  const section = await openServerSection(world)
  const pairs = await section.locator("dl > dt").evaluateAll(terms => terms.map(term => [
    term.textContent?.trim() ?? "",
    (term.nextElementSibling as HTMLElement | null)?.innerText.trim() ?? "",
  ] as const))
  const found = pairs.find(([term]) => term === label)
  assert.ok(found, `the Server section has no ${JSON.stringify(label)}: ${JSON.stringify(pairs)}`)
  return found[1]
}

Then("the Server section lists {string} as {string}", async function (this: OlaiWorld, label: string, value: string) {
  await this.waitUntil(async () => await serverReading(this, label) === value,
    `the Server section to list ${label} as ${JSON.stringify(value)}`)
})

Then("the Server section lists this serve's address", async function (this: OlaiWorld) {
  const port = new URL(this.baseUrl).port
  assert.equal(await serverReading(this, "Address"), `127.0.0.1:${port}`)
  assert.equal(await serverReading(this, "Machine name"), BOX_NAME)
})

Then("the Server section offers its log settings and never shows the token", async function (this: OlaiWorld) {
  const section = await openServerSection(this)
  const terms = await section.locator("dl > dt").allTextContents()
  for (const label of ["Log level", "Log format"]) assert.ok(terms.map(term => term.trim()).includes(label), JSON.stringify(terms))
  for (const key of ["log-level", "log-format"]) {
    await section.locator(`${selector(TESTID.pluginKnob)}${attr("data-config", key)}`).waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  }
  assert.ok(["Set", "Not set"].includes(await serverReading(this, "Access token")))
})

Given("the roster says this serve has no access token", async function (this: OlaiWorld) {
  await this.page.routeWebSocket(url => url.pathname === "/rpc/ws", client => {
    const server = client.connectToServer()
    client.onMessage(message => server.send(message))
    server.onMessage(message => {
      const replace = (value: unknown): void => {
        if (value === null || typeof value !== "object") return
        if (Array.isArray(value)) { value.forEach(replace); return }
        const object = value as Record<string, unknown>
        if ("hostname" in object && typeof object.bearer === "object" && object.bearer !== null) object.bearer = { set: false }
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
