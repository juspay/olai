import assert from "node:assert/strict";
import { Given, Then, When } from "@olai/tests/harness/runner.ts";
import { PLUGIN_TESTID } from "@olai/tests/harness/testids.ts";
import { selector } from "@olai/web/testlib";
import {
  attr,
  NODE_GUTTER,
  NODE_MENU,
  NODE_MENU_ITEM,
  NODE_MENU_PANEL,
  POLL_TIMEOUT,
  HYDRATION_TIMEOUT,
  CHAT_PANEL,
  CHAT_INPUT,
  PANE,
  ZOOM_TITLE,
} from "@olai/tests/harness/world.ts";
import {
  CHAT_TRANSCRIPT,
} from "../selectors.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";
import type { Locator } from "@olai/tests/harness/playwright.ts";

const fold = (world: OlaiWorld, node: string) => world.frontLane().locator(`${selector(PLUGIN_TESTID.agentFold)}${attr("data-agent", world.nodeId(node))}:visible`);
const standing = (world: OlaiWorld, node: string) => world.node(node).locator(`${selector(PLUGIN_TESTID.agentStanding)}${attr("data-agent", world.nodeId(node))}`);

const chatPageOf = (world: OlaiWorld, node: string) =>
  world.frontLane().locator(`${selector(PLUGIN_TESTID.chatPage)}${attr("data-item", world.nodeId(node))}`);

export const onConversationPage = async (world: OlaiWorld, node: string) =>
  (await world.page.locator(`${ZOOM_TITLE}${attr("data-node-id", world.nodeId(node))}`).count()) > 0
  || (await chatPageOf(world, node).count()) > 0;

const fileBehind = async (world: OlaiWorld, node: string): Promise<string | null> => {
  const page = chatPageOf(world, node);
  if (await page.count() > 0) return (await page.locator(selector(PLUGIN_TESTID.chatPageWhere)).innerText()).trim();
  return await world.frontLane().locator(`${PANE}[data-pane-focused="true"]`).first().getAttribute("data-drawn-file");
};

export const returnToOutline = async (world: OlaiWorld, node: string) => {
  if (!(await onConversationPage(world, node))) return;
  const file = await fileBehind(world, node);
  assert.ok(file, `the page in front says nothing about where ${node} is`);
  if (await world.crumbs().getByText(file, { exact: true }).count() > 0) {
    await world.crumbs().getByText(file, { exact: true }).first().click();
  } else {
    await world.showSidebar();
    const link = world.outlineLink(file);
    await link.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await link.click();
  }
  await world.waitForFrame();
  const control = standing(world, node);
  await control.waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
  if (await control.getAttribute("aria-expanded") === "true") {
    const box = world.page.locator(`${selector(PLUGIN_TESTID.agentFold)}${attr("data-agent", world.nodeId(node))}`);
    await box.waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
    await world.waitUntil(async () => {
      const before = await box.boundingBox();
      await world.waitForFrame();
      const after = await box.boundingBox();
      return before !== null && after !== null
        && before.x === after.x && before.y === after.y
        && before.width === after.width && before.height === after.height;
    }, `the fold of ${node} to hold still`, HYDRATION_TIMEOUT);
  }
};

export const openRowInOutline = async (world: OlaiWorld, row: Locator, node: string) => {
  await world.showSidebar();
  await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await world.press(row);
  await world.waitUntil(() => onConversationPage(world, node),
    `the conversation's own page for ${node}`, POLL_TIMEOUT);
  await returnToOutline(world, node);
};

export const openAgentRowInOutline = (world: OlaiWorld, node: string) =>
  openRowInOutline(world, world.page.locator(`${selector(PLUGIN_TESTID.agentRoster)} ${selector(PLUGIN_TESTID.agentRow)}${attr("data-agent", world.nodeId(node))}`), node);

export const openFold = async (world: OlaiWorld, node: string) => {
  world.activeAgent = node;
  if (!(await world.node(node).isVisible())) await openAgentRowInOutline(world, node);
  const control = standing(world, node);
  await control.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  if (await control.getAttribute("aria-expanded") !== "true") await world.press(control);
  await fold(world, node).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
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
  if (await pill.count() && await pill.isVisible()) {
    await this.press(pill);
    const menu = this.page.locator(selector(PLUGIN_TESTID.agentEngineMenu));
    await this.waitUntil(async () => await menu.isVisible() || await fold(this, node).isVisible(), "a choice or the new conversation", HYDRATION_TIMEOUT);
    if (await menu.isVisible()) {
      await menu.locator(attr("data-engine", engine))
        .or(menu.getByRole("menuitem", { name: engine, exact: true })).click();
    }
  } else {
    const trigger = this.within(node, NODE_MENU);
    if (await trigger.isVisible()) await trigger.click({ force: true });
    else await this.hold(this.within(node, NODE_GUTTER));
    const menu = this.page.locator(NODE_MENU_PANEL);
    await menu.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const start = menu.locator(`${NODE_MENU_ITEM}${attr("data-action", "chat:start-agent", "^=")}`);
    await start.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const opens = await start.getAttribute("data-action") === "chat:start-agent";
    await start.click();
    if (opens) {
      const sub = this.page.locator(`${selector(PLUGIN_TESTID.nodeMenuSub)}${attr("data-sub", "chat:start-agent")}`);
      await sub.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
      await sub.locator(attr("data-action", `chat:start-agent-${engine}`))
        .or(sub.getByRole("menuitem", { name: engine, exact: true })).click();
    }
  }
  await fold(this, node).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});
When("I unfold node agent {string}", async function(this: OlaiWorld, node: string) {
  await returnToOutline(this, node);
  await openFold(this, node);
});
When("I use the fold on node {string}", async function(this: OlaiWorld, node: string) {
  await returnToOutline(this, node);
  await fold(this, node).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  this.activeAgent = node;
});
When("I return to the conversation's outline", async function(this: OlaiWorld) {
  assert.ok(this.activeAgent, "open a named node agent first");
  await returnToOutline(this, this.activeAgent);
});
Then("the history picker on {string} is still open", async function(this: OlaiWorld, node: string) {
  const fold = this.page.locator(`${selector(PLUGIN_TESTID.agentFold)}${attr("data-agent", this.nodeId(node))}`);
  const trigger = fold.locator('[data-testid="chat-sessions"]');
  await trigger.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  assert.equal(await trigger.getAttribute("aria-expanded"), "true", "the history picker shut under a roster frame");
  await fold.locator('[data-testid="chat-session-list"]').waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});
Then("node agent {string} is folded", async function(this: OlaiWorld, node: string) {
  await fold(this, node).waitFor({ state: "hidden", timeout: POLL_TIMEOUT });
});
Then("no agent fold is open", async function(this: OlaiWorld) {
  await this.waitUntil(async () => await this.frontLane().locator(`${selector(PLUGIN_TESTID.agentFold)}:visible`).count() === 0, "all conversation folds to be hidden");
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
When("I press the standing on outline record {string}", async function(this: OlaiWorld, record: string) {
  await this.node(record).locator(selector(PLUGIN_TESTID.agentStanding)).click()
})
Then("only outline record {string} has an agent fold", async function(this: OlaiWorld, record: string) {
  assert.equal(await this.frontLane().locator(`${selector(PLUGIN_TESTID.agentFold)}:visible`).count(), 1)
  assert.equal(await this.node(record).locator(selector(PLUGIN_TESTID.agentFold)).count(), 1)
})
Then("both outline records {string} and {string} have an agent fold", async function(this: OlaiWorld, one: string, two: string) {
  for (const record of [one, two]) await this.node(record).locator(selector(PLUGIN_TESTID.agentFold)).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
  assert.equal(await this.frontLane().locator(`${selector(PLUGIN_TESTID.agentFold)}:visible`).count(), 2)
})
