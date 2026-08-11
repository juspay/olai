/**
 * Panel rework: rail, resize handles, pill, palette, drawer, bottom sheet.
 */

import * as assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";

import {
  CHAT_PANEL,
  CHAT_PILL,
  CHAT_RESIZE,
  CHAT_SHEET,
  CHAT_SHEET_HANDLE,
  CHAT_SHEET_SCRIM,
  CHAT_STRIP,
  CHAT_TOGGLE,
  HYDRATION_TIMEOUT,
  OUTLINE_TREE,
  PALETTE,
  PALETTE_ITEM,
  POLL_TIMEOUT,
  SIDEBAR,
  SIDEBAR_BODY,
  SIDEBAR_COLLAPSE,
  SIDEBAR_EXPAND,
  SIDEBAR_RAIL,
  SIDEBAR_RESIZE,
  SIDEBAR_SCRIM,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

// ── desktop sidebar ────────────────────────────────────────────────────

Then("the sidebar is open on desktop", async function (this: OlaiWorld) {
  await this.page
    .locator(SIDEBAR_BODY)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.strictEqual(
    await this.page.locator(SIDEBAR_RAIL).isVisible(),
    false,
    "the icon rail is showing while the full sidebar should be open",
  );
});

When("I collapse the sidebar", async function (this: OlaiWorld) {
  await this.page.locator(SIDEBAR_COLLAPSE).click();
  await this.page
    .locator(SIDEBAR_RAIL)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("the sidebar rail is showing", async function (this: OlaiWorld) {
  await this.page
    .locator(SIDEBAR_RAIL)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.strictEqual(
    await this.page.locator(SIDEBAR_BODY).isVisible(),
    false,
    "the full sidebar body is still visible beside the rail",
  );
});

Then(
  "the outline {string} is still on screen",
  async function (this: OlaiWorld, _file: string) {
    await this.page
      .locator(OUTLINE_TREE)
      .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  },
);

When("I expand the sidebar from the rail", async function (this: OlaiWorld) {
  await this.page.locator(SIDEBAR_EXPAND).click();
  await this.page
    .locator(SIDEBAR_BODY)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("the sidebar has a resize handle", async function (this: OlaiWorld) {
  await this.page
    .locator(SIDEBAR_RESIZE)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

Then("the agent panel has a resize handle", async function (this: OlaiWorld) {
  await this.page
    .locator(CHAT_RESIZE)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

// ── chat minimize / pill / strip ───────────────────────────────────────

When("I minimize the agent panel", async function (this: OlaiWorld) {
  const toggle = this.page.locator(CHAT_TOGGLE);
  await toggle.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  if (await this.page.locator(CHAT_PANEL).isVisible()) {
    await toggle.click();
  }
  await this.page
    .locator(CHAT_PANEL)
    .waitFor({ state: "hidden", timeout: POLL_TIMEOUT });
});

Then("the agent panel is minimized", async function (this: OlaiWorld) {
  assert.strictEqual(
    await this.page.locator(CHAT_PANEL).isVisible(),
    false,
    "the agent panel is still open — minimize should leave only the pill/strip",
  );
});

Then("the chat pill is showing", async function (this: OlaiWorld) {
  await this.page
    .locator(CHAT_PILL)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

Then("the chat strip is showing", async function (this: OlaiWorld) {
  await this.page
    .locator(CHAT_STRIP)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

When("I open the agent from the pill", async function (this: OlaiWorld) {
  await this.page.locator(CHAT_PILL).click();
  await this.page
    .locator(CHAT_PANEL)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

// ── palette + keyboard ─────────────────────────────────────────────────

When("I press the palette shortcut", async function (this: OlaiWorld) {
  await this.page.keyboard.press("Control+k");
  await this.page
    .locator(PALETTE)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

When("I press the sidebar shortcut", async function (this: OlaiWorld) {
  await this.page.keyboard.press("Control+\\");
  await this.waitForFrame();
});

When("I press the chat shortcut", async function (this: OlaiWorld) {
  await this.page.keyboard.press("Control+j");
  await this.waitForFrame();
});

Then("the command palette is open", async function (this: OlaiWorld) {
  await this.page
    .locator(PALETTE)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

When(
  "I pick the palette item {string}",
  async function (this: OlaiWorld, label: string) {
    const item = this.page.locator(PALETTE_ITEM).filter({ hasText: label });
    await item.click();
    await this.page
      .locator(PALETTE)
      .waitFor({ state: "hidden", timeout: POLL_TIMEOUT });
  },
);

// ── mobile drawer + sheet ──────────────────────────────────────────────

Then(
  "the directory drawer is open with a scrim",
  async function (this: OlaiWorld) {
    await this.page
      .locator(SIDEBAR_BODY)
      .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    await this.page
      .locator(SIDEBAR_SCRIM)
      .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    assert.strictEqual(
      await this.page.locator(SIDEBAR).getAttribute("data-open"),
      "true",
    );
  },
);

When("I tap the directory scrim", async function (this: OlaiWorld) {
  // The scrim is full-viewport under the drawer; a centre tap lands on the
  // drawer itself. Aim at the uncovered right edge.
  const viewport = this.page.viewportSize();
  assert.ok(viewport !== null, "this scenario has no viewport size");
  await this.page.locator(SIDEBAR_SCRIM).click({
    position: { x: viewport.width - 8, y: Math.round(viewport.height / 2) },
  });
  await this.page
    .locator(SIDEBAR_BODY)
    .waitFor({ state: "hidden", timeout: POLL_TIMEOUT });
});

Then(
  "the chat sheet is at snap {string}",
  async function (this: OlaiWorld, snap: string) {
    await this.expectAttribute(
      CHAT_PANEL,
      "data-snap",
      snap,
      "the chat sheet snap",
      POLL_TIMEOUT,
    );
  },
);

When("I tap the chat sheet handle", async function (this: OlaiWorld) {
  await this.press(this.page.locator(CHAT_SHEET_HANDLE), "tap");
  await this.waitForFrame();
});

When("I tap the chat sheet scrim", async function (this: OlaiWorld) {
  // Scrim is full-viewport under the sheet; centre may land on the sheet.
  // Tap the top band that stays clear at both half and full snaps.
  const viewport = this.page.viewportSize();
  assert.ok(viewport !== null, "this scenario has no viewport size");
  await this.page.locator(CHAT_SHEET_SCRIM).click({
    position: { x: Math.round(viewport.width / 2), y: 24 },
  });
  await this.page
    .locator(CHAT_PANEL)
    .waitFor({ state: "hidden", timeout: POLL_TIMEOUT });
});

// silence unused import when tree-shaken oddly
void CHAT_SHEET;
