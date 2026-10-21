/**
 * THE AGENT PANEL — the dock beside the page (`../../src/browser/dock.ts`),
 * and every door that opens it.
 *
 * The conversation inside it is addressed by the ordinary chat steps: the
 * harness's `chat()` looks in the dock as well as in the front lane
 * (`support/world.ts`'s `chatHosts`), so "I ask the agent" and "the chat
 * shows my message" say the same thing whether the scenario put the
 * conversation under a row or in the column. What is HERE is the column
 * itself — opening it, what it names, shutting it, its width — which no other
 * surface has.
 */

import * as assert from "node:assert";
import { Then, When } from "@olai/tests/harness/runner.ts";

import { selector } from "@olai/web/testlib";
import { pressed } from "@olai/tests/harness/settling.ts";
import {
  attr,
  CHAT_DOCK,
  CHAT_PANEL,
  CHAT_TOGGLE,
  HYDRATION_TIMEOUT,
  PANEL_COLUMN,
  PANEL_RESIZE,
  POLL_TIMEOUT,
  ZOOM_TITLE,
} from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

import { TESTID } from "../../src/testids.ts";

const ROW = selector(TESTID.agentRow);
const OPEN = selector(TESTID.chatDockOpen);
const TITLE = selector(TESTID.chatDockTitle);
const CLOSE = selector(TESTID.chatDockClose);
const SWITCH = selector(TESTID.chatDockSwitch);
const MENU = selector(TESTID.chatDockMenu);
const PICK = selector(TESTID.chatDockPick);
const PICKER = selector(TESTID.chatDockPicker);
const HERE = selector(TESTID.chatDockHere);


/** The dock, carrying the node it shows. */
const dockOf = (world: OlaiWorld, node: string) =>
  world.page.locator(`${CHAT_DOCK}${attr("data-agent", world.nodeId(node))}`);

/** The Chats row's door, revealed on hover: the row is hovered first so the
 *  press lands on a control a person could see. */
When("I open the agent {string} in the panel", async function (this: OlaiWorld, node: string) {
  await this.showSidebar();
  const row = this.page.locator(`${ROW}${attr("data-agent", this.nodeId(node))}`);
  await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await row.hover();
  const door = this.page.locator(`${OPEN}${attr("data-agent", this.nodeId(node))}`);
  await door.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await door.click();
  this.activeAgent = node;
  await dockOf(this, node).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("the agent panel shows {string}", async function (this: OlaiWorld, node: string) {
  const dock = dockOf(this, node);
  await dock.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const title = dock.locator(TITLE);
  await title.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  // The column is beside the reading, not over it: the seat's own host is
  // what the shell drew, and the dock fills it.
  const column = this.page.locator(PANEL_COLUMN);
  await column.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  assert.equal(await column.getAttribute("data-layout"), "dock");
});

/** The docked conversation has opened: its root carries the cell's state,
 *  and the ordinary chat steps can address it from here on. */
Then("the agent panel's conversation is ready", async function (this: OlaiWorld) {
  assert.ok(this.activeAgent, "open a conversation in the panel first");
  const panel = this.page.locator(`${CHAT_DOCK} ${CHAT_PANEL}[data-drawn="dock"]`);
  await panel.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () => {
    const status = await panel.getAttribute("data-status");
    return status === "idle" || status === "thinking";
  }, "the docked conversation to settle", HYDRATION_TIMEOUT);
});

Then("the agent panel is hidden", async function (this: OlaiWorld) {
  await this.page.locator(CHAT_DOCK).waitFor({ state: "hidden", timeout: POLL_TIMEOUT });
  assert.equal(await this.page.locator(PANEL_COLUMN).count(), 0, "the seat's column is still drawn");
});

Then("the agent panel is absent on this phone", async function (this: OlaiWorld) {
  await this.showSidebar();
  await this.page.locator(ROW).first().waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.equal(await this.page.locator(CHAT_DOCK).count(), 0, "a phone drew the dock");
  assert.equal(await this.page.locator(CHAT_TOGGLE).count(), 0, "a phone drew the panel toggle");
  assert.equal(await this.page.locator(OPEN).count(), 0, "a phone drew a Chats row's panel door");
});

Then("the agent panel offers a conversation to open", async function (this: OlaiWorld) {
  const picker = this.page.locator(`${CHAT_DOCK} ${PICKER}`);
  await picker.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await picker.locator(PICK).first().waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

When("I pick {string} from the agent panel", async function (this: OlaiWorld, node: string) {
  await this.page.locator(`${CHAT_DOCK} ${PICKER} ${PICK}${attr("data-agent", this.nodeId(node))}`).click();
  this.activeAgent = node;
});

When("I switch the agent panel to {string}", async function (this: OlaiWorld, node: string) {
  await this.page.locator(`${CHAT_DOCK} ${SWITCH}`).click();
  const menu = this.page.locator(`${CHAT_DOCK} ${MENU}`);
  await menu.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await menu.locator(`${PICK}${attr("data-agent", this.nodeId(node))}`).click();
  this.activeAgent = node;
});

When("I close the agent panel", async function (this: OlaiWorld) {
  await this.page.locator(`${CHAT_DOCK} ${CLOSE}`).click();
});

When("I press the agent panel toggle", async function (this: OlaiWorld) {
  const toggle = this.page.locator(CHAT_TOGGLE);
  await toggle.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await toggle.click();
});

Then("the agent panel toggle is pressed", async function (this: OlaiWorld) {
  await this.expectChromeAttribute(CHAT_TOGGLE, "aria-pressed", "true", "the agent panel toggle");
});

Then("the agent panel toggle is not pressed", async function (this: OlaiWorld) {
  await this.expectChromeAttribute(CHAT_TOGGLE, "aria-pressed", "false", "the agent panel toggle");
});

When("I press the agent panel chord", async function (this: OlaiWorld) {
  await pressed(this, "ControlOrMeta+j");
});

/** The agent line's door — on the fold the scenario opened, which is the one
 *  the harness's `chatLine()` addresses. */
When("I open this conversation in the panel from its agent line", async function (this: OlaiWorld) {
  const door = this.chatLine().locator(HERE).first();
  await door.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await door.click();
});

When("I press the agent panel's title", async function (this: OlaiWorld) {
  await this.page.locator(`${CHAT_DOCK} ${TITLE}`).click();
});

Then("the page is the agent {string}", async function (this: OlaiWorld, node: string) {
  await this.frontLane()
    .locator(`${ZOOM_TITLE}${attr("data-node-id", this.nodeId(node))}`)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("the page is still the outline {string}", async function (this: OlaiWorld, file: string) {
  await this.frontLane()
    .locator(`[data-testid="pane"]${attr("data-drawn-file", file)}`)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

// ── the width ───────────────────────────────────────────────────────────

const widthOf = async (world: OlaiWorld): Promise<number> =>
  (await world.box(world.page.locator(PANEL_COLUMN), "the panel column")).width;

When("I drag the agent panel wider by {int}px", async function (this: OlaiWorld, px: number) {
  const handle = this.page.locator(PANEL_RESIZE);
  await handle.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  this.panelWidthBefore = await widthOf(this);
  const box = await this.box(handle, "the panel's handle");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await this.page.mouse.move(x, y);
  await this.page.mouse.down();
  // The handle is on the column's LEFT edge: wider is leftward.
  await this.page.mouse.move(x - px, y, { steps: 8 });
  await this.page.mouse.up();
  await this.waitForFrame();
});

Then("the agent panel has grown by {int}px", async function (this: OlaiWorld, px: number) {
  const before = this.panelWidthBefore;
  assert.ok(before !== undefined, "nothing measured the panel before the drag");
  await this.waitUntil(async () => Math.abs((await widthOf(this)) - (before + px)) <= 2, "the panel to reach its dragged width");
});
