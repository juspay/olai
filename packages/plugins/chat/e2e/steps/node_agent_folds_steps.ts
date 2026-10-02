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
  PANE,
  POLL_TIMEOUT,
  HYDRATION_TIMEOUT,
  CHAT_PANEL,
  CHAT_INPUT,
} from "@olai/tests/harness/world.ts";
import {
  CHAT_TRANSCRIPT,
} from "../selectors.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

const fold = (world: OlaiWorld, node: string) => world.frontLane().locator(`${selector(PLUGIN_TESTID.agentFold)}${attr("data-agent", world.nodeId(node))}:visible`);
const standing = (world: OlaiWorld, node: string) => world.node(node).locator(`${selector(PLUGIN_TESTID.agentStanding)}${attr("data-agent", world.nodeId(node))}`);

export const openFold = async (world: OlaiWorld, node: string) => {
  world.activeAgent = node;
  const control = standing(world, node);
  // A new tab can paint its header before its requested outline arrives.
  // Absence during that gap is not a reason to navigate via the sidebar.
  const file = decodeURIComponent(new URL(world.page.url()).pathname).slice(1);
  if (file.endsWith(".olai")) {
    await world.frontLane().locator(`${PANE}${attr("data-drawn-file", file)}`).first()
      .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  }
  // A newly opened browser can draw the outline before its agent property
  // face arrives. Use the sidebar only when the target row is absent.
  if (!(await world.node(node).isVisible())) {
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
  // The pill is an OFFER: on a phone it is in the row but not drawn until the
  // row is tapped, so a phone takes the row menu (a long press) instead.
  if (await pill.count() && await pill.isVisible()) {
    await this.press(pill);
    const menu = this.page.locator(selector(PLUGIN_TESTID.agentEngineMenu));
    await this.waitUntil(async () => await menu.isVisible() || await fold(this, node).isVisible(), "a choice or the new conversation", HYDRATION_TIMEOUT);
    if (await menu.isVisible()) {
      // Scenarios name an engine by id or by its full display name. Neither
      // may substring-match another engine's absence sentence.
      await menu.locator(attr("data-engine", engine))
        .or(menu.getByRole("menuitem", { name: engine, exact: true })).click();
    }
  } else {
    const trigger = this.within(node, NODE_MENU);
    if (await trigger.isVisible()) await trigger.click({ force: true });
    // A phone draws no `•••`: a finger held on the row's OWN line opens its
    // menu — the gutter, as outlines' "I hold a finger on the node" does. The
    // node's whole box is the wrong target: with children, its middle is a
    // child's row, and the menu that opens is the child's.
    else await this.hold(this.within(node, NODE_GUTTER));
    const menu = this.page.locator(NODE_MENU_PANEL);
    await menu.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    // One entry, however many agents: the verb itself with one, a submenu of
    // the agents with several (`data-action` is the bare `chat:start-agent`).
    // Read BEFORE the press: the one-agent entry shuts the menu it is in.
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
When("I unfold node agent {string}", async function(this: OlaiWorld, node: string) { await openFold(this, node); });
When("I use the fold on node {string}", async function(this: OlaiWorld, node: string) {
  await fold(this, node).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  this.activeAgent = node;
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
Then("the palette refuses with {string} and retains {string}", async function(this: OlaiWorld, message: string, input: string) {
  const error = this.page.locator(selector(PLUGIN_TESTID.paletteAskError));
  await this.waitUntil(async () => (await error.textContent()) === message, "the palette's refusal");
  assert.equal(await this.page.locator(selector(PLUGIN_TESTID.paletteInput)).inputValue(), input);
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
