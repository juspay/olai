/**
 * Split panes: open, close, focus, deterministic links, URL restore,
 * collapse, the narrow tab strip.
 *
 * Selectors come from the client's testids, same as every other step
 * file. A pane is found by `data-pane` (its index) and asserted by
 * `data-pane-focused` / `data-href` — facts, never a colour.
 */

import * as assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";

import { attr } from "../support/selectors.ts";
import {
  nodeSelector,
  PANE,
  PANE_CLOSE,
  PANE_HEADER,
  PANE_RAIL,
  PANE_RESIZE,
  PANE_TAB,
  PANE_TABS,
  POLL_TIMEOUT,
  ZOOM,
  ZOOM_TITLE,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

const paneAt = (world: OlaiWorld, index: number) => world.pane(index);

When(
  "I alt-click the zoom of {string}",
  async function (this: OlaiWorld, id: string) {
    const zoom = this.within(id, ZOOM);
    await zoom.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await zoom.click({ modifiers: ["Alt"] });
    await this.waitForFrame();
  },
);

When(
  "I alt-shift-click the zoom of {string}",
  async function (this: OlaiWorld, id: string) {
    const zoom = this.within(id, ZOOM);
    await zoom.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await zoom.click({ modifiers: ["Alt", "Shift"] });
    await this.waitForFrame();
  },
);

When(
  "I alt-click the zoom of {string} in pane {int}",
  async function (this: OlaiWorld, id: string, index: number) {
    const zoom = paneAt(this, index).locator(`${nodeSelector(id)} ${ZOOM}`).first();
    await zoom.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await zoom.click({ modifiers: ["Alt"] });
    await this.waitForFrame();
  },
);

When(
  "I zoom into the node {string} in pane {int}",
  async function (this: OlaiWorld, id: string, index: number) {
    const zoom = paneAt(this, index).locator(`${nodeSelector(id)} ${ZOOM}`).first();
    await zoom.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await zoom.click();
    await this.waitForFrame();
  },
);

When("I focus pane {int}", async function (this: OlaiWorld, index: number) {
  const pane = paneAt(this, index);
  await pane.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await pane.click({ position: { x: 8, y: 8 } });
  await this.waitForFrame();
});

When("I close the focused pane", async function (this: OlaiWorld) {
  const close = this.page.locator(`${PANE_HEADER}[data-pane-focused="true"] ${PANE_CLOSE}`);
  await close.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await close.click();
  await this.waitForFrame();
});

When("I press Alt+Right", async function (this: OlaiWorld) {
  await this.page.keyboard.press("Alt+ArrowRight");
  await this.waitForFrame();
});

When("I open the address {string}", async function (this: OlaiWorld, address: string) {
  await this.open(address);
});

When(
  "I collapse pane {int} by dragging its divider",
  async function (this: OlaiWorld, index: number) {
    const handle = this.page.locator(
      `${PANE_RESIZE}${attr("data-left", String(index))}, ${PANE_RESIZE}${attr("data-right", String(index))}`,
    ).first();
    await handle.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const box = await handle.boundingBox();
    assert.ok(box !== null, "the divider has no box");
    // The handle sits between two panes. To shrink THIS one, drag toward
    // the neighbour: leftward if we are the left pane, rightward if we
    // are the right.
    const isLeft = (await handle.getAttribute("data-left")) === String(index);
    const dx = isLeft ? -800 : 800;
    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await this.page.mouse.down();
    await this.page.mouse.move(
      box.x + box.width / 2 + dx,
      box.y + box.height / 2,
      { steps: 8 },
    );
    await this.page.mouse.up();
    await this.waitForFrame();
  },
);

When("I expand the pane rail {int}", async function (this: OlaiWorld, index: number) {
  const rail = this.page.locator(`${PANE_RAIL}${attr("data-pane", String(index))}`);
  await rail.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await rail.click();
  await this.waitForFrame();
});

When("I shrink the window to a phone", async function (this: OlaiWorld) {
  await this.page.setViewportSize({ width: 390, height: 844 });
  await this.waitForFrame();
});

When("I tap pane tab {int}", async function (this: OlaiWorld, index: number) {
  const tab = this.page.locator(`${PANE_TAB}${attr("data-pane", String(index))}`);
  await tab.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await tab.click();
  await this.waitForFrame();
});

When("I close the focused pane from the keyboard", async function (this: OlaiWorld) {
  // The header's × is desktop chrome. On a phone the same verb is the
  // chord, and it is the one that must not throw after a tab switch.
  //
  // `ControlOrMeta`, which is Playwright's own spelling of the platform's
  // modifier and the same split `keys.ts` makes — Meta on Apple, Control
  // elsewhere. Spelled `Control` here, this step pressed a chord macOS never
  // matches: the pane simply did not close, and the assertion after it read
  // the pane that was still there. Linux never noticed, because there the two
  // are the same key.
  await this.page.keyboard.press("ControlOrMeta+Shift+w");
  await this.waitForFrame();
});

When(
  "I press Alt+Right without the page claiming it",
  async function (this: OlaiWorld) {
    await this.page.evaluate(() => {
      const onKey = (event: KeyboardEvent) => {
        if (event.key !== "ArrowRight" || !event.altKey) return;
        window.removeEventListener("keydown", onKey);
        (window as unknown as { __claimed?: boolean }).__claimed =
          event.defaultPrevented;
      };
      (window as unknown as { __claimed?: boolean }).__claimed = undefined;
      window.addEventListener("keydown", onKey);
    });
    await this.page.keyboard.press("Alt+ArrowRight");
    const claimed = await this.page.evaluate(
      () => (window as unknown as { __claimed?: boolean }).__claimed,
    );
    assert.strictEqual(
      claimed,
      false,
      "Alt+Right was preventDefaulted on a lone page",
    );
    await this.waitForFrame();
  },
);

Then("there are {int} panes", async function (this: OlaiWorld, n: number) {
  await this.waitUntil(
    async () => (await this.page.locator(PANE).count()) === n,
    `${n} panes on screen`,
  );
});

Then("pane {int} is focused", async function (this: OlaiWorld, index: number) {
  await this.expectAttribute(
    `${PANE}${attr("data-pane", String(index))}`,
    "data-pane-focused",
    "true",
    `pane ${index}`,
  );
});

Then(
  "pane {int} is showing {string}",
  async function (this: OlaiWorld, index: number, href: string) {
    await this.expectAttribute(
      `${PANE}${attr("data-pane", String(index))}`,
      "data-href",
      href,
      `pane ${index}`,
    );
  },
);

Then(
  "the zoomed node in pane {int} is {string}",
  async function (this: OlaiWorld, index: number, id: string) {
    const title = paneAt(this, index).locator(ZOOM_TITLE);
    await title.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(await title.getAttribute("data-node-id"), id);
  },
);

Then("a pane rail is shown for pane {int}", async function (this: OlaiWorld, index: number) {
  await this.page
    .locator(`${PANE_RAIL}${attr("data-pane", String(index))}`)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("no pane rail is shown", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator(PANE_RAIL).count()) === 0,
    "no pane rail on screen",
  );
});

Then("the pane tabs are shown", async function (this: OlaiWorld) {
  await this.page.locator(PANE_TABS).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("there are {int} pane tabs", async function (this: OlaiWorld, n: number) {
  await this.waitUntil(
    async () => (await this.page.locator(PANE_TAB).count()) === n,
    `${n} pane tabs`,
  );
});
