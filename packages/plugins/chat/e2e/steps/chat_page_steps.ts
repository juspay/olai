/**
 * A CHAT'S OWN PAGE — `/chat/<item>`, what it says about the item it belongs
 * to, and the two verbs on it.
 *
 * The CONVERSATION on this page is addressed by the ordinary chat vocabulary
 * (`./chat_steps.ts`): the page draws the same `agentPageHead`/`agentPageFoot`
 * a node's page does, under the same `data-agent`, so `world.chat(…)` finds it
 * with no special case. What is here is what the PAGE adds — its head, the
 * switch saying where a note's chat opens, and *Open <name> beside*.
 */
import assert from "node:assert/strict";
import { Then, When } from "@olai/tests/harness/runner.ts";
import { selector } from "@olai/web/testlib";
import {
  attr,
  BREADCRUMBS,
  CHAT_PANEL,
  HYDRATION_TIMEOUT,
  POLL_TIMEOUT,
} from "@olai/tests/harness/world.ts";
import type { Locator } from "@olai/tests/harness/playwright.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

import { TESTID } from "../../src/testids.ts";
import {
  ASK_INPUT,
  ASK_SEND,
  CHAT_ABOUT,
  CHAT_FILE_MARK,
  CHAT_OPEN_BESIDE,
  CHAT_OPENS,
  CHAT_OPENS_SWITCH,
  CHAT_PAGE,
  CHAT_PAGE_STANDING,
  CHAT_PAGE_TITLE,
  CHAT_PAGE_WHERE,
} from "../selectors.ts";
import { matterOf } from "./chat_about_steps.ts";

/** The chat page in front, whatever it is about. */
const page = (world: OlaiWorld): Locator => world.frontLane().locator(CHAT_PAGE);

/** ...and the page about one item, by the key its address names. */
const pageOf = (world: OlaiWorld, item: string): Locator =>
  world.frontLane().locator(`${CHAT_PAGE}${attr("data-item", item)}`);

/** The head's three facts: what kind of item, what it is called, and where it
 *  is. Asserted together because they are one line a person reads. */
const heads = async (world: OlaiWorld, item: string, kind: string, name: string, where: string): Promise<void> => {
  const here = pageOf(world, item);
  await here.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.equal(await here.getAttribute("data-kind"), kind, `the chat page of ${item} is not about a ${kind}`);
  await world.waitUntil(async () => (await here.locator(CHAT_PAGE_TITLE).innerText()).trim() === name,
    `the chat page to be titled ${JSON.stringify(name)}`, HYDRATION_TIMEOUT);
  await world.waitUntil(async () => (await here.locator(CHAT_PAGE_WHERE).innerText()).trim() === where,
    `the chat page to say it is at ${JSON.stringify(where)}`, HYDRATION_TIMEOUT);
};

Then("the chat page is about the note {string} named {string}", async function (this: OlaiWorld, note: string, name: string) {
  await heads(this, `/${note}`, "note", name, note);
  // A NOTE'S CHAT WEARS ITS FILE'S MARK, as every list of chats draws it.
  assert.equal(await pageOf(this, `/${note}`).locator(CHAT_FILE_MARK).count(), 1, "the chat page wears no file mark");
});

Then("the chat page is about the node {string} named {string} in {string}", async function (this: OlaiWorld, node: string, name: string, file: string) {
  await heads(this, this.nodeId(node), "node", name, file);
});

/** THE PAGE DRAWS NO BREADCRUMB. A chat is not inside anything — it belongs to
 *  one item, and that item is the title. */
Then("the chat page shows no breadcrumb", async function (this: OlaiWorld) {
  await page(this).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.equal(await this.frontLane().locator(BREADCRUMBS).count(), 0, "the chat page drew a breadcrumb");
});

/** HOW IT STANDS, at the right of the head. */
Then("the chat page stands {string}", async function (this: OlaiWorld, standing: string) {
  const mark = page(this).locator(CHAT_PAGE_STANDING);
  await mark.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () => await mark.getAttribute("data-standing") === standing,
    `the chat page to stand ${standing}`, HYDRATION_TIMEOUT);
});

/** A NODE'S SLEEP LINE is on its chat page exactly as it is on the node's own
 *  page — and a NOTE'S chat has none at all, with no *Tidy memory* beside it:
 *  the note IS the memory of its chat. */
Then("the chat page offers to put the chat to sleep", async function (this: OlaiWorld) {
  await page(this).locator(selector(TESTID.chatSleeping)).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

Then("the chat page never offers sleep or tidying", async function (this: OlaiWorld) {
  const here = page(this);
  await here.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  // The agent line is on screen, so a conversation HAS been drawn — an absence
  // read before that would pass on every page.
  await here.locator(selector(TESTID.agentPageHead)).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.equal(await here.locator(selector(TESTID.chatSleeping)).count(), 0, "a note's chat page offered sleep");
  assert.equal(await here.locator(selector(TESTID.chatTidyMemory)).count(), 0, "a note's chat page offered tidying");
  assert.ok(!(await here.innerText()).includes("Memory"), "a note's chat page says Memory");
});

Then("the chat page conversation is ready", async function (this: OlaiWorld) {
  const here = page(this);
  await here.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const item = await here.getAttribute("data-item");
  assert.ok(item, "the chat page names no item");
  await here.locator(`${selector(TESTID.agentPageFoot)}${attr("data-agent", item)}`)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  // SCOPED TO THE PAGE, not to the harness's conversation hosts: a note's
  // chat can be drawn in the side panel at the same time, and a locator
  // matching both is a strict-mode failure rather than an answer.
  const panel = here.locator(`${selector(TESTID.agentPageFoot)}${attr("data-agent", item)} ${CHAT_PANEL}`);
  await this.waitUntil(async () => await panel.getAttribute("data-session-id") !== null,
    "the chat page's conversation identity", HYDRATION_TIMEOUT);
});

// ── the door on a page whose item has no chat yet ──────────────────────

Then("the chat page offers to chat about {string}", async function (this: OlaiWorld, name: string) {
  const door = page(this).locator(`${CHAT_ABOUT}${attr("data-where", "page")}`);
  await door.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.equal(await door.locator(ASK_INPUT).getAttribute("placeholder"), `Ask about ${name}…`);
});

Then("the chat page offers no chat box", async function (this: OlaiWorld) {
  await this.waitUntil(async () => await page(this).locator(CHAT_ABOUT).count() === 0,
    "the chat page to stop offering a box", HYDRATION_TIMEOUT);
});

When("I ask from the chat page {string}", async function (this: OlaiWorld, text: string) {
  const door = page(this).locator(`${CHAT_ABOUT}${attr("data-where", "page")}`);
  await door.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await door.locator(ASK_INPUT).fill(text);
  await door.locator(ASK_SEND).click();
});

// ── where a note's chat opens ──────────────────────────────────────────

Then("the chat page says it opens {string}", async function (this: OlaiWorld, words: string) {
  const line = page(this).locator(CHAT_OPENS);
  await line.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () => (await line.locator(CHAT_OPENS_SWITCH).innerText()).trim() === words,
    `the switch to read ${JSON.stringify(words)}`, HYDRATION_TIMEOUT);
  assert.equal(await line.getAttribute("data-beside"), String(words !== "alone"));
});

Then("the chat page has no opens switch", async function (this: OlaiWorld) {
  const here = page(this);
  await here.locator(selector(TESTID.agentPageHead)).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.equal(await here.locator(CHAT_OPENS).count(), 0, "a node's chat page drew an opens switch");
});

When("I press the opens switch", async function (this: OlaiWorld) {
  const control = page(this).locator(CHAT_OPENS_SWITCH);
  await control.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.press(control);
});

/** WHAT THE NOTE ITSELF SAYS, which is where the answer lives: `chat-opens` in
 *  its own front matter, readable by a person and carried by a `git pull`. */
Then("the note {string} says it opens {string}", async function (this: OlaiWorld, note: string, answer: string) {
  await this.waitUntil(async () => matterOf(this, note)["chat-opens"] === answer,
    `${note} to say \`chat-opens: ${answer}\``, POLL_TIMEOUT);
});

// ── the item, beside its chat ──────────────────────────────────────────

When("I press Open beside on the chat page", async function (this: OlaiWorld) {
  const button = page(this).locator(CHAT_OPEN_BESIDE);
  await button.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.press(button);
});

Then("the chat page offers to open {string} beside", async function (this: OlaiWorld, name: string) {
  const button = page(this).locator(CHAT_OPEN_BESIDE);
  await button.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () => (await button.innerText()).trim() === `Open ${name} beside ›`,
    `the button to offer to open ${name} beside`, HYDRATION_TIMEOUT);
});

Then("the chat page says the item is shown beside", async function (this: OlaiWorld) {
  const button = page(this).locator(CHAT_OPEN_BESIDE);
  await button.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () => await button.getAttribute("data-beside") === "true"
    && (await button.innerText()).trim() === "Shown beside",
    "the button to read Shown beside", HYDRATION_TIMEOUT);
});
