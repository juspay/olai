import assert from "node:assert/strict";
import { Given, Then, When } from "@cucumber/cucumber";
import { PLUGIN_TESTID } from "@olai/bundle/testids";
import { selector } from "@olai/web/testlib";
import { attr, NODE_MENU, NODE_MENU_ITEM, NODE_MENU_PANEL, POLL_TIMEOUT, HYDRATION_TIMEOUT, CHAT_PANEL, CHAT_INPUT, CHAT_TRANSCRIPT } from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

const fold = (world: OlaiWorld, node: string) => world.page.locator(`${selector(PLUGIN_TESTID.agentFold)}${attr("data-agent", world.nodeId(node))}`);
const standing = (world: OlaiWorld, node: string) => world.node(node).locator(`${selector(PLUGIN_TESTID.agentStanding)}${attr("data-agent", world.nodeId(node))}`);

export const openFold = async (world: OlaiWorld, node: string) => {
  world.activeAgent = node;
  const control = standing(world, node);
  if (await control.count() === 0) {
    await world.showSidebar();
    const row = world.page.locator(`${selector(PLUGIN_TESTID.agentRoster)} ${selector(PLUGIN_TESTID.agentRow)}${attr("data-agent", world.nodeId(node))}`);
    await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    await world.press(row);
    await fold(world, node).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    return;
  }
  await control.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  if (await control.getAttribute("aria-expanded") !== "true") await world.press(control);
  await fold(world, node).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
};
Given("I open the {string} agent on node {string}", async function(this: OlaiWorld, engine: string, node: string) {
  this.activeAgent = node;
  const bound = standing(this, node);
  await this.waitUntil(async () => await bound.count() > 0 || await this.node(node).locator(`${selector(PLUGIN_TESTID.agentStart)}${attr("data-agent", this.nodeId(node))}`).count() > 0, "the node's agent controls to arrive", HYDRATION_TIMEOUT);
  if (await bound.count() > 0 && await bound.getAttribute("data-standing") !== "unbound") {
    await openFold(this, node);
    return;
  }
  const pill = this.node(node).locator(`${selector(PLUGIN_TESTID.agentStart)}${attr("data-agent", this.nodeId(node))}`);
  if (await pill.count()) {
    await this.press(pill);
    const menu = this.page.locator(selector(PLUGIN_TESTID.agentEngineMenu));
    await this.waitUntil(async () => await menu.isVisible() || await fold(this, node).isVisible(), "a choice or the new conversation", HYDRATION_TIMEOUT);
    if (await menu.isVisible()) await menu.getByRole("menuitem", { name: new RegExp(engine, "i") }).click();
  } else {
    const trigger = this.within(node, NODE_MENU);
    if (await trigger.isVisible()) await trigger.click({ force: true });
    else await this.hold(this.node(node));
    const menu = this.page.locator(NODE_MENU_PANEL);
    await menu.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const choices = menu.locator(NODE_MENU_ITEM).filter({ hasText: "Start an agent session" });
    if (await choices.count() === 1) await choices.click();
    else await choices.filter({ hasText: new RegExp(engine, "i") }).click();
  }
  await fold(this, node).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});
When("I unfold node agent {string}", async function(this: OlaiWorld, node: string) { await openFold(this, node); });
When("I use the fold on node {string}", async function(this: OlaiWorld, node: string) {
  await fold(this, node).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  this.activeAgent = node;
});
Then("node agent {string} is folded", async function(this: OlaiWorld, node: string) {
  await fold(this, node).waitFor({ state: "detached", timeout: POLL_TIMEOUT });
});
Then("no agent fold is open", async function(this: OlaiWorld) {
  await this.waitUntil(async () => await this.page.locator(selector(PLUGIN_TESTID.agentFold)).count() === 0, "all conversation folds to be disposed");
});
Then("the fold on {string} holds its transcript and composer", async function(this: OlaiWorld, node: string) {
  const owned = fold(this, node);
  await owned.locator(CHAT_INPUT).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  assert.equal(await owned.locator(CHAT_TRANSCRIPT).count(), 1);
  assert.equal(await owned.locator(CHAT_PANEL).count(), 1);
  assert.ok(await owned.evaluate((el, id) => el.closest('[data-testid="node"]')?.getAttribute("data-node-id") === id, this.nodeId(node)));
});

When("I point at row {string} in outline {string}", async function(this: OlaiWorld, node: string, file: string) {
  await this.node(node).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  assert.equal(await this.node(node).getAttribute("data-file"), file);
  await this.focusWithin(node, NODE_MENU);
  await this.waitUntil(async () => await this.node(node).getAttribute("data-focused") === "true", "the permalink to focus its row");
});
Then("the palette refuses with {string} and retains {string}", async function(this: OlaiWorld, message: string, input: string) {
  const error = this.page.locator(selector(PLUGIN_TESTID.paletteAskError));
  await this.waitUntil(async () => (await error.textContent()) === message, "the palette's refusal");
  assert.equal(await this.page.locator(selector(PLUGIN_TESTID.paletteInput)).inputValue(), input);
});


When("I press the standing on outline record {string}", async function(this: OlaiWorld, record: string) {
  await this.node(record).locator(selector(PLUGIN_TESTID.agentStanding)).click()
})
Then("only outline record {string} has an agent fold", async function(this: OlaiWorld, record: string) {
  assert.equal(await this.page.locator(selector(PLUGIN_TESTID.agentFold)).count(), 1)
  assert.equal(await this.node(record).locator(selector(PLUGIN_TESTID.agentFold)).count(), 1)
})
Then("both outline records {string} and {string} have an agent fold", async function(this: OlaiWorld, one: string, two: string) {
  for (const record of [one, two]) await this.node(record).locator(selector(PLUGIN_TESTID.agentFold)).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
  assert.equal(await this.page.locator(selector(PLUGIN_TESTID.agentFold)).count(), 2)
})
