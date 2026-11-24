/**
 * THE HEADER'S SEARCH DOOR: a button that opens the ⌘K palette. On a desktop
 * it says `Search` and the palette's chord; on a phone it is the magnifier.
 * What a search finds is asked of the palette it opens (`palette_steps.ts`).
 */
import * as assert from "node:assert"
import { Then, When } from "@olai/tests/harness/runner.ts"
import {
  APP_CHROME,
  APP_HEADER,
  HEADER_SEARCH_OPEN,
  HYDRATION_TIMEOUT,
  PALETTE_INPUT,
  POLL_TIMEOUT,
} from "@olai/tests/harness/world.ts"
import type { OlaiWorld } from "@olai/tests/harness/world.ts"

/** The door, waited for — the one spelling of how long a scenario gives the
 *  bar to draw it. */
const door = async (world: OlaiWorld) => {
  const button = world.page.locator(HEADER_SEARCH_OPEN)
  await button.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
  return button
}

When("I click the header's search button", async function (this: OlaiWorld) {
  await this.press(await door(this))
})

/** A keyboard press on the door, with the caret put on it first. */
When("I press {string} on the header's search button", async function (this: OlaiWorld, key: string) {
  const button = await door(this)
  await button.focus()
  await this.page.keyboard.press(key)
  await this.waitForFrame()
})

/** Search through the door a person sees: click it, then type into the
 *  palette it opens. */
When("I search from the header for {string}", async function (this: OlaiWorld, text: string) {
  await this.press(await door(this))
  const input = this.page.locator(PALETTE_INPUT)
  await input.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  await input.fill(text)
})

/** What the door says: the word, and the chord the palette answers on this
 *  platform — `⌘K` on Apple, `Ctrl K` elsewhere — said to assistive
 *  technology as `aria-keyshortcuts` too. Its accessible name stays `Search`. */
Then("the header's search button shows the palette's chord", async function (this: OlaiWorld) {
  const button = await door(this)
  const shortcut = await button.getAttribute("aria-keyshortcuts")
  const chord = shortcut === "Meta+K" ? "⌘K" : shortcut === "Control+K" ? "Ctrl K" : undefined
  assert.ok(chord !== undefined, `the door names no palette chord: ${JSON.stringify(shortcut)}`)
  const words = (await button.innerText()).replace(/\s+/g, "")
  assert.equal(words, `Search${chord.replace(/\s+/g, "")}`, "the words drawn on the door")
  assert.equal(await button.getAttribute("aria-label"), "Search", "the door's accessible name")
})

/** NO TEXT BOX IN THE BAR: search is typed into the palette, so the header
 *  holds no field to type into at all. */
Then("the header holds no text box", async function (this: OlaiWorld) {
  const header = this.page.locator(APP_HEADER)
  await header.locator(APP_CHROME).waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  assert.equal(
    await header.locator("input, textarea, [contenteditable='true']").count(),
    0,
    "a text box stands in the header",
  )
})

/**
 * ...AND THE SEAT EMPTY, which is what a serve that did not name the `search`
 * row draws. The door is a ROW's face, hung in the bar's `lead` seat, so with
 * the row absent nothing in the bar is hiding it: there is no door. It waits
 * for the chrome first, so an empty seat is an answer rather than a page that
 * has not drawn its bar yet.
 */
Then("the header has no search button", async function (this: OlaiWorld) {
  await this.waitForFrame()
  const header = this.page.locator(APP_HEADER)
  await header.locator(APP_CHROME).waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  // The server acknowledges the switch before browser composition completes.
  await header.locator(HEADER_SEARCH_OPEN).waitFor({ state: "detached", timeout: POLL_TIMEOUT })
})
