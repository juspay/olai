/**
 * A CONVERSATION BESIDE WHAT IT IS ABOUT — the verb that puts it there, and
 * the one line every other face draws while it is there.
 *
 * The two halves are one button (`chat-beside`): *Open beside ›* where no
 * pane has this chat, *Shown beside* where one does, with `data-beside`
 * saying which. So the steps below are about the GESTURE a person makes —
 * opening, or going to what is already open — and each asserts the words,
 * because a button that opened a pane while reading *Shown beside* would be a
 * different promise kept by accident.
 *
 * WHERE the line is drawn is not in the steps, deliberately: the fold, the
 * node's page and the note's seat draw the same line under the same id, and
 * which of them a scenario is looking at is said by the pane it opened. What
 * the places have in common is the claim worth making, and *the conversation
 * is drawn once* is it.
 */

import { Then, When } from "@olai/tests/harness/runner.ts";
import { selector } from "@olai/web/testlib";
import { attr, CHAT_PANEL, HYDRATION_TIMEOUT, POLL_TIMEOUT } from "@olai/tests/harness/world.ts";
import type { Locator } from "@olai/tests/harness/playwright.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

import { TESTID } from "../../src/testids.ts";
import { CHAT_BESIDE } from "../selectors.ts";

/** The fold under a row, by the node it belongs to. */
const fold = (world: OlaiWorld, node: string): Locator =>
  world.frontLane().locator(`${selector(TESTID.agentFold)}${attr("data-agent", world.nodeId(node))}`);

/** The one line a face draws in place of a conversation that is in a pane. */
const besideLine = (world: OlaiWorld, chat: string): Locator =>
  world.frontLane().locator(`${selector(TESTID.chatBesideLine)}${attr("data-agent", world.nodeId(chat))}`);

/** A beside button, waited for and read: both what it SAYS and which of the
 *  two states it is in, because the words are the promise. */
const beside = async (world: OlaiWorld, where: Locator, shown: boolean): Promise<Locator> => {
  const button = where.locator(CHAT_BESIDE);
  const reads = shown ? "Shown beside" : "Open beside ›";
  await button.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await world.waitUntil(async () =>
    await button.getAttribute("data-beside") === String(shown) && (await button.innerText()).trim() === reads,
    `the beside button to read ${JSON.stringify(reads)}`, HYDRATION_TIMEOUT);
  return button;
};

// ── the gesture ────────────────────────────────────────────────────────

When("I open the chat beside the fold on {string}", async function (this: OlaiWorld, node: string) {
  await this.press(await beside(this, fold(this, node), false));
});

When("I press Shown beside about {string}", async function (this: OlaiWorld, chat: string) {
  await this.press(await beside(this, besideLine(this, chat), true));
});

// ── drawn once ─────────────────────────────────────────────────────────

/** ONE LINE INSTEAD OF THE CONVERSATION, wherever the item is drawn. The
 *  second half — that the transcript really is gone from here — is `the
 *  conversation is drawn once`, which asks it of the whole window. */
Then("the chat about {string} says it is shown beside", async function (this: OlaiWorld, chat: string) {
  await beside(this, besideLine(this, chat), true);
});

Then("the fold on {string} offers to open the chat beside", async function (this: OlaiWorld, node: string) {
  await beside(this, fold(this, node), false);
});

/** THE WHOLE OF THE RULE, said once: however many faces are on screen that
 *  could draw this conversation, exactly one of them does. */
Then("the conversation is drawn once", async function (this: OlaiWorld) {
  await this.waitUntil(async () => await this.frontLane().locator(`${CHAT_PANEL}:visible`).count() === 1,
    "exactly one conversation on screen", POLL_TIMEOUT);
});
