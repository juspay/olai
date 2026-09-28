/**
 * THE PANEL AT REST AND ONE PRESS DEEPER — groups shut with their counts, each
 * plugin one line, a row's detail behind its chevron, the Server section at
 * the foot, and the inline confirm a switch owes before it stops other rows.
 *
 * Reads of whether a row is open go to the row itself, and a row is only ever
 * put on screen through `shownLine`, which opens its group and nothing more:
 * the claim is about what the panel kept open across a republish, and a read
 * that pressed the chevron would be making the answer it was asked for.
 */
import * as assert from "node:assert/strict"
import { Given, Then, When } from "@olai/tests/harness/runner.ts"
import { TESTID } from "@olai/tests/harness/testids.ts"
import { BOX_NAME } from "@olai/tests/harness/hooks.ts"
import { selector } from "@olai/web/testlib"
import { attr, POLL_TIMEOUT, PREFS_ROW, type OlaiWorld } from "@olai/tests/harness/world.ts"
import type { Locator } from "@olai/tests/harness/playwright.ts"
import { expandedRow, openServerSection, ROW_TOGGLE, serverSection, shownLine } from "./settings_panel_steps.ts"

const NEEDS_ATTENTION = "Needs attention"

/** One row, found where it is drawn — no group opened, nothing pressed. */
const rowAt = (world: OlaiWorld, name: string): Locator =>
  world.pluginsPanel().locator(`${PREFS_ROW}${attr("data-pref", `plugin-${name}`)}`)

const groupAt = (world: OlaiWorld, section: string): Locator =>
  world.pluginsPanel().locator(`${selector(TESTID.pluginGroup)}${attr("data-section", section)}`)

/** The row's detail — present on every row, `hidden` while it is shut. */
const detailOf = (row: Locator): Locator => row.locator(".plugins-detail-wrap")

When("I expand the plugin {string}", async function (this: OlaiWorld, name: string) {
  const row = await expandedRow(this, name)
  // Only a row with something to reveal can be expanded; asking to open one
  // that has nothing is a scenario that meant another row.
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
  // The toggle says which detail it shows or hides.
  const controls = await row.locator(ROW_TOGGLE).getAttribute("aria-controls")
  assert.equal(controls, await detailOf(row).getAttribute("id"))
})

/**
 * A ROW WITH NOTHING BEHIND IT HAS NO DOOR: its name is plain text, the
 * chevron is kept only as an invisible spacer so the names line up, and there
 * is no detail to open.
 */
Then("the plugin {string} has nothing to reveal", async function (this: OlaiWorld, name: string) {
  const row = await shownLine(this, name)
  await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  // Waited for: a browser-only row says it has not started in this tab until
  // the tab reports it running, and that sentence is something to reveal.
  await this.waitUntil(async () => await row.locator(ROW_TOGGLE).count() === 0, `the ${name} row to draw no chevron button`)
  assert.equal(await row.locator(".plugins-line button.plugins-name").count(), 0)
  const chevron = row.locator(".plugins-line .plugins-name > svg.plugins-chevron")
  assert.equal(await chevron.count(), 1)
  assert.equal(await chevron.evaluate(el => getComputedStyle(el).visibility), "hidden")
  assert.notEqual(await detailOf(row).getAttribute("hidden"), null)
  assert.equal(await row.getAttribute("data-open"), null)
})

/** The settings namespace a person types, under its own label in the detail —
 *  drawn where the row's label is not already that name. */
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

/** At rest the panel is its headings: every group shut except the one that
 *  holds rows needing a person, which opens with its rows' details showing. */
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
    // A shut heading still shows how many of its rows are on.
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

/**
 * THE CONFIRM NAMES THE ROWS IT STOPS BY THE LABELS ON THEIR LINES — the name
 * a person reads, never a settings id that differs from it.
 */
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
  // Both verbs sit beside the sentence, on the row itself.
  assert.equal(await box.locator(selector(TESTID.pluginConfirmKeep)).innerText(), "Keep on")
  assert.equal(await box.locator(selector(TESTID.pluginConfirmOff)).innerText(), "Turn off")
})

// ── the Server section ──
//
// Shut at rest like every group above it; the process is a press away.

Then("the Server section is folded", async function (this: OlaiWorld) {
  const section = serverSection(this)
  await section.waitFor({ state: "attached", timeout: POLL_TIMEOUT })
  assert.equal(await section.getAttribute("open"), null, "the Server section starts open")
})

When("I open the Server section", async function (this: OlaiWorld) {
  await openServerSection(this)
})

/** Where it listens, which machine it names itself after, and THAT an access
 *  token is set — never the token. */
Then("the Server section names its address, its machine and a set access token without its value", async function (this: OlaiWorld) {
  const port = new URL(this.baseUrl).port
  assert.equal(await serverReading(this, "Address"), `127.0.0.1:${port}`)
  assert.equal(await serverReading(this, "Machine name"), BOX_NAME)
  assert.equal(await serverReading(this, "Access token"), "Set")
})

/** The value a knob has picked — the selected segment, the input or select —
 *  or, over a refused file spelling, the default named in its problem line. */
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

/** One of the serve's own knobs, by key: what it reads and who set it. */
Then("the Server section reads {string} as {string} from {string}", async function (this: OlaiWorld, key: string, value: string, author: string) {
  const section = await openServerSection(this)
  const knob = section.locator(`${attr("data-config", key)}${attr("data-set-by", author)}`)
  await this.waitUntil(async () => await knob.count() > 0 && await knob.first().isVisible() && await pickedValue(knob.first()) === value,
    `the Server setting ${key} to read ${JSON.stringify(value)} from ${author}`)
})

/** The section closes the list, under its own heading, after every group. */
Then("the Server section closes the plugins panel", async function (this: OlaiWorld) {
  const section = serverSection(this)
  await section.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  assert.equal((await section.locator("summary .plugins-heading-label").innerText()).trim(), "Server")
  assert.equal(await this.pluginsPanel().locator(".plugins-body > section.plugins-group").last()
    .locator(selector(TESTID.thisServe)).count(), 1)
  // ...and its heading carries the machine's name while it is shut.
  assert.equal((await section.locator("summary .plugins-heading-count").textContent())?.trim(), BOX_NAME)
})

/** One label/value pair of the Server section, by its label. */
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

/** A plain reading of the section — Address, Machine name, Access token,
 *  State folder — by the label a person reads beside it. */
Then("the Server section lists {string} as {string}", async function (this: OlaiWorld, label: string, value: string) {
  await this.waitUntil(async () => await serverReading(this, label) === value,
    `the Server section to list ${label} as ${JSON.stringify(value)}`)
})

Then("the Server section lists this serve's address", async function (this: OlaiWorld) {
  const port = new URL(this.baseUrl).port
  assert.equal(await serverReading(this, "Address"), `127.0.0.1:${port}`)
  assert.equal(await serverReading(this, "Machine name"), BOX_NAME)
})

/** The log policy is a pair of ordinary knobs in the section, labelled in
 *  words; the access token is only ever Set or Not set. */
Then("the Server section offers its log settings and never shows the token", async function (this: OlaiWorld) {
  const section = await openServerSection(this)
  const terms = await section.locator("dl > dt").allTextContents()
  for (const label of ["Log level", "Log format"]) assert.ok(terms.map(term => term.trim()).includes(label), JSON.stringify(terms))
  for (const key of ["log-level", "log-format"]) {
    await section.locator(`${selector(TESTID.pluginKnob)}${attr("data-config", key)}`).waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  }
  assert.ok(["Set", "Not set"].includes(await serverReading(this, "Access token")))
})

/** Rewrite the serve's own reading on the way to this tab so it says no
 *  access token is set. Only that one field moves; the real server answers
 *  everything else. */
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
