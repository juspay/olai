/**
 * The FILE's own delete — `document_editing.feature`'s fourth milestone, and
 * `trash_steps.ts`'s shape said once more at file size.
 *
 * The two rows these steps drive are one control in three states — offered,
 * asking, working — so both presses reach it by the same selector rather than
 * by the words on it, which is the same fact `file-delete-verb` records and
 * the same reason the trash's steps are written this way: a control that
 * cannot be taken back is pressed once too often to read its label.
 */

import { Then, When } from "@cucumber/cucumber"
import { selector, TESTID } from "@olai/web/testlib"

import type { OlaiWorld } from "../support/world.ts"

/** The verbs themselves — selector'd once, because a control in three states
 *  is the thing a scenario must not disambiguate by hand. */
const VERB = selector(TESTID.fileDeleteVerb)
const ASKING = selector(TESTID.fileDeleteConfirm)
const CANCEL = selector(TESTID.fileDeleteCancel)
const SAID = selector(TESTID.fileDeleteSaid)

/** How long a live redraw MAY take; the app's own. */
const POLL_TIMEOUT = 5000

const pressDelete = async (world: OlaiWorld): Promise<void> => {
  await world.page.locator(VERB).waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  await world.page.locator(VERB).click()
}

When("I press Delete file", async function (this: OlaiWorld) {
  await pressDelete(this)
  await this.page.locator(ASKING).waitFor({ state: "visible", timeout: POLL_TIMEOUT })
})

/** …the SECOND press, which is the one that deletes. Named separately for the
 *  reason the trash's own two are: the two presses reach the same control and
 *  mean entirely different things, and a scenario that says so cannot be
 *  misread by whoever copies the pattern next. */
When("I confirm deleting the file", async function (this: OlaiWorld) {
  await this.page.locator(ASKING).waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  await pressDelete(this)
  await this.waitForFrame()
})

When("I cancel deleting the file", async function (this: OlaiWorld) {
  await this.page.locator(CANCEL).click()
  await this.waitUntil(
    async () => (await this.page.locator(ASKING).count()) === 0,
    "the question is still up after Cancel",
  )
})

Then(
  "the deletion asks {string}",
  async function (this: OlaiWorld, text: string) {
    const line = this.page.locator(ASKING).first()
    await line.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
    const said = (await line.innerText()).replace(/\s+/g, " ").trim()
    if (said !== text) {
      throw new Error(
        `the delete question reads ${JSON.stringify(said)}, not ${JSON.stringify(text)}`,
      )
    }
  },
)

/** THE REFUSAL, verbatim, under the control that was asking: what the planner
 *  refuses is its own sentence — named records and all — and a scenario that
 *  paraphrased it would be testing the step rather than the gate. */
Then(
  "the deletion is refused saying {string}",
  async function (this: OlaiWorld, text: string) {
    await this.waitUntil(
      async () => {
        const lines = await this.page.locator(SAID).allInnerTexts()
        return lines.some((line) => line.replace(/\s+/g, " ").trim() === text)
      },
      `the file's delete to be refused ${JSON.stringify(text)}`,
    )
  },
)

Then("the file's delete is not offered", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator(VERB).count()) === 0,
    "a delete control is drawn where none belongs",
  )
})

Then("the file's delete is offered", async function (this: OlaiWorld) {
  await this.page.locator(VERB).waitFor({ state: "visible", timeout: POLL_TIMEOUT })
})
