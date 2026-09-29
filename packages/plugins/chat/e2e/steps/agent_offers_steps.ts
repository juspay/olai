/**
 * WHERE CHAT OFFERS AN AGENT, and what it offers when there is none.
 *
 * The agent menu (`../../src/browser/agents/EngineMenu.tsx`) lists only the
 * agents this machine can start; with none it says so in one line and — while
 * the plugin inspector is up — offers the plugins panel. The start pill is an
 * offer and the standing is a fact, which is what the phone steps below tell
 * apart: an offer waits for the tapped row, a fact is always drawn.
 */
import assert from "node:assert/strict";
import { Then, When } from "@olai/tests/harness/runner.ts";
import { PLUGIN_TESTID } from "@olai/tests/harness/testids.ts";
import { selector } from "@olai/web/testlib";
import { attr, oneLine, POLL_TIMEOUT } from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

const MENU = selector(PLUGIN_TESTID.agentEngineMenu);
const NONE = selector(PLUGIN_TESTID.agentEngineNone);
const OPEN_PLUGINS = `${MENU} [data-action="open-plugins"]`;

const menu = async (world: OlaiWorld) => {
  const shown = world.page.locator(MENU);
  await shown.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  return shown;
};

Then("the agent menu offers exactly {string}", async function (this: OlaiWorld, names: string) {
  const shown = await menu(this);
  const want = names.split("|");
  await this.waitUntil(async () =>
    JSON.stringify((await shown.getByRole("menuitem").allInnerTexts()).map(oneLine)) === JSON.stringify(want),
  `the agent menu to offer ${names}`);
  // Only what works: an agent this machine lacks is not a row here.
  assert.equal(await shown.locator(selector(PLUGIN_TESTID.agentEngineMissing)).count(), 0);
  assert.equal(await shown.locator(NONE).count(), 0);
});

Then("the agent menu says no agent is set up", async function (this: OlaiWorld) {
  const shown = await menu(this);
  await shown.locator(NONE).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  assert.equal(oneLine(await shown.locator(NONE).innerText()), "No agent is set up");
  assert.equal(await shown.locator("[data-engine]").count(), 0, "no agent is listed");
});

Then("the agent menu offers to open plugins", async function (this: OlaiWorld) {
  await (await menu(this)).locator('[data-action="open-plugins"]').waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("the agent menu does not offer to open plugins", async function (this: OlaiWorld) {
  await menu(this);
  await this.waitForFrame();
  assert.equal(await this.page.locator(OPEN_PLUGINS).count(), 0);
});

When("I choose Open plugins in the agent menu", async function (this: OlaiWorld) {
  await this.press(this.page.locator(OPEN_PLUGINS));
});

Then("the agent menu is shut", async function (this: OlaiWorld) {
  await this.page.locator(MENU).waitFor({ state: "detached", timeout: POLL_TIMEOUT });
});

Then("the plugins panel is open", async function (this: OlaiWorld) {
  await this.pluginsPanel().waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

const startPill = (world: OlaiWorld, node: string) =>
  world.page.locator(`${selector(PLUGIN_TESTID.agentStart)}${attr("data-agent", world.nodeId(node))}`);
const standingOf = (world: OlaiWorld, node: string) =>
  world.page.locator(`${selector(PLUGIN_TESTID.agentStanding)}${attr("data-agent", world.nodeId(node))}`);

/** The offer is in the row but not drawn: a phone's row nobody has tapped
 *  keeps it `display: none` (`OFFER_REVEAL`), which is not the same claim as
 *  there being no offer at all. */
Then("the agent start pill on {string} is not shown", async function (this: OlaiWorld, node: string) {
  await this.waitUntil(async () => await startPill(this, node).count() === 1, `the start offer on ${node} to be in its row`);
  await this.waitUntil(async () => !(await startPill(this, node).isVisible()), `the start offer on ${node} to be hidden`);
});

Then("the agent standing on {string} is shown", async function (this: OlaiWorld, node: string) {
  await standingOf(this, node).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("no agent control is drawn anywhere", async function (this: OlaiWorld) {
  for (const id of [PLUGIN_TESTID.chatNew, PLUGIN_TESTID.agentStart, PLUGIN_TESTID.agentStanding, PLUGIN_TESTID.agentFold, PLUGIN_TESTID.agentRoster]) {
    await this.waitUntil(async () => await this.page.locator(selector(id)).count() === 0, `every ${id} to be withdrawn`);
  }
});

Then("agent controls are drawn again", async function (this: OlaiWorld) {
  await this.showSidebar();
  await this.page.locator(selector(PLUGIN_TESTID.chatNew)).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.page.locator(selector(PLUGIN_TESTID.agentStart)).first().waitFor({ state: "attached", timeout: POLL_TIMEOUT });
});
