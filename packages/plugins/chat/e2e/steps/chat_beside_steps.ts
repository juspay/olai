import { Then, When } from "@olai/tests/harness/runner.ts";
import { selector } from "@olai/web/testlib";
import { attr, CHAT_PANEL, HYDRATION_TIMEOUT, POLL_TIMEOUT } from "@olai/tests/harness/world.ts";
import type { Locator } from "@olai/tests/harness/playwright.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

import { TESTID } from "../../src/testids.ts";
import { CHAT_BESIDE } from "../selectors.ts";

const fold = (world: OlaiWorld, node: string): Locator =>
  world.frontLane().locator(`${selector(TESTID.agentFold)}${attr("data-agent", world.nodeId(node))}`);

const besideLine = (world: OlaiWorld, chat: string): Locator =>
  world.frontLane().locator(`${selector(TESTID.chatBesideLine)}${attr("data-agent", world.nodeId(chat))}`);

const beside = async (world: OlaiWorld, where: Locator, shown: boolean): Promise<Locator> => {
  const button = where.locator(CHAT_BESIDE);
  const reads = shown ? "Shown beside" : "Open beside ›";
  await button.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await world.waitUntil(async () =>
    await button.getAttribute("data-beside") === String(shown) && (await button.innerText()).trim() === reads,
    `the beside button to read ${JSON.stringify(reads)}`, HYDRATION_TIMEOUT);
  return button;
};

When("I open the chat beside the fold on {string}", async function (this: OlaiWorld, node: string) {
  await this.press(await beside(this, fold(this, node), false));
});

When("I open the chat beside from the agent line", async function (this: OlaiWorld) {
  await this.press(await beside(this, this.chatLine(), false));
});

When("I press Shown beside about {string}", async function (this: OlaiWorld, chat: string) {
  await this.press(await beside(this, besideLine(this, chat), true));
});

When("I press the beside door on the Chats row {string}", async function (this: OlaiWorld, chat: string) {
  await this.showSidebar();
  const door = this.page.locator(`${CHAT_BESIDE}${attr("data-agent", this.nodeId(chat))}`);
  await door.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.press(door);
});

Then("the chat about {string} says it is shown beside", async function (this: OlaiWorld, chat: string) {
  await beside(this, besideLine(this, chat), true);
});

Then("the fold on {string} offers to open the chat beside", async function (this: OlaiWorld, node: string) {
  await beside(this, fold(this, node), false);
});

Then("the conversation is drawn once", async function (this: OlaiWorld) {
  await this.waitUntil(async () => await this.frontLane().locator(`${CHAT_PANEL}:visible`).count() === 1,
    "exactly one conversation on screen", POLL_TIMEOUT);
});
