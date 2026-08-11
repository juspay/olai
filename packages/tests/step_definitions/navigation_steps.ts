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
import type { Locator } from "playwright";

import { DESKTOP } from "../support/hooks.ts";
import {
  BLOCKED,
  DONE_TOGGLE,
  NODE_REF,
  NOT_FOUND,
  oneLine,
  POLL_TIMEOUT,
  SEE_REFS,
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

// ── free cross-references (`see`) ──────────────────────────────────────

/** The see-link on a node that points at a particular target. Selected by
 *  `data-ref` (the target id), never by link text — titles change under a live
 *  page, and a scenario that pinned one would flake the moment the target was
 *  retitled. Scoped to the see row, because a node's blockers are links to
 *  nodes in exactly the same shape and this step is about `see`. */
const seeLinkTo = (world: OlaiWorld, source: string, target: string) =>
  world
    .node(source)
    .locator(`${SEE_REFS} ${NODE_REF}:has([data-ref="${target}"])`)
    .first();

/** Click a link from a node to a node, and land. One helper for both relations
 *  — a `see` ref and a blocker are the same link — over `press`, which is
 *  already "wait until it is there, click it, wait out the frame". */
const followRef = async (world: OlaiWorld, link: Locator): Promise<void> => {
  await world.press(link);
  await world.page
    .locator(ZOOM_TITLE)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
};

Then(
  "the node {string} sees {string} as {string}",
  async function (
    this: OlaiWorld,
    source: string,
    target: string,
    title: string,
  ) {
    const link = seeLinkTo(this, source, target);
    await link.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    // The refs container is drawn only when the node carries a see — so its
    // presence is part of the assertion, not a free ride.
    await this.node(source)
      .locator(SEE_REFS)
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(
      oneLine(await link.innerText()),
      title,
      `the see link on "${source}" to "${target}" does not show the target's title`,
    );
  },
);

When(
  "I follow the see link to {string} on {string}",
  async function (this: OlaiWorld, target: string, source: string) {
    await followRef(this, seeLinkTo(this, source, target));
  },
);

// ── what a node is waiting on (`after`) ────────────────────────────────

When(
  "I follow the blocked link to {string} on {string}",
  async function (this: OlaiWorld, blocker: string, id: string) {
    // One step for both shapes of the marker: a row's pill is a link to the
    // first blocker and a page names every one of them, and either way the
    // element carrying `data-ref` is inside the anchor that opens it.
    await followRef(
      this,
      this.node(id).locator(`${BLOCKED} [data-ref="${blocker}"]`).first(),
    );
  },
);

// ── where a navigation leaves the page ─────────────────────────────────
//
// A route change redraws the main pane and moves nothing else, so without a
// decision the reader keeps whatever scroll position the last page was left at.
// The decision (`client/scroll.ts`) is that a page you go TO starts at the top
// and a page you go BACK to is where you left it, and it can only be exercised
// on a page that is taller than the window it is being read in — which is why
// the window is made short rather than the fixtures made long: how tall a page
// is belongs to the stylesheet, and a corpus grown until it happened to
// overflow would be a scenario that stopped testing anything the day a margin
// changed.

Given("the window is shorter than the page", async function (this: OlaiWorld) {
  // The laptop this suite reads on, made short: only the HEIGHT is this step's
  // decision, and the width stays the one every other scenario is laid out at
  // (`support/hooks.ts`) so the two-column breakpoint is not re-decided here.
  await this.page.setViewportSize({ ...DESKTOP.viewport, height: 400 });
});

const scrollTop = (world: OlaiWorld): Promise<number> =>
  world.page.evaluate(() => window.scrollY);

When("I scroll to the bottom of the page", async function (this: OlaiWorld) {
  // Scrolled and read in ONE round trip: `scrollTo` is synchronous, so where
  // the page ended up is known before the browser has painted it, and asking
  // twice would only be asking again.
  this.scrolledTo = await this.page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
    return window.scrollY;
  });
  await this.waitForFrame();
  assert.ok(
    this.scrolledTo > 0,
    "the page does not scroll in this window, so scrolling it proves nothing",
  );
});

/** Wait for the page to be at a position, and say where it actually is when it
 *  never gets there — a timeout that only says "it did not scroll" leaves the
 *  two failures this can have (nothing moved, something moved it somewhere
 *  else) looking identical. */
const expectScroll = async (
  world: OlaiWorld,
  top: number,
  what: string,
): Promise<void> => {
  try {
    await world.waitUntil(async () => (await scrollTop(world)) === top, what);
  } catch {
    throw new Error(`${what}, and it is at ${await scrollTop(world)}px instead`);
  }
};

Then("the page is at the top", async function (this: OlaiWorld) {
  await expectScroll(this, 0, "the page is at the top");
});

When("I go back", async function (this: OlaiWorld) {
  await this.page.goBack();
  await this.waitForFrame();
});

Then("the page is back where I left it", async function (this: OlaiWorld) {
  const left = this.scrolledTo;
  assert.ok(left !== undefined, "nothing scrolled the page first");
  await expectScroll(this, left, `the page is back at ${left}px`);
});
