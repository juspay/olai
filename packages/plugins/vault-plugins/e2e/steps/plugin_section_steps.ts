/**
 * THE SIDEBAR'S PLUGINS SECTION — beside Chats and Outlines, and only where a
 * vault has plugins of its own.
 *
 * ## Absence is the first claim, not an edge case
 *
 * Most vaults define no plugins and never will. A section standing there empty
 * would be the app advertising a feature at somebody who did not ask for one,
 * in the one piece of furniture that is on screen all day. So the section is
 * drawn by the roster having a plugin the VAULT defines in it, and the steps
 * below assert its absence as carefully as its contents — with no plugin, with
 * the last one deleted, with the sidebar row switched off, and with this row
 * switched off.
 *
 * ## The mark is the three states somebody has to DO something about
 *
 * A working dot while an agent is still writing the folder, `Review` while a
 * version is waiting to be read, `Problem` when it would not start — and
 * NOTHING at all when a plugin is simply on or simply off, which is the design
 * rather than an omission: a row that always wears a badge is a row whose badge
 * nobody reads. So "no mark" is asserted as the absence of the node, and the
 * off state is read off the row's own `data-stage` instead.
 */

import * as assert from "node:assert/strict"

import { Then, When } from "@olai/tests/harness/runner.ts"
import { HYDRATION_TIMEOUT, POLL_TIMEOUT } from "@olai/tests/harness/world.ts"
import type { OlaiWorld } from "@olai/tests/harness/world.ts"

import { SECTION, SECTION_MARK, SECTION_NEW, SECTION_ROW, sectionRowFor } from "./faces.ts"

Then("the sidebar has a Plugins section", async function (this: OlaiWorld) {
  await this.showSidebar()
  await this.page.locator(SECTION).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
})

/**
 * ...AND IT IS NOT THERE AT ALL — detached, rather than empty or hidden.
 *
 * Waited for, because every use of this step but the first is asked across a
 * transition: the last folder was deleted, or a row went off, and the roster
 * has to reach this tab before the furniture can follow it.
 */
Then("the sidebar has no Plugins section", async function (this: OlaiWorld) {
  await this.showSidebar()
  await this.waitUntil(
    async () => (await this.page.locator(SECTION).count()) === 0,
    "the Plugins section to leave the sidebar",
  )
})

/** Every row of it, in the order the roster lists them — which is folder
 *  order, so the sidebar agrees with the page, the panel and `ls`. */
Then("the Plugins section lists {string}", async function (this: OlaiWorld, words: string) {
  await this.showSidebar()
  const wanted = words.trim() === "" ? [] : words.split(",").map((word) => word.trim())
  const rows = this.page.locator(`${SECTION} ${SECTION_ROW}`)
  await this.waitUntil(async () => {
    const drawn = await rows.evaluateAll((all) => all.map((one) => one.getAttribute("data-plugin")))
    return JSON.stringify(drawn) === JSON.stringify(wanted)
  }, `the Plugins section to list ${words}`)
})

/** The README's own first sentence, as the row's tip — the one place in the
 *  sidebar where a person finds out what a word they chose months ago does. */
Then("the Plugins row {string} says {string}", async function (this: OlaiWorld, word: string, said: string) {
  const row = sectionRowFor(this, word)
  await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  await this.waitUntil(async () => {
    const text = await row.innerText()
    const title = (await row.getAttribute("title")) ?? ""
    const label = (await row.getAttribute("aria-label")) ?? ""
    return text.includes(said) || title.includes(said) || label.includes(said)
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

/** Nothing to do about this one — which is a row that is simply on, or simply
 *  off, and says it with its ink. */
Then("the Plugins row {string} wears no mark", async function (this: OlaiWorld, word: string) {
  const row = sectionRowFor(this, word)
  await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
  await this.waitUntil(
    async () => (await row.locator(SECTION_MARK).count()) === 0,
    `the ${word} row to wear no mark`,
  )
})

/** The row's own state, which is what dims a plugin somebody has switched off
 *  without putting a word beside it. */
Then("the Plugins row {string} is {string}", async function (this: OlaiWorld, word: string, stage: string) {
  const row = sectionRowFor(this, word)
  await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
  await this.waitUntil(
    async () => (await row.getAttribute("data-stage")) === stage,
    `the ${word} row to read data-stage="${stage}"`,
  )
})

/** Whether the person's own switch is up, drawn beside the state because the
 *  two are different facts: a plugin can be approved and switched off, and an
 *  approved plugin whose code moved is paused with the switch still up. */
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

/** The section's own `+`, which is ⌘K → New plugin by another door — and is
 *  drawn only where the palette is there to open. */
Then("the Plugins section offers a new plugin", async function (this: OlaiWorld) {
  await this.showSidebar()
  await this.page.locator(`${SECTION} ${SECTION_NEW}`).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
})

When("I press the Plugins section's plus", async function (this: OlaiWorld) {
  await this.showSidebar()
  await this.press(this.page.locator(`${SECTION} ${SECTION_NEW}`))
})

/** A row is an ANCHOR, which is what makes the page linkable and the sidebar
 *  navigable with the keyboard — rather than a div that calls a router. */
Then("the Plugins row {string} is a link to its page", async function (this: OlaiWorld, word: string) {
  const row = sectionRowFor(this, word)
  await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  assert.equal(
    await row.evaluate((element) => element.closest("a")?.getAttribute("href") ?? null),
    `/plugins/${word}`,
    `the ${word} row is not an anchor at its own page`,
  )
})

/** The row that is open, which a sidebar says with `aria-current` rather than
 *  with ink alone. */
Then("the Plugins row {string} is current", async function (this: OlaiWorld, word: string) {
  await this.waitUntil(
    async () =>
      (await sectionRowFor(this, word).evaluate((element) =>
        element.closest("a")?.getAttribute("aria-current") ?? element.getAttribute("aria-current")
      )) === "page",
    `the ${word} row to be the current one`,
  )
})

/** ...and exactly one row is, which is the half a careless `aria-current` on
 *  every row of a list would pass without. */
Then("the Plugins row {string} is not current", async function (this: OlaiWorld, word: string) {
  const marked = await sectionRowFor(this, word).evaluate((element) =>
    element.closest("a")?.getAttribute("aria-current") ?? element.getAttribute("aria-current")
  )
  assert.notEqual(marked, "page", `the ${word} row is marked current beside the page that is actually open`)
})

/** The section carries its own heading, so a reader meets the word *Plugins*
 *  rather than a list of words they chose. */
Then("the Plugins section is headed {string}", async function (this: OlaiWorld, heading: string) {
  await this.showSidebar()
  await this.page.locator(SECTION).getByRole("heading", { name: heading, exact: true })
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
})
