/**
 * A PLUGIN'S OWN PAGE — where a person reads what somebody wrote into their
 * vault and decides about it.
 *
 * ## Why the gestures moved here from the panel
 *
 * They used to be on the plugins panel, under a disclosure triangle in a list
 * of forty rows: the source, the approval, the warning about what running it
 * costs. A plugin a vault defines is not a row with a switch — it is a folder
 * with a README, three files, a conversation that built it and the most
 * consequential press in this product. So it has an address (`/plugins/<word>`),
 * and these steps grip that page.
 *
 * ## Three things these steps will not do, and each is a claim
 *
 * **They do not reload.** `shownPage` walks in through the sidebar's own row,
 * because half of what is asserted around here is that a face appeared with no
 * reload; a helper that called `page.goto` would erase the mark a scenario had
 * just put on the document. The cold open is a step of its own, for the one
 * claim that is about a permalink arriving in a fresh tab.
 *
 * **They do not read the state off prose.** Every state assertion is the
 * `data-stage` the page writes (`../../src/browser/state.ts`'s six words), so a
 * reworded sentence is a failing sentence assertion rather than a scenario that
 * silently stops checking anything.
 *
 * **They do not believe the page about consent.** *Turn on* writes
 * `approved: <version>` and `on: yes` on the plugin's node in
 * `_olai/Settings.olai`, in one write, and that FILE is what the approval step
 * waits for — the durable half, which is the half a restart comes back to.
 */

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

/** The page in front of this scenario, whichever plugin it is about — for the
 *  assertions that are about the page a step just opened rather than about a
 *  named plugin. */
const open = (world: OlaiWorld) => world.page.locator(`${PAGE}:visible`).first()

const knob = (world: OlaiWorld, key: string) =>
  world.page.locator(`${PAGE} ${PAGE_KNOB}${attr("data-key", key)}`)

// ── getting there ──────────────────────────────────────────────────────

/**
 * THE PERMALINK, COLD — a fresh document at `/plugins/<word>`, which is the
 * claim that a plugin is an ADDRESS rather than somewhere you can only click
 * to. A link in a chat, a bookmark, an alert's press and another vault's
 * README all arrive this way.
 */
When("I open the plugin page for {string}", async function (this: OlaiWorld, word: string) {
  await this.open(addressOfPlugin(word))
})

/** ...and the ordinary way in: the sidebar's own row, in this document, with
 *  no reload. */
When("I go to the plugin {string}", async function (this: OlaiWorld, word: string) {
  await shownPage(this, word)
})

Then("the plugin page is about {string}", async function (this: OlaiWorld, word: string) {
  await pageFor(this, word).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
})

/** A word with no folder behind it PARSES — it is a plugin somebody deleted,
 *  or a link from another vault — and the page's own arm is the honest answer
 *  to it, rather than a route that falls through to a not-found. */
Then("there is no plugin called {string}", async function (this: OlaiWorld, word: string) {
  await this.page.locator(PAGE_MISSING).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
  assert.equal(await pageFor(this, word).count(), 0, `a page was drawn for "${word}", which this vault has no folder for`)
})

// ── which of the six ───────────────────────────────────────────────────

/**
 * THE STATE, off the page's own word for it — `building`, `review`, `paused`,
 * `on`, `off` or `broken`.
 *
 * It is waited for rather than read: an approval publishes a revision, the
 * folder is read again, both halves are compiled, the fiber mounts and the
 * roster republishes before any of it reaches this attribute, and none of that
 * is a reload.
 */
Then("the plugin page is {string}", async function (this: OlaiWorld, stage: string) {
  const page = open(this)
  await page.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
  await this.waitUntil(
    async () => (await page.getAttribute("data-stage")) === stage,
    `the plugin page to read data-stage="${stage}"`,
  )
})

/** The second half of the status line — *2 files, 31 lines · nobody has read
 *  it yet*, *changed since you turned it on* — which is the half that tells a
 *  person what the word means for them. */
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
  // A beat, so a sentence that was merely on its way fails this rather than
  // arriving after it.
  await this.page.waitForTimeout(500)
  assert.ok(!(await page.innerText()).includes(said), `the page says ${JSON.stringify(said)}, and it may not`)
})

/** THE STANDING SENTENCE. It is asserted by its own id and by its own words
 *  because it may never quietly stop being drawn: there is no sandbox, and a
 *  page that stopped saying so would be the one page in this product that must
 *  not. */
Then("the plugin page says what running it costs", async function (this: OlaiWorld) {
  const said = this.page.locator(`${PAGE} ${PAGE_TRUST_SAID}:visible`).first()
  await said.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  const words = await said.innerText()
  assert.ok(
    words.includes("There is no sandbox") && words.includes("everything olai can reach"),
    `the trust line reads ${JSON.stringify(words)}`,
  )
})

// ── the three verbs that are a person's ────────────────────────────────

/**
 * TURN IT ON — the press that is the approval AND the switch, and the whole of
 * what a person does about a plugin.
 *
 * Waited for in the FILE rather than on the screen: the two properties land on
 * the plugin's node in `_olai/Settings.olai` in one write, and that is what
 * survives the restart scenarios and what a second tab reads. A step that
 * waited for the page to say *On* would pass on a serve that had drawn the
 * word and written nothing.
 *
 * It walks to the page and back, so a scenario whose subject is the OUTLINE
 * (the chip the plugin draws) can say *approve it* in one line and go on
 * looking at the rows. Going back is a history move rather than an open: the
 * document is the same document, which is the thing those scenarios assert.
 */
When("I approve the plugin {string}", async function (this: OlaiWorld, word: string) {
  const was = this.place()
  await shownPage(this, word)
  // A PAGE THAT MOVED UNDER THE READER HAS NO ARMED VERB, and a press that
  // crossed a revision is REFUSED — which is the whole safety of this screen
  // and is exactly the position a scenario that rewrote a half a moment ago
  // puts itself in. What a person does then is read it again and press again,
  // so that is what this does, until the settings file carries the decision.
  // The scenarios ABOUT the disarming assert it directly rather than through
  // this step.
  const read = this.page.locator(PAGE_MOVED_READ).first()
  // Read it again FIRST where the page asks: a disarmed page has no verb at
  // all, so a wait for one would spend the step's whole budget on a screen
  // that is waiting for this press.
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
  // WAITED FOR AS A MOVE, not as a shape. A plugin approved once and then
  // edited still carries `approved` and `on: yes` from the decision BEFORE the
  // edit, and one switched off still carries its `approved` — so a step that
  // waited for those keys to be PRESENT would return without pressing
  // anything, leaving the row paused or off while the page said *Review*.
  //
  // Either half moving is the press landing: the version this reader was shown
  // becomes the approved one, or the switch goes back up, and both end with
  // the plugin on at code somebody said yes to.
  const before = consentOf(this, word)
  const moved = (consent: Record<string, unknown> | undefined): boolean =>
    consent !== undefined && consent["approved"] !== undefined && consent["on"] === "yes"
      && (consent["approved"] !== before?.["approved"] || before?.["on"] !== "yes")
  // A press that lands while the roster is arriving can find its own button
  // detached — the page redraws under it — and that is not a failure: the
  // loop looks again, and the FILE is what says whether anything happened.
  //
  // EACH ATTEMPT IS BOUNDED, which is the difference between a loop and a
  // single press wearing a loop's clothes. `world.press` waits up to the whole
  // poll budget for its target to be visible and reachable, so one attempt at
  // a button the page had just replaced could spend every millisecond this
  // wait had — on a loaded machine the step then reported *the approval never
  // landed* when what had happened was that it was never pressed twice. A
  // short click, failing fast, lets the loop be a loop.
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

/** ...and the second of the three, under `•••`: a plugin somebody is
 *  iterating on with an agent, where re-approving every edit is a gesture that
 *  stops being read after the third time. */
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

/** The third: the switch itself, on a plugin that is running. It is a
 *  `role="switch"` rather than a button, because it is a state and not an
 *  action. */
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
  // A PAGE THAT MOVED UNDER THE READER HAS NO VERB AT ALL until somebody says
  // they have read it again: that is the screen's whole safety, and it is the
  // state a scenario that has just rewritten a half puts itself in. Reading
  // again is what a person does there; the scenarios ABOUT the disarming
  // assert it directly rather than through this step.
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

/**
 * THE VERBS ARE NOT ARMED, and this is the case the serve's own guard could
 * never see: the roster is live, so an edit replaces the source under somebody
 * with the page open. A button that stayed pressable across that would approve
 * what is there NOW rather than what was read, which is the one gesture in
 * this product where that distinction is the whole point.
 *
 * The primary verb is not drawn at all in this state — the disarmed block
 * stands in its place — so the absence and the block are asserted together.
 */
Then("the plugin page has disarmed its verbs", async function (this: OlaiWorld) {
  await this.page.locator(`${PAGE} ${PAGE_MOVED}`).first()
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  assert.equal(
    await this.page.locator(`${PAGE} ${PAGE_VERB}:visible`).count(),
    0,
    "the page still offers a verb over a version this reader has not been shown",
  )
})

/** ...and the press that arms them again, which is a press of its OWN and is
 *  the whole of the protection: a person cannot approve a version that arrived
 *  after the render they were looking at without saying they have seen it. */
When("I read the plugin {string} again", async function (this: OlaiWorld, word: string) {
  await shownPage(this, word)
  const read = this.page.locator(`${PAGE} ${PAGE_MOVED_READ}`).first()
  await read.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  await this.press(read)
})

// ── words before code ──────────────────────────────────────────────────

/** *What it does*: the README's own heading and first paragraph, rendered —
 *  markdown's claim, drawn by markdown, on the plugin's page. */
Then("the plugin page's README says {string}", async function (this: OlaiWorld, said: string) {
  const readme = this.page.locator(`${PAGE} ${PAGE_README}`).first()
  await this.waitUntil(
    async () => (await readme.innerText()).includes(said),
    `the README on the page to say ${JSON.stringify(said)}`,
  )
})

/** ...AND NOT THE BLOCK AT THE TOP OF IT. This README is also where the
 *  plugin's own chat is tied (`chat-agent-session` in its front matter), and
 *  front matter handed to a renderer as body is drawn as text above the
 *  title — so the page cuts it exactly as the note page does. */
Then("the plugin page's README does not say {string}", async function (this: OlaiWorld, said: string) {
  const readme = this.page.locator(`${PAGE} ${PAGE_README}`).first()
  await readme.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  // A beat, so prose still arriving fails this rather than landing after it.
  await this.page.waitForTimeout(500)
  assert.ok(!(await readme.innerText()).includes(said),
    `the README on the page says ${JSON.stringify(said)}, and it may not`)
})

/** ...AND A FENCE IN IT IS CODE, whatever plugin claims its language: the
 *  approval page reads a plugin's words before anything of it runs, so it
 *  hands no fence to a face. Found as the code block Markdown draws for an
 *  unclaimed fence, and the plugin's own drawing is nowhere in the README. */
Then("the plugin page's README draws its {word} block as code", async function (this: OlaiWorld, language: string) {
  const readme = this.page.locator(`${PAGE} ${PAGE_README}`).first()
  await readme.locator(`pre code.language-${language}`).first().waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  assert.equal(await readme.locator("[data-olai-block]").count(), 0, `the README hands a ${language} fence to a face`)
})

/** *What it uses*, read off the code's own imports rather than off anything
 *  the author wrote in prose — the kinds it teaches, the slots it draws into,
 *  the services it names. */
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

/**
 * THE TAB PER FILE, in order — and the ABSENCE is as much of the claim as the
 * presence. `browser.tsx` is optional: a plugin that only teaches the vault a
 * word, or only rings a doorbell, draws nothing, and a page that quietly drew
 * an empty second tab would be inventing a file the author did not write, in
 * the one place a person is being asked to say yes to what they can see.
 */
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

// ── what changed ───────────────────────────────────────────────────────

/**
 * THE DIFF, and why it is a diff: *ask again* must not mean *read all of it
 * again*. The person already read this plugin and has been running it; what
 * changed is one class name, and that is the whole of the new decision.
 */
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

/** ...and a line nobody touched is CONTEXT rather than a change — the half of
 *  the drawing that says *this is an edit, not a rewrite*. */
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

// ── the conversation that built it ─────────────────────────────────────

/** *Ask for a change*, under `•••` — offered only where there is somewhere to
 *  say it. */
Then("the plugin page offers to ask for a change", async function (this: OlaiWorld) {
  await openedMore(this)
  await this.page.locator(PAGE_ASK_CHANGE).first().waitFor({ state: "visible", timeout: POLL_TIMEOUT })
})

/** ...and pressing it, which opens the chat ABOUT this page in the pane
 *  beside it — chat decides where it lands and focuses the pane that already
 *  has it. */
When("I ask for a change to the plugin {string}", async function (this: OlaiWorld, word: string) {
  await shownPage(this, word)
  await openedMore(this)
  const row = this.page.locator(PAGE_ASK_CHANGE).first()
  await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  await this.press(row)
})

/**
 * ...AND A SERVE WITH NO AGENT OFFERS NO DOOR AT ALL, rather than a row that
 * would open a dead end.
 *
 * Two absences, because there are two doors onto a conversation here: the
 * page's own *Ask…* row, which opens the builder chat in the pane beside the
 * page, and the fault's *Ask the agent to fix it*. With nothing this machine
 * can start, the *Ask* spot is not drawn at all and the page says what is
 * missing in words instead.
 */
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

/** The primary verb of a plugin that would not start: the fault, handed over
 *  VERBATIM, because an agent told "it broke" has to go and find out what and
 *  the serve already knows. */
When("I ask the builder to fix it", async function (this: OlaiWorld) {
  const verb = verbOf(this)
  await verb.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  assert.equal(await verb.getAttribute("data-verb"), "ask-fix", "the page's verb is not *Ask Claude to fix it*")
  await this.press(verb)
})

// ── knobs, on the page ─────────────────────────────────────────────────

/** One knob per leaf the plugin declared, found by the property's own name.
 *  A knob edit re-applies the row without touching its approval, because the
 *  version is a hash of code and a setting is not code. */
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

/**
 * REFUSED IN PLACE: the value a person typed is still in the control, the
 * reason is under it, and nothing was written.
 *
 * The serve is what refuses — the schema is the plugin's and the knob does not
 * second-guess it — so what reaches the page is a reason somebody else's words
 * wrote, and this asserts the SHAPE of the refusal rather than its sentence:
 * a problem drawn inside the knob it is about. The wording is held by whoever
 * wrote the schema, and the file not moving is held on the next line of every
 * scenario that uses this.
 *
 * Either id answers: the knob is the settings control every row's knobs are
 * drawn with, so a refusal is its `plugin-problem`, and a refusal that is
 * announced is a `role="alert"`. A page that drew neither drew no refusal.
 */
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

// ── the handset ────────────────────────────────────────────────────────

/**
 * BELOW `md` THE PRIMARY VERB IS IN A STICKY FOOT, with the trust line under
 * it — because the one press this page exists for may not be the one thing a
 * person has to scroll to find, and because the sentence about what running a
 * plugin costs belongs beside the press rather than a screen above it.
 *
 * Both copies are in the DOM and exactly one has a box, which is what makes
 * every other step's `:visible` the right question.
 */
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

// ── a page that must not be disturbed ──────────────────────────────────

/**
 * A MARK ON THE DRAWN PAGE, so a scenario can tell *this element is still the
 * one I was reading* from *the page was torn down and built again*.
 *
 * A plugin somebody else is rebuilding publishes a roster, and a roster is
 * published to every tab: a page keyed carelessly would remount on each one,
 * losing the tab somebody had open, the scroll they were at and — the sharp
 * end — the version the verbs were armed against.
 */
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


// ── the second-rank verbs, which are the ones a person reaches for later ──

/**
 * STOP TRUSTING CHANGES — the way back out of a standing approval, which the
 * menu never used to offer.
 *
 * It is the same row in the same menu as *Always trust changes*: the entry
 * says which way the decision is pointing and the press is the other way, so a
 * scenario asserting the state of that decision reads the ROW rather than the
 * settings file.
 */
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

/** Which of the two trust rows the menu is offering — the sign that a standing
 *  approval is in force, drawn where the decision was made. */
Then("the plugin {string} offers to {string} trusting changes", async function (this: OlaiWorld, word: string, way: string) {
  await shownPage(this, word)
  await openedMore(this)
  const row = this.page.locator(way === "stop" ? PAGE_TRUST_STOP : PAGE_TRUST_ALWAYS).first()
  await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  await this.page.keyboard.press("Escape")
})

/**
 * DELETE, CONFIRMED — the one gesture that gets rid of a plugin, and the only
 * one in the app that reaches the halves at all: they are deliberately not in
 * the sidebar's file tree, so without this a plugin made in one sentence needs
 * a terminal to be rid of.
 */
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

/** *I'll read it now* — the reader's way past a build whose agent never said
 *  it had finished (a conversation abandoned halfway). */
When("I read the unfinished plugin {string} anyway", async function (this: OlaiWorld, word: string) {
  await shownPage(this, word)
  const button = this.page.locator(`${PAGE} ${PAGE_READ_ANYWAY}`).first()
  await button.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  await this.press(button)
})

/** What came of a press that spoke to the builder. The press used to answer
 *  nothing at all where there was no dock to open, which on a handset is
 *  always. */
Then("the plugin page says {string} came of asking", async function (this: OlaiWorld, said: string) {
  const line = this.page.locator(`${PAGE} ${PAGE_ASK_SAID}`).first()
  await line.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  await this.waitUntil(
    async () => (await line.innerText()).includes(said),
    `the page to say ${JSON.stringify(said)} came of asking`,
  )
})

/**
 * THE CONVERSATION BESIDE THE PAGE — what *Ask for a change…* opens, and the
 * one place a plugin's builder chat is read now: its own page, in the pane
 * next to the plugin's.
 *
 * It is the chat OF THE README NOTE, so the address names that note — which
 * asserts both halves at once: the press opened a chat page, and the chat it
 * opened is this plugin's own.
 */
Then("the conversation building {string} is beside the page", async function (this: OlaiWorld, word: string) {
  const key = chatKeyFor(word)
  await this.page.locator(`${CHAT_PAGE}${attr("data-item", key)}`)
    .first().waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
  // ...AND IT IS THE CONVERSATION THE SUITE NOW ADDRESSES, the same way the
  // one the mint opened is (`./new_plugin_steps.ts`): a press on this page is
  // how a person selects it.
  this.activeAgent = key
})

/**
 * WHICH OF THE FOLDER'S FILES HAVE LANDED, as the *being built* screen lists
 * them.
 *
 * It is what the page can honestly say about a build in flight — a roster sees
 * files, not keystrokes — and it is also the wait a scenario needs before it
 * speaks for the agent: a test writing the halves straight to disk and calling
 * `vault-plugins_run` in the next breath can beat its own write to the serve,
 * which an agent writing through `vault-plugins_write` never does.
 */
Then("the plugin {string} has written {string}", async function (this: OlaiWorld, word: string, file: string) {
  await shownPage(this, word)
  const row = this.page.locator(`${PAGE} ${attr("data-file", file)}`).first()
  await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  await this.waitUntil(
    async () => (await row.getAttribute("data-written")) === "yes",
    `"${word}" to have written ${file}`,
  )
})
