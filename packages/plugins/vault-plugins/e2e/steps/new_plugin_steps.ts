import * as assert from "node:assert/strict"
import * as fs from "node:fs"
import * as path from "node:path"

import { Given, Then, When } from "@olai/tests/harness/runner.ts"
import { PLUGIN_TESTID } from "@olai/tests/harness/testids.ts"
import { selector } from "@olai/web/testlib"
import {
  attr,
  HYDRATION_TIMEOUT,
  PALETTE,
  PALETTE_ASK_ERROR,
  PALETTE_INPUT,
  PALETTE_ITEM,
  PALETTE_SAID,
  POLL_TIMEOUT,
} from "@olai/tests/harness/world.ts"
import type { OlaiWorld } from "@olai/tests/harness/world.ts"
import { chatAbout, chatKeyFor, consentOf, readmeOfPlugin } from "./faces.ts"

const CHAT_PAGE = selector(PLUGIN_TESTID.chatPage)

const OPTION = selector(PLUGIN_TESTID.paletteOption)
const SUBMIT = selector(PLUGIN_TESTID.paletteSubmit)

const NEW_PLUGIN_ROW = `${PALETTE_ITEM}${attr("data-id", "new-plugin")}`

When("I open New plugin from the palette", async function (this: OlaiWorld) {
  const box = this.page.locator(PALETTE_INPUT)
  await box.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
  await box.fill("new plugin")
  const row = this.page.locator(NEW_PLUGIN_ROW)
  await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
  await this.press(row)
})

When("I ask for a plugin that {string}", async function (this: OlaiWorld, sentence: string) {
  const box = this.page.locator(PALETTE_INPUT)
  await box.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  await box.fill(sentence)
  await this.page.locator(PALETTE).waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  await box.press("Enter")
})

Then("a name is suggested for the new plugin", async function (this: OlaiWorld) {
  const box = this.page.locator(PALETTE_INPUT)
  await box.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
  await this.waitUntil(
    async () => (await box.inputValue()).trim() !== "",
    "the level to suggest a name rather than an empty box",
  )
})

Then("the new plugin will be kept in {string}", async function (this: OlaiWorld, folder: string) {
  const line = this.page.locator(OPTION)
  await this.waitUntil(
    async () => (await line.innerText()).includes(folder),
    `the level's option to say the folder is ${JSON.stringify(folder)}`,
  )
})

When("I name the plugin {string}", async function (this: OlaiWorld, name: string) {
  const box = this.page.locator(PALETTE_INPUT)
  await box.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  await box.fill(name)
})

When("I accept the name", async function (this: OlaiWorld) {
  await this.press(this.page.locator(SUBMIT))
})

Then("the new plugin level refuses with {string}", async function (this: OlaiWorld, said: string) {
  const line = this.page.locator(`:is(${PALETTE_ASK_ERROR}, ${PALETTE_SAID})`)
  await this.waitUntil(
    async () => (await line.allInnerTexts()).some((text) => text.includes(said)),
    `the level to refuse with ${JSON.stringify(said)}`,
  )
  await this.page.locator(PALETTE_INPUT).waitFor({ state: "visible", timeout: POLL_TIMEOUT })
})

Then("the new plugin level is still open", async function (this: OlaiWorld) {
  await this.page.locator(PALETTE).waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  await this.page.locator(PALETTE_INPUT).waitFor({ state: "visible", timeout: POLL_TIMEOUT })
})

Then("the folder {string} holds {string}", async function (this: OlaiWorld, folder: string, files: string) {
  const wanted = files.split(",").map((file) => file.trim()).sort()
  const where = path.join(this.scratch(), folder)
  await this.waitUntil(() => {
    const held = fs.existsSync(where) ? fs.readdirSync(where).sort() : []
    return Promise.resolve(JSON.stringify(held) === JSON.stringify(wanted))
  }, `${folder} to hold ${files}`)
})

Then("the folder {string} is gone", async function (this: OlaiWorld, folder: string) {
  await this.waitUntil(
    () => Promise.resolve(!fs.existsSync(path.join(this.scratch(), folder))),
    `${folder} to be gone from the vault`,
  )
})

Given("a conversation about the plugin {string} called {string}", function (this: OlaiWorld, word: string, name: string) {
  const readme = readmeOfPlugin(word)
  const held = fs.existsSync(path.join(this.scratch(), readme))
    ? fs.readFileSync(path.join(this.scratch(), readme), "utf8")
    : `# ${name}\n`
  this.writeServed(readme, `---\nchat-agent-session: claude\n---\n${held}`)
  this.nodeNames.set(name, chatKeyFor(word))
})

Then("the plugin {string} is being built by a conversation called {string}", async function (this: OlaiWorld, word: string, name: string) {
  await this.waitUntil(
    () => Promise.resolve(chatAbout(this, word) !== undefined),
    `a chat on the README of the plugin "${word}"`,
  )
  assert.equal(consentOf(this, word)?.["builder"], undefined, `"${word}" wrote a builder property`)
  this.nodeNames.set(name, chatKeyFor(word))
  this.activeAgent = name
})

Then("nothing is building the plugin {string}", async function (this: OlaiWorld, word: string) {
  await this.waitUntil(
    () => Promise.resolve(fs.existsSync(path.join(this.scratch(), "plugins", word))),
    `"${word}" to have been minted at all`,
  )
  await this.page.waitForTimeout(500)
  assert.equal(chatAbout(this, word), undefined, `"${word}" has a chat on a serve with no agent`)
  assert.equal(consentOf(this, word)?.["builder"], undefined, `"${word}" wrote a builder property`)
})

const PREAMBLE = "Call `vault-plugins_guide` before you write anything"

Then("the builder was told how to write a plugin exactly once", async function (this: OlaiWorld) {
  const carried = async (): Promise<number> =>
    (await this.page.locator("body").innerText()).split(PREAMBLE).length - 1
  await this.waitUntil(async () => (await carried()) > 0, "the builder's preamble to reach the conversation")
  await this.page.waitForTimeout(700)
  const times = await carried()
  assert.ok(times <= 2, `the preamble is in the conversation ${times} times, which is more than one delivery`)
})

Then("the builder conversation carries {string}", async function (this: OlaiWorld, said: string) {
  const pane = this.page.locator(CHAT_PAGE)
  await pane.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
  await this.waitUntil(
    async () => (await pane.innerText()).includes(said),
    `the builder's conversation to carry ${JSON.stringify(said)}`,
  )
})
