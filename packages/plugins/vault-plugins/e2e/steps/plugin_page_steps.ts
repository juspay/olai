import * as assert from "node:assert/strict"

import { Then, When } from "@olai/tests/harness/runner.ts"
import { PLUGIN_TESTID } from "@olai/tests/harness/testids.ts"
import { selector } from "@olai/web/testlib"
import { attr, HYDRATION_TIMEOUT, POLL_TIMEOUT } from "@olai/tests/harness/world.ts"
import type { OlaiWorld } from "@olai/tests/harness/world.ts"
import type { Locator } from "@olai/tests/harness/playwright.ts"

import {
  addressOfPlugin,
  readmeOfPlugin,
  chatKeyFor,
  CHAT_PAGE,
  consentOf,
  openedMore,
  PAGE,
  PAGE_ASK,
  PAGE_ASK_CHANGE,
  PAGE_BANNER,
  PAGE_CODE,
  PAGE_CODE_TAB,
  PAGE_DIFF,
  PAGE_FOLDER,
  PAGE_FOOT,
  PAGE_KNOB,
  PAGE_MISSING,
  PAGE_MOVED,
  PAGE_MOVED_READ,
  PAGE_README,
  PAGE_STATE,
  PAGE_ASK_SAID,
  PAGE_DELETE,
  PAGE_DELETE_CONFIRM,
  PAGE_READ_ANYWAY,
  PAGE_TRUST_ALWAYS,
  PAGE_TRUST_SAID,
  PAGE_TRUST_STOP,
  PAGE_USES,
  PAGE_VERB,
  pageFor,
  SETTINGS_FILE,
  shownPage,
  verbOf,
} from "./faces.ts"

const open = (world: OlaiWorld) => world.page.locator(`${PAGE}:visible`).first()

const knob = (world: OlaiWorld, key: string) =>
  world.page.locator(`${PAGE} ${PAGE_KNOB}${attr("data-key", key)}`)

When("I open the plugin page for {string}", async function (this: OlaiWorld, word: string) {
  await this.open(addressOfPlugin(word))
})

When("I go to the plugin {string}", async function (this: OlaiWorld, word: string) {
  await shownPage(this, word)
})

Then("the plugin page is about {string}", async function (this: OlaiWorld, word: string) {
  await pageFor(this, word).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
})

Then("there is no plugin called {string}", async function (this: OlaiWorld, word: string) {
  await this.page.locator(PAGE_MISSING).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
  assert.equal(await pageFor(this, word).count(), 0, `a page was drawn for "${word}", which this vault has no folder for`)
})

Then("the plugin page is {string}", async function (this: OlaiWorld, stage: string) {
  const page = open(this)
  await page.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
  await this.waitUntil(
    async () => (await page.getAttribute("data-stage")) === stage,
    `the plugin page to read data-stage="${stage}"`,
  )
})

Then("the plugin page's status says {string}", async function (this: OlaiWorld, said: string) {
  const line = this.page.locator(`${PAGE} ${PAGE_STATE}`).first()
  await this.waitUntil(
    async () => ((await line.innerText()).includes(said)),
    `the status line to say ${JSON.stringify(said)}`,
  )
})

Then("the plugin page says {string}", async function (this: OlaiWorld, said: string) {
  const page = open(this)
  await this.waitUntil(
    async () => (await page.innerText()).includes(said),
    `the page to say ${JSON.stringify(said)}`,
  )
})

Then("the plugin page does not say {string}", async function (this: OlaiWorld, said: string) {
  const page = open(this)
  await page.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  await this.page.waitForTimeout(500)
  assert.ok(!(await page.innerText()).includes(said), `the page says ${JSON.stringify(said)}, and it may not`)
})

Then("the plugin page says what running it costs", async function (this: OlaiWorld) {
  const said = this.page.locator(`${PAGE} ${PAGE_TRUST_SAID}:visible`).first()
  await said.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  const words = await said.innerText()
  assert.ok(
    words.includes("There is no sandbox") && words.includes("everything olai can reach"),
    `the trust line reads ${JSON.stringify(words)}`,
  )
})

When("I approve the plugin {string}", async function (this: OlaiWorld, word: string) {
  const was = this.place()
  await shownPage(this, word)
  const read = this.page.locator(PAGE_MOVED_READ).first()
  await this.waitUntil(
    async () => await read.isVisible().catch(() => false) || await verbOf(this).isVisible().catch(() => false),
    `"${word}"'s page to offer a verb or ask to be read again`,
  )
  if (await read.isVisible().catch(() => false)) await this.press(read)
  const verb = verbOf(this)
  await verb.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
  const which = await verb.getAttribute("data-verb")
  assert.ok(
    which === "turn-on" || which === "turn-on-version",
    `"${word}" offers "${which}" rather than a verb that turns it on`,
  )
  const before = consentOf(this, word)
  const moved = (consent: Record<string, unknown> | undefined): boolean =>
    consent !== undefined && consent["approved"] !== undefined && consent["on"] === "yes"
      && (consent["approved"] !== before?.["approved"] || before?.["on"] !== "yes")
  const tap = async (what: Locator): Promise<void> => { await what.click({ timeout: 2_000 }).catch(() => {}) }
  await this.waitUntil(async () => {
    if (moved(consentOf(this, word))) return true
    if (await read.isVisible().catch(() => false)) {
      await tap(read)
      return false
    }
    const armed = verbOf(this)
    if (await armed.isEnabled().catch(() => false)) await tap(armed)
    return false
  }, `the approval of "${word}" to reach ${SETTINGS_FILE}`, HYDRATION_TIMEOUT)
  if (this.place() !== was) {
    await this.page.goBack()
    await this.waitUntil(() => Promise.resolve(this.place() === was), `to be back at ${was}`)
  }
})

When("I always trust changes to the plugin {string}", async function (this: OlaiWorld, word: string) {
  await shownPage(this, word)
  await openedMore(this)
  const row = this.page.locator(PAGE_TRUST_ALWAYS).first()
  await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  await this.press(row)
  await this.waitUntil(
    () => Promise.resolve(consentOf(this, word)?.["approved"] === "always"),
    `"${word}" to be trusted for every later version`,
  )
})

When("I switch the plugin {string} off on its page", async function (this: OlaiWorld, word: string) {
  await shownPage(this, word)
  const verb = verbOf(this)
  await verb.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  assert.equal(await verb.getAttribute("data-verb"), "switch", `"${word}" draws no switch, so it is not running`)
  await this.press(verb)
  await this.waitUntil(
    () => Promise.resolve(consentOf(this, word)?.["on"] === "no"),
    `the switch of "${word}" to reach ${SETTINGS_FILE}`,
  )
})

Then("the plugin page's verb is {string}", async function (this: OlaiWorld, which: string) {
  const read = this.page.locator(`${PAGE} ${PAGE_MOVED_READ}`).first()
  if (await read.isVisible().catch(() => false)) await this.press(read)
  const verb = verbOf(this)
  await verb.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
  await this.waitUntil(
    async () => (await verb.getAttribute("data-verb")) === which,
    `the page's verb to read data-verb="${which}"`,
  )
})

When("I press the plugin page verb", async function (this: OlaiWorld) {
  const verb = verbOf(this)
  await verb.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  await this.press(verb)
})

Then("the plugin page has disarmed its verbs", async function (this: OlaiWorld) {
  await this.page.locator(`${PAGE} ${PAGE_MOVED}`).first()
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  assert.equal(
    await this.page.locator(`${PAGE} ${PAGE_VERB}:visible`).count(),
    0,
    "the page still offers a verb over a version this reader has not been shown",
  )
})

When("I read the plugin {string} again", async function (this: OlaiWorld, word: string) {
  await shownPage(this, word)
  const read = this.page.locator(`${PAGE} ${PAGE_MOVED_READ}`).first()
  await read.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  await this.press(read)
})

Then("the plugin page's README says {string}", async function (this: OlaiWorld, said: string) {
  const readme = this.page.locator(`${PAGE} ${PAGE_README}`).first()
  await this.waitUntil(
    async () => (await readme.innerText()).includes(said),
    `the README on the page to say ${JSON.stringify(said)}`,
  )
})

Then("the plugin page's README does not say {string}", async function (this: OlaiWorld, said: string) {
  const readme = this.page.locator(`${PAGE} ${PAGE_README}`).first()
  await readme.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  await this.page.waitForTimeout(500)
  assert.ok(!(await readme.innerText()).includes(said),
    `the README on the page says ${JSON.stringify(said)}, and it may not`)
})

Then("the plugin page says it uses {string}", async function (this: OlaiWorld, said: string) {
  const uses = this.page.locator(`${PAGE} ${PAGE_USES}`)
  await this.waitUntil(
    async () => (await uses.allInnerTexts()).some((text) => text.includes(said)),
    `*What it uses* to name ${JSON.stringify(said)}`,
  )
})

Then("the plugin page's folder is {string}", async function (this: OlaiWorld, folder: string) {
  const line = this.page.locator(`${PAGE} ${PAGE_FOLDER}`).first()
  await this.waitUntil(
    async () => (await line.innerText()).includes(folder),
    `the page to name the folder ${JSON.stringify(folder)}`,
  )
})

Then("the plugin page's code tabs are {string}", async function (this: OlaiWorld, files: string) {
  const wanted = files.split(",").map((file) => file.trim())
  const tabs = this.page.locator(`${PAGE} ${PAGE_CODE_TAB}`)
  await this.waitUntil(async () => {
    const drawn = await tabs.evaluateAll((all) => all.map((one) => one.getAttribute("data-file")))
    return JSON.stringify(drawn) === JSON.stringify(wanted)
  }, `the code tabs to be ${files}`)
})

When("I open the plugin page's {string} tab", async function (this: OlaiWorld, file: string) {
  await this.press(this.page.locator(`${PAGE} ${PAGE_CODE_TAB}${attr("data-file", file)}`).first())
})

Then("the plugin page's code is {string}", async function (this: OlaiWorld, file: string) {
  const code = this.page.locator(`${PAGE} ${PAGE_CODE}`).first()
  await this.waitUntil(
    async () => (await code.getAttribute("data-file")) === file,
    `the drawn code block to be ${file}`,
  )
})

Then("the plugin page's code names {string}", async function (this: OlaiWorld, said: string) {
  const code = this.page.locator(`${PAGE} ${PAGE_CODE}`).first()
  await this.waitUntil(
    async () => (await code.innerText()).includes(said),
    `the drawn source to carry ${JSON.stringify(said)}`,
  )
})

const diffLine = (world: OlaiWorld, kind: string) =>
  world.page.locator(`${PAGE} ${PAGE_DIFF} ${attr("data-line", kind)}`)

Then("the plugin page's diff removes {string}", async function (this: OlaiWorld, said: string) {
  await this.waitUntil(
    async () => (await diffLine(this, "del").allInnerTexts()).some((text) => text.includes(said)),
    `a removed line carrying ${JSON.stringify(said)}`,
  )
})

Then("the plugin page's diff adds {string}", async function (this: OlaiWorld, said: string) {
  await this.waitUntil(
    async () => (await diffLine(this, "add").allInnerTexts()).some((text) => text.includes(said)),
    `an added line carrying ${JSON.stringify(said)}`,
  )
})

Then("the plugin page's diff keeps {string}", async function (this: OlaiWorld, said: string) {
  await this.waitUntil(
    async () => (await diffLine(this, "same").allInnerTexts()).some((text) => text.includes(said)),
    `an unchanged line carrying ${JSON.stringify(said)}`,
  )
})

Then("the plugin page draws no diff", async function (this: OlaiWorld) {
  await this.page.locator(`${PAGE} ${PAGE_DIFF}`).waitFor({ state: "detached", timeout: POLL_TIMEOUT })
})

Then("the plugin page's banner says {string}", async function (this: OlaiWorld, said: string) {
  const banner = this.page.locator(`${PAGE} ${PAGE_BANNER}`).first()
  await this.waitUntil(
    async () => (await banner.innerText()).includes(said),
    `the banner to say ${JSON.stringify(said)}`,
  )
})

Then("the plugin page draws no banner", async function (this: OlaiWorld) {
  await this.page.locator(`${PAGE} ${PAGE_BANNER}`).waitFor({ state: "detached", timeout: POLL_TIMEOUT })
})

Then("the plugin page offers to ask for a change", async function (this: OlaiWorld) {
  await openedMore(this)
  await this.page.locator(PAGE_ASK_CHANGE).first().waitFor({ state: "visible", timeout: POLL_TIMEOUT })
})

When("I ask for a change to the plugin {string}", async function (this: OlaiWorld, word: string) {
  await shownPage(this, word)
  await openedMore(this)
  const row = this.page.locator(PAGE_ASK_CHANGE).first()
  await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  await this.press(row)
})

Then("the plugin page offers nobody to ask", async function (this: OlaiWorld) {
  await this.page.locator(PAGE).first().waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
  assert.equal(await this.page.locator(PAGE_ASK_CHANGE).count(), 0, "a plugin with no agent offered an *Ask…* row")
  assert.equal(await this.page.locator(`${PAGE} ${PAGE_ASK}`).count(), 0, "a plugin with no agent drew the *Ask* spot")
  assert.equal(
    await this.page.locator(`${PAGE} ${PAGE_VERB}${attr("data-verb", "ask-fix")}`).count(),
    0,
    "a plugin with no chat offered *Ask Claude to fix it*",
  )
})

When("I ask the builder to fix it", async function (this: OlaiWorld) {
  const verb = verbOf(this)
  await verb.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  assert.equal(await verb.getAttribute("data-verb"), "ask-fix", "the page's verb is not *Ask Claude to fix it*")
  await this.press(verb)
})

When("I pick {string} for the plugin page setting {string}", async function (this: OlaiWorld, value: string, key: string) {
  const control = knob(this, key)
  await control.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  await this.press(control.locator(`button${attr("data-value", value)}`))
})

When("I type {string} into the plugin page setting {string}", async function (this: OlaiWorld, value: string, key: string) {
  await knob(this, key).locator("input").fill(value)
})

When("I press {string} in the plugin page setting {string}", async function (this: OlaiWorld, keypress: string, key: string) {
  await knob(this, key).locator("input").press(keypress)
})

Then("the plugin page setting {string} is refused", async function (this: OlaiWorld, key: string) {
  const control = knob(this, key)
  await control.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  await this.waitUntil(
    async () => (await control.locator(`${selector(PLUGIN_TESTID.pluginProblem)}, [role="alert"]`).count()) > 0,
    `the ${key} knob to say why it refused`,
  )
})

Then("the plugin page has no settings", async function (this: OlaiWorld) {
  await this.page.locator(`${PAGE} ${PAGE_KNOB}`).first()
    .waitFor({ state: "detached", timeout: POLL_TIMEOUT })
})

Then("the plugin page's verb is in the foot", async function (this: OlaiWorld) {
  const foot = this.page.locator(`${PAGE} ${PAGE_FOOT}`).first()
  await foot.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
  await foot.locator(PAGE_VERB).first().waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  await foot.locator(PAGE_TRUST_SAID).first().waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  const elsewhere = this.page.locator(`${PAGE} ${PAGE_VERB}:visible`)
  assert.equal(
    await elsewhere.count(),
    1,
    "the head's copy of the verb is drawn beside the foot's, so a handset offers the press twice",
  )
})

When("I mark the plugin page", async function (this: OlaiWorld) {
  await open(this).evaluate((element) => {
    (element as HTMLElement & { __olaiPageMark?: number }).__olaiPageMark = Date.now()
  })
})

Then("the plugin page is the one I marked", async function (this: OlaiWorld) {
  const marked = await open(this).evaluate((element) =>
    (element as HTMLElement & { __olaiPageMark?: number }).__olaiPageMark !== undefined
  )
  assert.ok(marked, "the plugin page was drawn again, so whatever was open on it is gone")
})


When("I stop trusting changes to the plugin {string}", async function (this: OlaiWorld, word: string) {
  await shownPage(this, word)
  await openedMore(this)
  const row = this.page.locator(PAGE_TRUST_STOP).first()
  await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  await this.press(row)
  await this.waitUntil(
    () => Promise.resolve(consentOf(this, word)?.["approved"] !== "always"),
    `"${word}" to stop being trusted for every later version`,
  )
})

Then("the plugin {string} offers to {string} trusting changes", async function (this: OlaiWorld, word: string, way: string) {
  await shownPage(this, word)
  await openedMore(this)
  const row = this.page.locator(way === "stop" ? PAGE_TRUST_STOP : PAGE_TRUST_ALWAYS).first()
  await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  await this.page.keyboard.press("Escape")
})

When("I delete the plugin {string} from its page", async function (this: OlaiWorld, word: string) {
  await shownPage(this, word)
  await openedMore(this)
  const row = this.page.locator(PAGE_DELETE).first()
  await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  await this.press(row)
  const confirm = this.page.locator(PAGE_DELETE_CONFIRM).first()
  await confirm.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  await this.press(confirm)
})

When("I read the unfinished plugin {string} anyway", async function (this: OlaiWorld, word: string) {
  await shownPage(this, word)
  const button = this.page.locator(`${PAGE} ${PAGE_READ_ANYWAY}`).first()
  await button.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  await this.press(button)
})

Then("the plugin page says {string} came of asking", async function (this: OlaiWorld, said: string) {
  const line = this.page.locator(`${PAGE} ${PAGE_ASK_SAID}`).first()
  await line.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  await this.waitUntil(
    async () => (await line.innerText()).includes(said),
    `the page to say ${JSON.stringify(said)} came of asking`,
  )
})

Then("the conversation building {string} is beside the page", async function (this: OlaiWorld, word: string) {
  const key = chatKeyFor(word)
  await this.page.locator(`${CHAT_PAGE}${attr("data-item", key)}`)
    .first().waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
  this.activeAgent = key
})

Then("the plugin {string} has written {string}", async function (this: OlaiWorld, word: string, file: string) {
  await shownPage(this, word)
  const row = this.page.locator(`${PAGE} ${attr("data-file", file)}`).first()
  await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  await this.waitUntil(
    async () => (await row.getAttribute("data-written")) === "yes",
    `"${word}" to have written ${file}`,
  )
})
