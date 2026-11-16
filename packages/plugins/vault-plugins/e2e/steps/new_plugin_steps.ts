/**
 * ⌘K → NEW PLUGIN — asking for one, in the two levels the palette already
 * has, and what the press leaves behind.
 *
 * ## Nobody is asked about halves, slots or a word grammar
 *
 * A person says in one sentence what they want. olai suggests a name, says
 * where the folder will be kept, and the press lands on the plugin's own page
 * with the conversation that is building it docked beside. That is the whole
 * of the gesture, and these steps drive exactly it: the palette's own level
 * machinery (crumbs, the box, the submit, the refusal line) is navigation's
 * and is gripped through navigation's steps, so what is added here is only
 * what this row knows — the name it suggested, the folder it named, and the
 * conversation it bound.
 *
 * ## The assertions are the DISK and the DOCK, not the sentence
 *
 * A mint that drew the right words and wrote nothing would pass any assertion
 * made about the screen. So the folder is asserted as files, the builder is
 * asserted as the `builder` property on the plugin's settings node, and the
 * conversation is asserted as the dock seated on that node — three facts that
 * outlive the frame they were drawn in.
 */

import * as assert from "node:assert/strict"
import * as fs from "node:fs"
import * as path from "node:path"

import { Then, When } from "@olai/tests/harness/runner.ts"
import { PLUGIN_TESTID } from "@olai/tests/harness/testids.ts"
import { selector } from "@olai/web/testlib"
import {
  attr,
  CHAT_DOCK,
  HYDRATION_TIMEOUT,
  PALETTE,
  PALETTE_ASK_ERROR,
  PALETTE_INPUT,
  PALETTE_ITEM,
  PALETTE_SAID,
  POLL_TIMEOUT,
} from "@olai/tests/harness/world.ts"
import type { OlaiWorld } from "@olai/tests/harness/world.ts"

import { consentOf } from "./faces.ts"

/**
 * BOTH LEVELS ARE THE PALETTE'S OWN, and this row draws no node in either.
 *
 * That is why nothing below is located by an id of this package's: *New
 * plugin* contributes a row and two level values, and navigation renders them
 * with the same box, rows, option line, submit and said-line every other level
 * uses. A testid of our own on one of them would be this row claiming a piece
 * of furniture it does not own — and would stop being true the moment the
 * palette redrew it.
 *
 * Level 1 is a GROUP: the sentence goes in the box and the rows are the
 * engines that could build it (`new-plugin-by-<engine>`), with an empty box
 * answering `new-plugin-say` and a machine with no agent answering
 * `new-plugin-by-hand`. Level 2 is a VALUE: the name in the same box, the
 * folder as the level's one option, and Enter or *Start building* to submit.
 */
const OPTION = selector(PLUGIN_TESTID.paletteOption)
const SUBMIT = selector(PLUGIN_TESTID.paletteSubmit)

/** The palette row this flow opens at — the same shape chat's `new-chat` row
 *  has, because it is deliberately the same gesture with a different noun. */
const NEW_PLUGIN_ROW = `${PALETTE_ITEM}${attr("data-id", "new-plugin")}`

When("I open New plugin from the palette", async function (this: OlaiWorld) {
  const box = this.page.locator(PALETTE_INPUT)
  await box.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
  await box.fill("new plugin")
  const row = this.page.locator(NEW_PLUGIN_ROW)
  await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
  await this.press(row)
})

/**
 * THE FIRST LEVEL: one sentence about what it should do, and then WHO BUILDS
 * IT.
 *
 * Enter takes the highlighted row and drills, which on a serve with an agent
 * is the first engine under *Who builds it* and on one without is *Make the
 * folder anyway* — so one step reads the same either way, and the scenarios
 * that care which it was assert that afterwards.
 */
When("I ask for a plugin that {string}", async function (this: OlaiWorld, sentence: string) {
  const box = this.page.locator(PALETTE_INPUT)
  await box.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  await box.fill(sentence)
  await this.page.locator(PALETTE).waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  await box.press("Enter")
})

/**
 * THE SECOND LEVEL: olai suggests a name from the sentence, which a person may
 * take or type over.
 *
 * The suggestion's WORDING is the level's own business and changes with the
 * sentence; what a scenario can hold it to is that there IS one, because a
 * name box a person has to fill from nothing is a second question where the
 * design promised one.
 */
Then("a name is suggested for the new plugin", async function (this: OlaiWorld) {
  const box = this.page.locator(PALETTE_INPUT)
  await box.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
  await this.waitUntil(
    async () => (await box.inputValue()).trim() !== "",
    "the level to suggest a name rather than an empty box",
  )
})

/**
 * ...AND WHERE IT WILL BE KEPT, said at the moment of naming rather than
 * discovered afterwards. The folder's name is the plugin's word, so this line
 * is the only place a person sees the slug they are choosing — and a plugin is
 * a folder somebody can show somebody else, which is a fact about their vault
 * and not an implementation detail.
 */
Then("the new plugin will be kept in {string}", async function (this: OlaiWorld, folder: string) {
  const line = this.page.locator(OPTION)
  await this.waitUntil(
    async () => (await line.innerText()).includes(folder),
    `the level's option to say the folder is ${JSON.stringify(folder)}`,
  )
})

/** Typed, and not yet submitted — so a scenario can ask what the folder line
 *  says about the name while it is still being chosen, which is the whole
 *  point of that line. */
When("I name the plugin {string}", async function (this: OlaiWorld, name: string) {
  const box = this.page.locator(PALETTE_INPUT)
  await box.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  await box.fill(name)
})

/** *Start building* — the level's own submit, pressed rather than typed, so
 *  the scenario goes through the control a reader can see. */
When("I accept the name", async function (this: OlaiWorld) {
  await this.press(this.page.locator(SUBMIT))
})

/**
 * A REFUSED NAME IS REFUSED IN PLACE — the level stays open, with what was
 * typed still in it and a sentence saying why.
 *
 * The alternative is what a modal usually does: close, navigate, and leave
 * somebody to work out that nothing happened. A word already taken and a word
 * that is not a word are both things a person fixes by typing two characters,
 * and they can only do that if the box they typed into is still there.
 */
Then("the new plugin level refuses with {string}", async function (this: OlaiWorld, said: string) {
  // THE PALETTE HAS TWO LINES AND A REFUSAL LANDS ON EITHER, which is its
  // arrangement rather than this row's: a level's own `validate` refuses
  // before anything is sent and lands on the ask line, while a refusal the
  // SERVE answered comes back as what the submit said. A scenario about a
  // refused name must not care which — what it is about is that the sentence
  // reached the person with the box still in front of them.
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

// ── what the press left behind ─────────────────────────────────────────

/** The folder, as files on disk — the half of a mint that outlives the tab. */
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

/**
 * THE CONVERSATION THAT IS BUILDING IT, bound to the plugin by a property on
 * the plugin's own settings node — the row's record, because which chat built
 * this plugin is a fact about the plugin rather than about that chat.
 */
Then("the plugin {string} is being built by a conversation", async function (this: OlaiWorld, word: string) {
  await this.waitUntil(
    () => Promise.resolve(typeof consentOf(this, word)?.["builder"] === "string"),
    `a builder to be bound to "${word}"`,
  )
})

/** ...and a serve with no agent binds none, which is the honest answer rather
 *  than a failure of the mint: the folder is a folder somebody can write by
 *  hand. */
Then("the plugin {string} has no builder", async function (this: OlaiWorld, word: string) {
  // Settled first — the mint writes the README before it would write a
  // builder, so this must not pass merely by being asked early.
  await this.waitUntil(
    () => Promise.resolve(consentOf(this, word) !== undefined || fs.existsSync(path.join(this.scratch(), "plugins", word))),
    `"${word}" to have been minted at all`,
  )
  await this.page.waitForTimeout(500)
  assert.equal(consentOf(this, word)?.["builder"], undefined, `"${word}" bound a builder on a serve with no agent`)
})

/**
 * ...AND IT IS DOCKED BESIDE THE PAGE, which is what makes watching a plugin
 * get built one screen rather than two: the page fills in as the three files
 * land, and the conversation doing the landing is in the seat beside it.
 */
Then("the builder conversation for {string} is docked", async function (this: OlaiWorld, word: string) {
  await this.waitUntil(
    () => Promise.resolve(typeof consentOf(this, word)?.["builder"] === "string"),
    `a builder to be bound to "${word}"`,
  )
  const builder = consentOf(this, word)?.["builder"] as string
  await this.page.locator(`${CHAT_DOCK}${attr("data-agent", builder)}`)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
  // ...AND IT IS THE CONVERSATION THE SUITE NOW ADDRESSES. Chat's own steps
  // speak to the agent a scenario SELECTED, and every way to select one is a
  // gesture a person makes on a chat surface — opening a fold, a page, the
  // panel's picker. Landing here nobody made one: the dock was filled by the
  // mint. Saying which conversation that was is what makes chat's vocabulary
  // usable from a plugin's page.
  this.activeAgent = builder
})

/** The one line of the preamble nothing else in this product says — enough to
 *  count it by, and specific enough that a transcript carrying it is carrying
 *  the teaching rather than a paraphrase of it. */
const PREAMBLE = "Call `vault-plugins_guide` before you write anything"

/**
 * THE BUILDER WAS TOLD WHAT IT IS DOING, ONCE.
 *
 * The preamble rides chat's own teaching seam on the first message: what the
 * plugin is called, what its word is, which three files to write, which tool
 * to call before writing anything, and that it cannot turn the thing on
 * itself. Delivered twice it is a conversation that re-teaches itself every
 * turn — the failure chat's own contract scenarios were written for — so the
 * count is the claim.
 *
 * A transcript shows a teaching twice at most: olai's own notice, and the
 * scripted agent's echo of the message it rode under. More than that is a
 * second delivery, which is what this fails on.
 */
Then("the builder was told how to write a plugin exactly once", async function (this: OlaiWorld) {
  const carried = async (): Promise<number> =>
    (await this.page.locator("body").innerText()).split(PREAMBLE).length - 1
  await this.waitUntil(async () => (await carried()) > 0, "the builder's preamble to reach the conversation")
  // A beat, so a second delivery that was merely on its way fails this rather
  // than arriving after it.
  await this.page.waitForTimeout(700)
  const times = await carried()
  assert.ok(times <= 2, `the preamble is in the conversation ${times} times, which is more than one delivery`)
})

/** What was handed over on a press — the fault VERBATIM, because an agent told
 *  "it broke" has to go and find out what and the serve already knows. */
Then("the builder conversation carries {string}", async function (this: OlaiWorld, said: string) {
  const dock = this.page.locator(CHAT_DOCK)
  await dock.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
  await this.waitUntil(
    async () => (await dock.innerText()).includes(said),
    `the builder's conversation to carry ${JSON.stringify(said)}`,
  )
})
