import * as assert from "node:assert/strict"

import { Then, When } from "@olai/tests/harness/runner.ts"
import { HYDRATION_TIMEOUT, POLL_TIMEOUT } from "@olai/tests/harness/world.ts"
import type { OlaiWorld } from "@olai/tests/harness/world.ts"

import { PAGE, PANEL_NEW, SECTION, SECTION_EMPTY, SECTION_MARK, SECTION_NEW, SECTION_ROW, sectionRowFor } from "./faces.ts"

Then("the sidebar has a Plugins section", async function (this: OlaiWorld) {
  await this.showSidebar()
  await this.page.locator(SECTION).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
})

Then("the sidebar has no Plugins section", async function (this: OlaiWorld) {
  await this.showSidebar()
  await this.waitUntil(
    async () => (await this.page.locator(SECTION).count()) === 0,
    "the Plugins section to leave the sidebar",
  )
})

Then("no plugin page is drawn", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator(PAGE).count()) === 0,
    "the plugin page to be absent",
  )
})

Then("the Plugins section lists {string}", async function (this: OlaiWorld, words: string) {
  await this.showSidebar()
  const wanted = words.trim() === "" ? [] : words.split(",").map((word) => word.trim())
  const rows = this.page.locator(`${SECTION} ${SECTION_ROW}`)
  await this.waitUntil(async () => {
    const drawn = await rows.evaluateAll((all) => all.map((one) => one.getAttribute("data-plugin")))
    return JSON.stringify(drawn) === JSON.stringify(wanted)
  }, `the Plugins section to list ${words}`)
})

Then("the Plugins row {string} says {string}", async function (this: OlaiWorld, word: string, said: string) {
  const row = sectionRowFor(this, word)
  await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  await this.waitUntil(async () => {
    const text = await row.innerText()
    const described = (await row.getAttribute("aria-description")) ?? ""
    const label = (await row.getAttribute("aria-label")) ?? ""
    return text.includes(said) || described.includes(said) || label.includes(said)
  }, `the ${word} row to say ${JSON.stringify(said)}`)
})

Then("the Plugins row {string} is marked {string}", async function (this: OlaiWorld, word: string, mark: string) {
  const row = sectionRowFor(this, word)
  await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
  await this.waitUntil(
    async () => (await row.locator(SECTION_MARK).first().getAttribute("data-mark").catch(() => null)) === mark,
    `the ${word} row to be marked "${mark}"`,
  )
})

Then("the Plugins row {string} wears no mark", async function (this: OlaiWorld, word: string) {
  const row = sectionRowFor(this, word)
  await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
  await this.waitUntil(
    async () => (await row.locator(SECTION_MARK).count()) === 0,
    `the ${word} row to wear no mark`,
  )
})

Then("the Plugins row {string} is {string}", async function (this: OlaiWorld, word: string, stage: string) {
  const row = sectionRowFor(this, word)
  await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
  await this.waitUntil(
    async () => (await row.getAttribute("data-stage")) === stage,
    `the ${word} row to read data-stage="${stage}"`,
  )
})

Then("the Plugins row {string} is switched {word}", async function (this: OlaiWorld, word: string, on: string) {
  await this.waitUntil(
    async () => (await sectionRowFor(this, word).getAttribute("data-on")) === (on === "on" ? "yes" : "no"),
    `the ${word} row's switch to read ${on}`,
  )
})

Then("the Plugins section does not list {string}", async function (this: OlaiWorld, word: string) {
  await this.showSidebar()
  await this.waitUntil(
    async () => (await sectionRowFor(this, word).count()) === 0,
    `the ${word} row to leave the Plugins section`,
  )
})

Then("the Plugins section offers a new plugin", async function (this: OlaiWorld) {
  await this.showSidebar()
  await this.page.locator(`${SECTION} ${SECTION_NEW}`).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
})

When("I press the Plugins section's plus", async function (this: OlaiWorld) {
  await this.showSidebar()
  await this.press(this.page.locator(`${SECTION} ${SECTION_NEW}`))
})

Then("the Plugins section invites a first plugin saying {string}", async function (this: OlaiWorld, said: string) {
  await this.showSidebar()
  const row = this.page.locator(`${SECTION} ${SECTION_EMPTY}`)
  await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
  assert.equal((await row.innerText()).trim(), said)
  assert.equal(await row.evaluate((one) => one.tagName.toLowerCase()), "button")
})

Then("the Plugins section invites no first plugin", async function (this: OlaiWorld) {
  await this.showSidebar()
  await this.waitUntil(
    async () => (await this.page.locator(`${SECTION} ${SECTION_EMPTY}`).count()) === 0,
    "the first-plugin row to leave the Plugins section",
  )
})

When("I press the Plugins section's first plugin row", async function (this: OlaiWorld) {
  await this.showSidebar()
  await this.press(this.page.locator(`${SECTION} ${SECTION_EMPTY}`))
})

Then("the plugins panel offers a new plugin", async function (this: OlaiWorld) {
  await this.pluginsPanel().locator(PANEL_NEW).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
})

Then("the plugins panel offers no new plugin", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.pluginsPanel().locator(PANEL_NEW).count()) === 0,
    "the plugins panel to offer no new plugin",
  )
  await this.page.waitForTimeout(POLL_TIMEOUT / 15)
  assert.equal(await this.pluginsPanel().locator(PANEL_NEW).count(), 0)
})

When("I press the plugins panel's new plugin door", async function (this: OlaiWorld) {
  await this.press(this.pluginsPanel().locator(PANEL_NEW))
})

Then("the Plugins row {string} is a link to its page", async function (this: OlaiWorld, word: string) {
  const row = sectionRowFor(this, word)
  await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  assert.equal(
    await row.evaluate((element) => element.closest("a")?.getAttribute("href") ?? null),
    `/plugins/${word}`,
    `the ${word} row is not an anchor at its own page`,
  )
})

Then("the Plugins row {string} is not a link", async function (this: OlaiWorld, word: string) {
  const row = sectionRowFor(this, word)
  await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  assert.equal(
    await row.evaluate((element) => element.closest("a")?.getAttribute("href") ?? null),
    null,
    `the ${word} row links somewhere, and no address names it`,
  )
})

Then("the Plugins row {string} is current", async function (this: OlaiWorld, word: string) {
  await this.waitUntil(
    async () =>
      (await sectionRowFor(this, word).evaluate((element) =>
        element.closest("a")?.getAttribute("aria-current") ?? element.getAttribute("aria-current")
      )) === "page",
    `the ${word} row to be the current one`,
  )
})

Then("the Plugins row {string} is not current", async function (this: OlaiWorld, word: string) {
  const marked = await sectionRowFor(this, word).evaluate((element) =>
    element.closest("a")?.getAttribute("aria-current") ?? element.getAttribute("aria-current")
  )
  assert.notEqual(marked, "page", `the ${word} row is marked current beside the page that is actually open`)
})

Then("the Plugins section is headed {string}", async function (this: OlaiWorld, heading: string) {
  await this.showSidebar()
  await this.page.locator(SECTION).getByRole("heading", { name: heading, exact: true })
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
})
