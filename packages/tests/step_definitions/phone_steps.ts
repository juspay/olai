/**
 * A thumb, and a screen with room for one column.
 *
 * Two kinds of step, and they are the two things a phone changes. TAPPING is
 * not clicking: a tap is a `touchstart`/`touchend` pair on a context with no
 * mouse at all, which is the only way to find out that a control a pointer can
 * reach is reachable without one. MEASURING is the other, because "big enough
 * for a finger" is a size and no attribute can carry it — it is the sum of a
 * font, a padding and a breakpoint, so the only honest way to ask is to
 * measure what the browser laid out.
 *
 * The names in the feature files are a reader's names for the controls. The
 * map below is where they meet the `data-testid` contract, so a feature never
 * spells a selector and a rename stays a one-line change.
 */

import * as assert from "node:assert";
import { Given, Then, When } from "@cucumber/cucumber";

import { PHONE_WIDTH, SHORT_PHONE_HEIGHT } from "../support/hooks.ts";

import {
  APP_CHROME,
  APP_HEADER,
  CALENDAR_DAY,
  CHAT_INPUT,
  CHAT_PANEL,
  CHAT_TOGGLE,
  COMMIT_PILL,
  CONNECTION,
  DOCUMENT_LINK,
  CALENDAR_NEXT,
  CALENDAR_PREV,
  FILE_DIR_TOGGLE,
  NODE_GUTTER,
  NODE_TITLE,
  OUTLINE_LINK,
  OUTLINE_LIST,
  OUTLINE_TREE,
  PREFS_CHOICE,
  PREFS_ROW,
  PREFS_TRIGGER,
  SIDEBAR,
  SIDEBAR_BODY,
  SIDEBAR_TOGGLE,
  TOGGLE,
  WORDMARK,
  ZOOM,
} from "../support/world.ts";
import { HYDRATION_TIMEOUT, POLL_TIMEOUT } from "../support/world.ts";
import type { Box, OlaiWorld } from "../support/world.ts";

/** The controls a feature can name, and what each one is on the page. */
const TARGETS: Record<string, string> = {
  "outline entry": OUTLINE_LINK,
  "document entry": DOCUMENT_LINK,
  // The folder row's fold control — its own name, not the outline tree's
  // `collapse toggle`. The enumeration being exhaustive is the point of the
  // phone scenario; a new finger target must land here.
  "folder toggle": FILE_DIR_TOGGLE,
  "collapse toggle": TOGGLE,
  "zoom bullet": ZOOM,
  "done choice": `${PREFS_ROW}[data-pref="done"] ${PREFS_CHOICE}`,
  // A day with nothing on it is inert and goes nowhere, so it is not a
  // target; the link inside a day that HAS something is.
  "calendar day": `${CALENDAR_DAY}[data-dated="true"] a`,
  "month step": `${CALENDAR_PREV}, ${CALENDAR_NEXT}`,
};

const selectorFor = (name: string): string => {
  const selector = TARGETS[name];
  if (selector === undefined) {
    throw new Error(
      `no control is called "${name}" here; the ones there are: ` +
        `${Object.keys(TARGETS).join(", ")}`,
    );
  }
  return selector;
};

/** Every one of them that is on screen, measured. Every one rather than the
 *  first: a rule that held for the first row and not the tenth would be a rule
 *  that is not in force. */
const boxesOf = (world: OlaiWorld, name: string): Promise<ReadonlyArray<Box>> =>
  world.boxes(world.page.locator(`${selectorFor(name)}:visible`), name);

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
  await this.page.setViewportSize({ width: PHONE_WIDTH, height: SHORT_PHONE_HEIGHT });
  await this.waitForFrame();
  const room = await this.page.evaluate(() => ({
    page: document.documentElement.scrollHeight,
    screen: window.innerHeight,
    at: window.scrollY,
  }));
  assert.ok(
    room.page > room.screen,
    `the outline is ${room.page}px on a ${room.screen}px screen, so there is nothing to scroll`,
  );
  assert.strictEqual(room.at, 0, "this scenario starts at the top of the page");
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
  await this.press(this.calendarDay(date).locator("a"), "tap");
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
  const viewport = this.page.viewportSize();
  assert.ok(viewport !== null, "this scenario has no viewport size");
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
 *  A fixed-height bar with flex-wrap used to centre a wrapped pill group so
 *  the first row sat above the viewport at 390pt. The assertion is geometry,
 *  not a colour: the header's own box is the clip region. */
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

  // And the wordmark is not underneath them. Inside-the-bar is not the whole
  // claim: a row of pills wider than the room left beside `OLAI` overlaps it
  // instead of overflowing the header, which is what a 390pt bar carrying a
  // second row of text did — legible nowhere, and failing no assertion.
  const chrome = await this.box(this.page.locator(APP_CHROME), "the app chrome");
  const wordmark = await this.box(this.page.locator(WORDMARK), "the wordmark");
  assert.ok(
    chrome.x >= wordmark.x + wordmark.width - 0.5,
    `the app's chrome starts at x=${Math.round(chrome.x)}, over the wordmark, ` +
      `which ends at x=${Math.round(wordmark.x + wordmark.width)}`,
  );
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
  await this.expectAttribute(
    CONNECTION,
    "data-connection",
    "connecting",
    "the connection indicator",
    HYDRATION_TIMEOUT,
  );
  await this.waitForFrame();
});

// ── the agent, from a thumb ────────────────────────────────────────────

When("I tap the agent toggle", async function (this: OlaiWorld) {
  await this.press(this.page.locator(CHAT_TOGGLE), "tap");
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
  const viewport = this.page.viewportSize();
  assert.ok(viewport !== null, "this scenario has no viewport size");
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

// ── one column ─────────────────────────────────────────────────────────

Then(
  "the outline list is above the tree, not beside it",
  async function (this: OlaiWorld) {
    const list = await this.box(
      this.page.locator(OUTLINE_LIST),
      "the outline list",
    );
    const tree = await this.box(this.page.locator(OUTLINE_TREE), "the tree");
    assert.ok(
      list.y < tree.y,
      `the outline list starts at y=${list.y} and the tree at y=${tree.y}, so ` +
        "the list is not above it",
    );
    // The half that says it is stacked rather than merely lower down: two
    // columns do not overlap horizontally, and these do.
    assert.ok(
      tree.x < list.x + list.width,
      `the tree starts at x=${tree.x}, clear of the list (which ends at ` +
        `${list.x + list.width}) — that is two columns, not one`,
    );
  },
);

/** What the cap on the header is FOR. Not the cap itself — 42dvh is a styling
 *  decision, and the promise it is there to keep is this one: a reader who
 *  opens an outline on a phone can see the outline. */
Then("the outline is on screen under it", async function (this: OlaiWorld) {
  const viewport = this.page.viewportSize();
  assert.ok(viewport !== null, "this scenario has no viewport size");
  const tree = await this.box(this.page.locator(OUTLINE_TREE), "the tree");
  const room = viewport.height - tree.y;
  assert.ok(
    room >= viewport.height / 3,
    `the header leaves the outline ${Math.round(room)}px of a ` +
      `${viewport.height}px screen — it is meant to be capped and to scroll ` +
      "inside itself rather than to be a page of its own",
  );
  // The first TITLE, not the first row: a row is a whole subtree and is
  // taller than any screen the moment the outline has depth.
  const first = await this.box(
    this.page.locator(`${OUTLINE_TREE} ${NODE_TITLE}`).first(),
    "the first title in the outline",
  );
  assert.ok(
    first.y + first.height <= viewport.height,
    `the first row of the outline ends ${
      Math.round(first.y + first.height)
    }px down a ${viewport.height}px screen, which is below the fold`,
  );
});

// ── the size of a target ───────────────────────────────────────────────

Then(
  "every {string} is at least {int}px tall and {int}px wide",
  async function (this: OlaiWorld, name: string, tall: number, wide: number) {
    for (const [index, box] of (await boxesOf(this, name)).entries()) {
      assert.ok(
        box.height >= tall && box.width >= wide,
        `${name} #${index + 1} is ${Math.round(box.width)}×${
          Math.round(box.height)
        }px, and a finger needs ${wide}×${tall}px`,
      );
    }
  },
);

Then(
  "every {string} is smaller than {int}px tall",
  async function (this: OlaiWorld, name: string, tall: number) {
    for (const [index, box] of (await boxesOf(this, name)).entries()) {
      assert.ok(
        box.height < tall,
        `${name} #${index + 1} is ${Math.round(box.height)}px tall on a ` +
          "laptop — the finger-sized rule is meant to apply below 48rem only",
      );
    }
  },
);

// ── full-height column ─────────────────────────────────────────────────

/** The directory column floors at the viewport bottom on a short page.
 *
 *  Mutant: `min-h-full` against a flex item with auto height resolves to 0 and
 *  left the sidebar rule at y≈777 on a 900px desktop viewport. Content taller
 *  than the viewport still passes (bottom past the fold). */
Then(
  "the sidebar reaches the bottom of the viewport",
  async function (this: OlaiWorld) {
    const viewport = this.page.viewportSize();
    assert.ok(viewport !== null, "this scenario has no viewport size");
    const nav = await this.box(this.page.locator(SIDEBAR), "the sidebar");
    const bottom = nav.y + nav.height;
    assert.ok(
      bottom >= viewport.height - 1,
      `the sidebar ends at y=${Math.round(bottom)} on a ${viewport.height}px ` +
        "viewport — the directory column is meant to floor at the fold " +
        "(broken form: ~777 on 900)",
    );
  },
);

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
