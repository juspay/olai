/**
 * Zoom, permalinks, breadcrumbs and the done-visibility switch.
 *
 * Two things these steps are careful about. A zoomed page is asserted through
 * the heading's `data-node-id`, which is the CANONICAL node's — so "zoom a
 * mirror, land on the node" is one assertion rather than a guess from the
 * title text. And the address is read from the URL bar, because a permalink
 * that is right on screen and wrong in the location bar is not a permalink.
 */

import * as assert from "node:assert";
import { Given, Then, When } from "@cucumber/cucumber";

import {
  DONE_TOGGLE,
  NOT_FOUND,
  oneLine,
  POLL_TIMEOUT,
  ZOOM,
  ZOOM_TITLE,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

// ── zooming ────────────────────────────────────────────────────────────

When(
  "I zoom into the node {string}",
  async function (this: OlaiWorld, id: string) {
    await this.clickWithin(id, ZOOM);
    await this.page
      .locator(ZOOM_TITLE)
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Given("I open the node {string}", async function (this: OlaiWorld, id: string) {
  await this.openNode(id);
});

Then(
  "the zoomed node is {string}",
  async function (this: OlaiWorld, id: string) {
    await this.expectAttribute(
      ZOOM_TITLE,
      "data-node-id",
      id,
      "the zoomed page",
    );
  },
);

Then("the address is {string}", async function (this: OlaiWorld, path: string) {
  // Waited for, not read once: a click navigates and re-renders in the same
  // frame, and reading the URL immediately races the pushState that produced
  // the page being looked at.
  await this.page
    .waitForURL((url) => url.pathname === path, { timeout: POLL_TIMEOUT })
    .catch(() => undefined);
  assert.strictEqual(this.pathname(), path);
});

// ── breadcrumbs ────────────────────────────────────────────────────────

/** The trail, crumb by crumb, in order. Asserting the whole list rather than
 *  "contains X" is the point: crumbs are an ANCESTRY, and one in the wrong
 *  place — or an extra one picked up from the route that was clicked — is
 *  exactly the bug. */
Then(
  "the breadcrumbs are {string}",
  async function (this: OlaiWorld, expected: string) {
    const trail = this.crumbs();
    await trail
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT })
      .catch(() => undefined);
    assert.deepStrictEqual(
      (await trail.allInnerTexts()).map(oneLine),
      expected.split(",").map((crumb) => crumb.trim()),
    );
  },
);

When(
  "I follow the breadcrumb {string}",
  async function (this: OlaiWorld, label: string) {
    const crumb = this.crumbs().filter({ hasText: label }).first();
    await crumb.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await crumb.click();
    await this.waitForFrame();
  },
);

// ── the done-visibility switch ─────────────────────────────────────────

/** Put the switch where the scenario wants it, clicking only if it is not
 *  already there. Idempotent so the two sentences below can each be read as a
 *  statement of intent rather than as "press the button once". */
const setDoneHidden = async (
  world: OlaiWorld,
  hidden: boolean,
): Promise<void> => {
  const toggle = world.page.locator(DONE_TOGGLE).first();
  await toggle.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  if ((await toggle.getAttribute("data-hidden")) !== String(hidden)) {
    await toggle.click();
  }
  await world.expectAttribute(
    DONE_TOGGLE,
    "data-hidden",
    String(hidden),
    "the done switch",
  );
  await world.waitForFrame();
};

When("I hide the done nodes", async function (this: OlaiWorld) {
  await setDoneHidden(this, true);
});

When("I show the done nodes", async function (this: OlaiWorld) {
  await setDoneHidden(this, false);
});

// ── a permalink that names nothing ─────────────────────────────────────

Then("a not-found is shown", async function (this: OlaiWorld) {
  await this.page
    .locator(NOT_FOUND)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});
