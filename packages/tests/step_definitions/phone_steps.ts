/**
 * A thumb, and a screen with room for one column.
 *
 * Tapping is not clicking: a tap is a `touchstart`/`touchend` pair on a
 * context with no mouse at all, which is the only way to find out that a
 * control a pointer can reach is reachable without one. Measuring is the
 * other — chrome that has to stay inside the header, a drawer that covers
 * the outline — because those are sizes no attribute can carry.
 */

import * as assert from "node:assert";
import { Given, Then, When } from "@cucumber/cucumber";

import { PHONE_WIDTH, SHORT_PHONE_HEIGHT } from "../support/hooks.ts";

import {
  APP_HEADER,
  CHAT_INPUT,
  CHAT_PANEL,
  CHAT_STRIP,
  CHAT_TOGGLE,
  COMMIT_PILL,
  CONNECTION,
  HEADER_SEARCH_OPEN,
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
} from "../support/world.ts";
import { HYDRATION_TIMEOUT, POLL_TIMEOUT } from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

// ── the thumb ──────────────────────────────────────────────────────────
//
// `press(target, "tap")` throughout. Waiting for the thing to be visible and
// waiting out the frame the gesture schedules are the same as a click's, and
// live on the World beside it — so what a step here says is only WHICH thing
// is tapped, and the node-scoping rule (`within`) stays in one place.

When("I tap the bullet of {string}", async function (this: OlaiWorld, id: string) {
  await this.press(this.within(id, ZOOM), "tap");
});

When("I tap the toggle of {string}", async function (this: OlaiWorld, id: string) {
  await this.press(this.within(id, TOGGLE), "tap");
});

/**
 * A finger that lands on a row and then takes the page with it.
 *
 * The gesture every touch affordance on a row has to survive: a thumb on its
 * way down a long outline starts on SOMETHING, and what it starts on must not
 * answer for it. It is a real drag — down, moving past the press deadline, up
 * — because that is the only version of it that could fail.
 */
When("I flick the node {string} up the screen", async function (this: OlaiWorld, id: string) {
  await this.flick(this.within(id, NODE_GUTTER));
});

/** The same gesture aimed at the BULLET — the cell a finger picks a row up by
 *  (`client/drag/Handle.tsx`), and therefore the one place a claimed gesture
 *  could have cost a reader the page. A flick that starts here must still
 *  scroll, which is what makes the claim a long press rather than a style. */
When("I flick the bullet of {string} up the screen", async function (this: OlaiWorld, id: string) {
  await this.flick(this.within(id, ZOOM));
});

// ── picking a row up with a finger ─────────────────────────────────────
//
// The touch half of drag-and-drop. A press is WATCHED until the deadline and
// only then claimed, so every one of these is a real gesture in three parts —
// down, held, moved — and a scenario has to be able to stop between them
// (`client/drag/dragging.ts`, `support/world.ts`'s `holdDown`).

When(
  "I hold a finger on the bullet of {string} and keep it there",
  async function (this: OlaiWorld, id: string) {
    await this.holdDown(this.within(id, ZOOM));
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

/**
 * A page with somewhere to scroll TO, which no fixture in this suite gives a
 * handset on its own: the corpora are outlines a person can read inside a
 * scenario, and the shortest phone here is 844 points tall.
 *
 * So the screen shrinks instead of the corpus growing — a real handset shape,
 * since that is what a phone with its keyboard up is — and the step asserts
 * what it just claimed rather than trusting it: a fixture that grew past this
 * height, or a layout that stopped scrolling the document, would otherwise
 * leave the scenario after it passing over nothing.
 */
Given("the screen is shorter than the outline", async function (this: OlaiWorld) {
  await this.shrinkToScroll(PHONE_WIDTH, SHORT_PHONE_HEIGHT);
});

/** It MOVED, which is the half that no assertion about the menu can carry: a
 *  press that claimed the gesture would leave the menu shut and the page
 *  exactly here. */
Then("the outline has scrolled", async function (this: OlaiWorld) {
  const at = await this.page.evaluate(() => window.scrollY);
  assert.ok(at > 0, `the page is still at the top (scrollY ${at}) — the flick took nothing with it`);
});

When("I tap the outline {string}", async function (this: OlaiWorld, file: string) {
  await this.press(this.outlineLink(file), "tap");
});

When("I tap the day {string}", async function (this: OlaiWorld, date: string) {
  await this.press(this.dayLink(date), "tap");
});

/** The burger, and what it reveals. Two taps to anything in the sidebar is the
 *  budget: one to open it, one to press what you came for. */
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

/** Every chrome pill's border box lies inside the header's own.
 *
 *  Desktop: the connection, commit, agent and preferences chips. A
 *  fixed-height bar with flex-wrap used to centre a wrapped pill group so
 *  the first row sat above the viewport. The assertion is geometry, not a
 *  colour: the header's own box is the clip region. Phone chrome is the
 *  next step — those pills are not in the bar. */
Then("the app chrome is inside the header", async function (this: OlaiWorld) {
  const header = await this.box(this.page.locator(APP_HEADER), "the app header");
  const pills = [
    { name: "connection", sel: CONNECTION },
    { name: "commit pill", sel: COMMIT_PILL },
    { name: "agent toggle", sel: CHAT_TOGGLE },
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

/**
 * WhatsApp's rule: the bar is ☰, olai, search. The pills that used to
 * crowd it — connection, commit, uptime, agent, prefs — are not in it.
 *
 * Absence is the assertion, not geometry: a healthy phone does not
 * advertise health, and the squeeze this used to measure is gone with the
 * chips.
 */
Then("the phone header is identity and search", async function (this: OlaiWorld) {
  const header = this.page.locator(APP_HEADER);
  await header.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.ok(
    await this.page.locator(HEADER_SEARCH_OPEN).isVisible(),
    "the magnifier is not in the header, so a phone has no door to search",
  );
  const pills = [
    { name: "connection", sel: CONNECTION },
    { name: "commit pill", sel: COMMIT_PILL },
    { name: "uptime", sel: UPTIME },
    { name: "agent toggle", sel: CHAT_TOGGLE },
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

/**
 * The connection still says a word, at whatever width this is.
 *
 * The header's stated order (`web/src/client/AppHeader.tsx`) ends with this
 * label: it is the last thing in the bar to give way, and in practice never
 * does, because the alternative is what `one-git-indicator` first shipped — a
 * bar squeezing `live` down to `l…` while a theme name beside it stayed whole.
 *
 * Truncation is asked of the LAYOUT rather than of the pixels: a `truncate`d
 * element whose content is wider than its box has a `scrollWidth` past its
 * `clientWidth`, and that is true whether or not the ellipsis happens to land
 * on a glyph a screenshot would show.
 */
Then("the connection's label is whole", async function (this: OlaiWorld) {
  const pill = this.page.locator(CONNECTION);
  await pill.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const cut = await pill.evaluate((el) => {
    const label = el.querySelector("span:last-child") as HTMLElement | null
    if (label === null) return { over: -1, said: "" }
    return {
      over: label.scrollWidth - label.clientWidth,
      said: (label.textContent ?? "").trim(),
    }
  });
  assert.ok(
    cut.over >= 0,
    "the connection pill has no label span, so there is nothing to be legible",
  );
  assert.ok(
    cut.over <= 0.5,
    `the connection says "${cut.said}" cut off by ${Math.round(cut.over)}px — ` +
      "and it is the last label in the bar that may give way",
  );
});

/**
 * Open the app with the wire stuck in `connecting`.
 *
 * A real dial races past `connecting` before a poll can sample it. Replacing
 * `WebSocket` with a stub that never leaves CONNECTING is deterministic: the
 * header paints, the indicator must say connecting or this step fails, and
 * the geometry assertion that follows can fail for its stated reason. No soft
 * fallback to live.
 */
When("I open the app held at connecting", async function (this: OlaiWorld) {
  // A string, not a function: tsc would otherwise typecheck the stub as a
  // real WebSocket constructor. Stays CONNECTING forever so the indicator
  // cannot race past to live.
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

// ── the agent, from a thumb ────────────────────────────────────────────

When("I tap the agent toggle", async function (this: OlaiWorld) {
  const toggle = this.page.locator(CHAT_TOGGLE);
  if (await toggle.isVisible()) {
    await this.press(toggle, "tap");
    return;
  }
  await this.press(this.page.locator(CHAT_STRIP), "tap");
});

Then("the agent panel is showing", async function (this: OlaiWorld) {
  await this.page
    .locator(CHAT_PANEL)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

Then("I can type into the chat", async function (this: OlaiWorld) {
  const input = this.page.locator(CHAT_INPUT);
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
// ── the strip the browser is showing ───────────────────────────────────

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
    // Nothing is covering the bottom of the page, so nothing anchored there
    // has to be lifted. It is the keyboard that makes this non-zero, and a
    // test cannot raise one.
    assert.strictEqual(reported.bottom, "0px");
  },
);
