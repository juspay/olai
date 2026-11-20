import * as assert from "node:assert";
import { Given, Then, When } from "@olai/tests/harness/runner.ts";

import { PHONE_WIDTH, SHORT_PHONE_HEIGHT } from "@olai/tests/harness/hooks.ts";

import {
  APP_HEADER,
  CHAT_INPUT,
  CHAT_PANEL,
  COMMIT_PILL,
  CONNECTION,
  HEALTH,
  HEADER_SEARCH_OPEN,
  PADI_PILL,
  SPACES_PILL,
  NODE_GUTTER,
  NODE_TITLE,
  OUTLINE_LIST,
  OUTLINE_TREE,
  PREFS_TRIGGER,
  SIDEBAR_BODY,
  SIDEBAR_TOGGLE,
  TOGGLE,
  UPTIME,
  ZOOM,
} from "@olai/tests/harness/world.ts";
import { HYDRATION_TIMEOUT, POLL_TIMEOUT } from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

When("I tap the bullet of {string}", async function (this: OlaiWorld, id: string) {
  await this.press(this.within(id, ZOOM), "tap");
});

When("I tap the toggle of {string}", async function (this: OlaiWorld, id: string) {
  await this.press(this.within(id, TOGGLE), "tap");
});

When("I flick the node {string} up the screen", async function (this: OlaiWorld, id: string) {
  await this.flick(this.within(id, NODE_GUTTER));
});

When("I flick the bullet of {string} up the screen", async function (this: OlaiWorld, id: string) {
  await this.flick(this.within(id, ZOOM));
});

When(
  "I hold a finger on the bullet of {string} and keep it there",
  async function (this: OlaiWorld, id: string) {
    const bullet = this.within(id, ZOOM);
    await bullet.scrollIntoViewIfNeeded();
    await this.holdDown(bullet);
  },
);

When(
  "I drag that finger above the title of {string}",
  async function (this: OlaiWorld, id: string) {
    const box = await this.box(this.nodeTitle(id), `the title of "${id}"`);
    await this.dragFinger({ x: box.x + 4, y: box.y - 2 });
  },
);

When("I let the finger go", async function (this: OlaiWorld) {
  await this.letGo();
});

Then("the row {string} is in the air", async function (this: OlaiWorld, id: string) {
  await this.expectNodeAttribute(id, "data-carried", "true");
});

Then("no row is in the air", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator('[data-carried="true"]').count()) === 0,
    "every row to be back on the page",
  );
});

Given("the screen is shorter than the outline", async function (this: OlaiWorld) {
  await this.shrinkToScroll(PHONE_WIDTH, SHORT_PHONE_HEIGHT);
});

Then("the outline has scrolled", async function (this: OlaiWorld) {
  const at = await this.page.evaluate(() => window.scrollY);
  assert.ok(at > 0, `the page is still at the top (scrollY ${at}) — the flick took nothing with it`);
});

When("I tap the outline {string}", async function (this: OlaiWorld, file: string) {
  await this.press(this.outlineLink(file), "tap");
});

When("I tap the day {string}", async function (this: OlaiWorld, date: string) {
  await this.openCalendar();
  await this.press(this.dayLink(date), "tap");
});

When("I tap the burger", async function (this: OlaiWorld) {
  await this.press(this.page.locator(SIDEBAR_TOGGLE), "tap");
  await this.page
    .locator(SIDEBAR_BODY)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("the burger is on screen", async function (this: OlaiWorld) {
  const burger = await this.box(
    this.page.locator(SIDEBAR_TOGGLE),
    "the burger",
  );
  const viewport = this.viewport();
  assert.ok(
    burger.y >= 0 && burger.y + burger.height <= viewport.height,
    `the burger is at y=${Math.round(burger.y)} on a ${viewport.height}px ` +
      "screen, which is not somewhere a thumb can reach without scrolling",
  );
  assert.ok(
    burger.height >= 44 && burger.width >= 44,
    `the burger is ${Math.round(burger.width)}×${Math.round(burger.height)}px, ` +
      "under the 44px both mobile platforms print in their guidelines",
  );
});

Then("there is no burger", async function (this: OlaiWorld) {
  assert.strictEqual(
    await this.page.locator(SIDEBAR_TOGGLE).isVisible(),
    false,
    "the burger is drawn on a laptop, where there is a column for the sidebar " +
      "to be and nothing to put away",
  );
});

Then("the app header is on screen", async function (this: OlaiWorld) {
  await this.page
    .locator(APP_HEADER)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

Then("the app chrome is inside the header", async function (this: OlaiWorld) {
  const header = await this.box(this.page.locator(APP_HEADER), "the app header");
  const pills = [
    { name: "health dot", sel: HEALTH },
    { name: "preferences trigger", sel: PREFS_TRIGGER },
  ];
  for (const pill of pills) {
    const box = await this.box(this.page.locator(pill.sel), pill.name);
    assert.ok(
      box.y >= header.y - 0.5 &&
        box.y + box.height <= header.y + header.height + 0.5 &&
        box.x >= header.x - 0.5 &&
        box.x + box.width <= header.x + header.width + 0.5,
      `${pill.name} is at (${Math.round(box.x)},${Math.round(box.y)}) ` +
        `${Math.round(box.width)}×${Math.round(box.height)} outside the ` +
        `header (${Math.round(header.x)},${Math.round(header.y)}) ` +
        `${Math.round(header.width)}×${Math.round(header.height)}`,
    );
  }
});

Then("the phone header is identity and search", async function (this: OlaiWorld) {
  const header = this.page.locator(APP_HEADER);
  await header.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.ok(
    await this.page.locator(HEADER_SEARCH_OPEN).isVisible(),
    "the magnifier is not in the header, so a phone has no door to search",
  );
  const pills = [
    { name: "health dot", sel: HEALTH },
    { name: "connection", sel: CONNECTION },
    { name: "padi pill", sel: PADI_PILL },
    { name: "spaces pill", sel: SPACES_PILL },
    { name: "commit pill", sel: COMMIT_PILL },
    { name: "uptime", sel: UPTIME },
    { name: "preferences trigger", sel: PREFS_TRIGGER },
  ];
  for (const pill of pills) {
    assert.strictEqual(
      await this.page.locator(pill.sel).isVisible(),
      false,
      `${pill.name} is drawn on a live phone — a healthy phone does not advertise health`,
    );
  }
});

When("I open the app held at connecting", async function (this: OlaiWorld) {
  // A string, not a function: tsc would otherwise typecheck the stub as a
  // real WebSocket constructor.
  await this.page.addInitScript(`
    (function () {
      function HeldWebSocket(url) {
        this.readyState = 0;
        this.bufferedAmount = 0;
        this.extensions = "";
        this.protocol = "";
        this.binaryType = "blob";
        this.url = String(url);
        this.onopen = null;
        this.onclose = null;
        this.onerror = null;
        this.onmessage = null;
      }
      HeldWebSocket.CONNECTING = 0;
      HeldWebSocket.OPEN = 1;
      HeldWebSocket.CLOSING = 2;
      HeldWebSocket.CLOSED = 3;
      HeldWebSocket.prototype.CONNECTING = 0;
      HeldWebSocket.prototype.OPEN = 1;
      HeldWebSocket.prototype.CLOSING = 2;
      HeldWebSocket.prototype.CLOSED = 3;
      HeldWebSocket.prototype.close = function () { this.readyState = 3; };
      HeldWebSocket.prototype.send = function () {};
      HeldWebSocket.prototype.addEventListener = function () {};
      HeldWebSocket.prototype.removeEventListener = function () {};
      HeldWebSocket.prototype.dispatchEvent = function () { return true; };
      window.WebSocket = HeldWebSocket;
    })();
  `);
  await this.page.goto("/");
  await this.page
    .locator(APP_HEADER)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitForFrame();
});

Then("I can type into the chat", async function (this: OlaiWorld) {
  const input = this.chat(CHAT_INPUT);
  await input.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.ok(
    await input.isEnabled(),
    "the composer is on screen but will not take a message",
  );
  const box = await this.box(input, "the chat input");
  const viewport = this.viewport();
  assert.ok(
    box.y >= 0 && box.y + box.height <= viewport.height,
    `the composer is at y=${Math.round(box.y)} on a ${viewport.height}px ` +
      "screen — a box a thumb cannot reach is a panel that opens onto nothing",
  );
});

Then("the sidebar is put away", async function (this: OlaiWorld) {
  assert.strictEqual(
    await this.page.locator(SIDEBAR_BODY).isVisible(),
    false,
    "the sidebar is open before anybody asked for it, so the outline it is a " +
      "header for starts a third of a screen down",
  );
});

Then(
  "the page reports the visible strip as the whole viewport",
  async function (this: OlaiWorld) {
    const reported = await this.page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      const visual = window.visualViewport;
      return {
        height: style.getPropertyValue("--visible-h").trim(),
        bottom: style.getPropertyValue("--visible-bottom").trim(),
        visual: visual === null ? null : Math.round(visual.height),
      };
    });
    assert.ok(
      reported.visual !== null,
      "this browser has no visualViewport, so the page has nothing to measure",
    );
    assert.strictEqual(
      reported.height,
      `${reported.visual}px`,
      "the page is not publishing the height of the strip it can see",
    );
    assert.strictEqual(reported.bottom, "0px");
  },
);

When("I tap the header search", async function (this: OlaiWorld) {
  await this.page.locator(HEADER_SEARCH_OPEN).tap();
});
